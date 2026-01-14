import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  CreditCard, 
  Wallet, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  ExternalLink 
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { useWallet } from '@/hooks/use-wallet';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';

interface PurchaseCard {
  id: number;
  name: string;
  description: string;
  price_sol: number;
  price_usd: number;
  credit_limit: number;
}

// Helper function to get card styling based on price
const getCardStyling = (priceUsd: number) => {
  if (priceUsd <= 0.50) {
    return {
      cardClass: "bg-white border-gray-200 shadow-sm hover:shadow-md",
      iconBg: "bg-gray-100",
      iconClass: "text-gray-600",
      badgeClass: "bg-gray-100 text-gray-800",
      priceClass: "text-gray-900",
      descriptionClass: "text-gray-600"
    };
  } else if (priceUsd <= 25) {
    return {
      cardClass: "bg-gray-900 border-gray-700 shadow-lg hover:shadow-xl text-white",
      iconBg: "bg-gray-700",
      iconClass: "text-white",
      badgeClass: "bg-gray-700 text-gray-100",
      priceClass: "text-white",
      descriptionClass: "text-gray-300"
    };
  } else {
    return {
      cardClass: "bg-gradient-to-br from-blue-600 to-blue-800 border-blue-500 shadow-lg hover:shadow-xl text-white",
      iconBg: "bg-blue-500",
      iconClass: "text-white",
      badgeClass: "bg-blue-500 text-white",
      priceClass: "text-white",
      descriptionClass: "text-blue-100"
    };
  }
};

interface PaymentStatus {
  status: 'idle' | 'creating' | 'sending' | 'confirming' | 'processing' | 'completed' | 'failed';
  transactionSignature?: string;
  cardId?: string;
  error?: string;
}

export function PurchaseCards() {
  const { isAuthenticated, makeAuthenticatedRequest } = useWallet();
  const { publicKey, connected, sendTransaction } = useSolanaWallet(); // Use sendTransaction from wallet adapter
  const { connection } = useConnection(); // Get connection from wallet adapter
  const [selectedCard, setSelectedCard] = useState<PurchaseCard | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({ status: 'idle' });
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const queryClient = useQueryClient();

  // Query for available cards
  const { data: cardsData, isLoading } = useQuery({
    queryKey: ['cards-for-purchase'],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(`${baseUrl}/api/cards-for-purchase`);
    },
    enabled: isAuthenticated,
  });

  // Query for payment info (admin wallet address)
  const { data: paymentInfo } = useQuery({
    queryKey: ['payment-info'],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(`${baseUrl}/api/payment-info`);
    },
    enabled: isAuthenticated,
  });

  // Mutation for processing payment manually
  const processPaymentMutation = useMutation({
    mutationFn: async (transactionSignature: string) => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(`${baseUrl}/api/process-payment`, {
        method: 'POST',
        data: { transactionSignature }
      });
    },
    onSuccess: () => {
      setPaymentStatus({ status: 'completed' });
      toast.success('Payment processed successfully! Your card will be created shortly.');
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      setTimeout(() => {
        setShowPaymentDialog(false);
        setPaymentStatus({ status: 'idle' });
      }, 2000);
    },
    onError: (error: any) => {
      setPaymentStatus({ 
        status: 'failed', 
        error: error.response?.data?.error || 'Payment processing failed' 
      });
      toast.error('Payment processing failed. Please try again.');
    }
  });

  const handlePurchaseCard = async (card: PurchaseCard) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your Solana wallet first');
      return;
    }

    if (!paymentInfo?.walletAddress) {
      toast.error('Payment system not available');
      return;
    }

    setSelectedCard(card);
    setShowPaymentDialog(true);
    setPaymentStatus({ status: 'creating' });

    try {
      setPaymentStatus({ status: 'sending' });

      // Create the transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(paymentInfo.walletAddress),
          lamports: Math.floor(card.price_sol * LAMPORTS_PER_SOL),
        })
      );

      // Use wallet adapter's sendTransaction method
      const signature = await sendTransaction(transaction, connection);

      setPaymentStatus({ 
        status: 'processing', 
        transactionSignature: signature 
      });

      // Wait for blockchain propagation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Process payment through API
      await processPaymentMutation.mutateAsync(signature);

    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentStatus({ 
        status: 'failed', 
        error: error.message || 'Payment failed' 
      });
      toast.error(`Payment failed: ${error.message}`);
    }
  };

  const getStatusIcon = () => {
    switch (paymentStatus.status) {
      case 'creating':
      case 'sending':
      case 'confirming':
      case 'processing':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
      default:
        return <Wallet className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusMessage = () => {
    switch (paymentStatus.status) {
      case 'creating':
        return 'Creating transaction...';
      case 'sending':
        return 'Please sign the transaction in your wallet';
      case 'confirming':
        return 'Confirming transaction on blockchain...';
      case 'processing':
        return 'Processing payment and creating your card...';
      case 'completed':
        return 'Payment successful! Your card has been created.';
      case 'failed':
        return `Payment failed: ${paymentStatus.error}`;
      default:
        return 'Ready to process payment';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <div className="wise-card p-8">
          <Wallet className="mx-auto h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600">
            Connect your wallet to purchase credit cards with SOL payments.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="space-y-6">
          <div className="wise-card p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="wise-card p-6 animate-pulse">
                <div className="space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-10 bg-gray-200 rounded w-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const cards = cardsData?.cards || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Purchase Credit Cards</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Get instant access to virtual credit cards by paying with SOL. 
          Choose from our available plans and start spending immediately.
        </p>
        
        {paymentInfo?.walletAddress && (
          <div className="wise-card p-4 max-w-md mx-auto">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Payment Wallet:</span>
              <div className="flex items-center space-x-2">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {`${paymentInfo.walletAddress.slice(0, 8)}...${paymentInfo.walletAddress.slice(-8)}`}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-6 w-6 p-0"
                >
                  <a
                    href={`https://solscan.io/account/${paymentInfo.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((card: PurchaseCard) => {
          const styling = getCardStyling(card.price_usd);
          
          return (
            <Card key={card.id} className={`wise-card transition-all duration-300 relative overflow-hidden ${styling.cardClass}`}>
              <div className="absolute top-4 right-4">
                <Badge className={`border-0 ${styling.badgeClass}`}>
                  {card.name}
                </Badge>
              </div>
              
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-2 rounded-lg ${styling.iconBg}`}>
                    <CreditCard className={`h-6 w-6 ${styling.iconClass}`} />
                  </div>
                  <div>
                    <CardTitle className={`text-lg ${styling.priceClass}`}>{card.name}</CardTitle>
                    <CardDescription className={`text-sm ${styling.descriptionClass}`}>
                      ${card.credit_limit.toLocaleString()} Credit Limit
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className={`text-sm ${styling.descriptionClass}`}>{card.description}</p>
                
                <div className="space-y-3">
                  <div className={`flex justify-between items-center p-3 rounded-lg ${card.price_usd <= 0.50 ? 'bg-gray-50' : 'bg-white/10'}`}>
                    <span className={`text-sm font-medium ${card.price_usd <= 0.50 ? 'text-gray-700' : 'text-white/90'}`}>SOL Price:</span>
                    <span className={`text-lg font-bold ${card.price_usd <= 0.50 ? 'text-blue-600' : 'text-white'}`}>{card.price_sol} SOL</span>
                  </div>
                  
                  <div className={`flex justify-between items-center p-3 rounded-lg ${card.price_usd <= 0.50 ? 'bg-gray-50' : 'bg-white/10'}`}>
                    <span className={`text-sm font-medium ${card.price_usd <= 0.50 ? 'text-gray-700' : 'text-white/90'}`}>USD Equivalent:</span>
                    <span className={`text-sm ${card.price_usd <= 0.50 ? 'text-gray-600' : 'text-white/80'}`}>${card.price_usd}</span>
                  </div>
                  
                  <div className={`flex justify-between items-center p-3 rounded-lg border ${card.price_usd <= 0.50 ? 'bg-green-50 border-green-200' : 'bg-green-500/20 border-green-400/30'}`}>
                    <span className={`text-sm font-medium ${card.price_usd <= 0.50 ? 'text-green-700' : 'text-green-100'}`}>Credit Limit:</span>
                    <span className={`text-lg font-bold ${card.price_usd <= 0.50 ? 'text-green-600' : 'text-green-200'}`}>
                      ${card.credit_limit.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                <Button
                  onClick={() => handlePurchaseCard(card)}
                  className={`w-full wise-button ${card.price_usd > 0.50 ? 'bg-white/20 hover:bg-white/30 text-white border-white/30' : ''}`}
                  size="lg"
                  variant={card.price_usd <= 0.50 ? "default" : "outline"}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Purchase with {card.price_sol} SOL
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payment Progress Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="wise-card border-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {paymentStatus.status === 'completed' ? 'Payment Successful!' : 'Processing Payment'}
            </DialogTitle>
            <DialogDescription>
              {selectedCard && `Purchasing ${selectedCard.name} for ${selectedCard.price_sol} SOL`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center space-y-4">
              {getStatusIcon()}
              <p className="text-center text-gray-600">{getStatusMessage()}</p>
              
              {paymentStatus.transactionSignature && (
                <div className="w-full p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Transaction Signature:</div>
                  <div className="flex items-center space-x-2">
                    <code className="text-xs bg-white px-2 py-1 rounded border flex-1 truncate">
                      {paymentStatus.transactionSignature}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-6 w-6 p-0"
                    >
                      <a
                        href={`https://solscan.io/tx/${paymentStatus.transactionSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {paymentStatus.status === 'sending' && (
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-blue-700">
                  Please check your wallet and approve the transaction
                </p>
              </div>
            )}

            {(paymentStatus.status === 'completed' || paymentStatus.status === 'failed') && (
              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    setShowPaymentDialog(false);
                    setPaymentStatus({ status: 'idle' });
                  }}
                  className="wise-button"
                >
                  {paymentStatus.status === 'completed' ? 'Done' : 'Try Again'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {cards.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <div className="wise-card max-w-md mx-auto p-8">
            <CreditCard className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Cards Available
            </h3>
            <p className="text-gray-600">
              There are currently no credit cards available for purchase.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}