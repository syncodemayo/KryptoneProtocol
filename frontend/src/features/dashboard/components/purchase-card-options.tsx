import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createTransferInstruction
} from '@solana/spl-token';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/hooks/use-wallet';

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
  if (priceUsd <= 0.05) {
    // $0.05 Card - White
    return {
      cardClass: "card-white shadow-sm hover:shadow-md transition-all duration-300",
      headerClass: "bg-gray-50",
      iconClass: "bg-gray-100 text-gray-600",
      priceClass: "text-gray-900",
      badgeClass: "bg-gray-100 text-gray-800"
    };
  } else if (priceUsd <= 0.10) {
    // $0.10 Card - Silver
    return {
      cardClass: "card-silver shadow-lg hover:shadow-xl text-black transition-all duration-300",
      headerClass: "bg-gray-200",
      iconClass: "bg-gray-400 text-gray-800",
      priceClass: "text-gray-900",
      badgeClass: "bg-gray-400 text-gray-900"
    };
  } else {
    // $0.50 Card - Black
    return {
      cardClass: "card-black shadow-lg hover:shadow-2xl text-white transition-all duration-300",
      headerClass: "bg-gray-900",
      iconClass: "bg-gray-700 text-white",
      priceClass: "text-white",
      badgeClass: "bg-gray-700 text-gray-100"
    };
  }
};

// Simplified card options
const STATIC_CARD_OPTIONS: PurchaseCard[] = [
  {
    id: 1,
    name: '$0.05 Credit Card',
    description: 'Basic card for small purchases - $50 credit limit',
    price_sol: 0.05, // 0.05 USDC
    price_usd: 0.05,
    credit_limit: 50
  },
  {
    id: 2,
    name: '$0.10 Credit Card',
    description: 'Standard card for everyday use - $100 credit limit',
    price_sol: 0.10, // 0.10 USDC
    price_usd: 0.10,
    credit_limit: 100
  },
  {
    id: 3,
    name: '$0.50 Credit Card',
    description: 'Premium card for larger purchases - $500 credit limit',
    price_sol: 0.50, // 0.50 USDC
    price_usd: 0.50,
    credit_limit: 500
  }
];

interface PaymentStatus {
  status: 'idle' | 'creating' | 'sending' | 'confirming' | 'processing' | 'completed' | 'waiting_for_card' | 'card_requested' | 'failed';
  transactionSignature?: string;
  error?: string;
  estimatedReadyTime?: string;
  requestId?: string;
}

interface PurchaseCardOptionsProps {
  onClose: () => void;
}

export function PurchaseCardOptions({ onClose }: PurchaseCardOptionsProps) {
  const { makeAuthenticatedRequest, isAuthenticated } = useWallet();
  const { publicKey, connected, sendTransaction } = useSolanaWallet();
  const { connection } = useConnection();
  const [selectedCard, setSelectedCard] = useState<PurchaseCard | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({ status: 'idle' });
  const queryClient = useQueryClient();

  // Query for payment info
  const { data: paymentInfo } = useQuery({
    queryKey: ['payment-info'],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(`${baseUrl}/api/payment-info`);
    },
    enabled: isAuthenticated,
  });

  // Query to check card creation status for specific transaction
  const { data: cardStatusData } = useQuery({
    queryKey: ['card-status', paymentStatus.transactionSignature],
    queryFn: async () => {
      if (!paymentStatus.transactionSignature) return null;

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(
        `${baseUrl}/api/check-card-status/${paymentStatus.transactionSignature}`
      );
    },
    enabled: isAuthenticated && !!paymentStatus.transactionSignature && paymentStatus.status === 'waiting_for_card',
    refetchInterval: 5000, // Poll every 5 seconds
    retry: 3,
  });

  // Query to check card request status for specific transaction
  const { data: cardRequestData } = useQuery({
    queryKey: ['card-request-status', paymentStatus.transactionSignature],
    queryFn: async () => {
      if (!paymentStatus.transactionSignature) return null;

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(
        `${baseUrl}/api/card-request-status/${paymentStatus.transactionSignature}`
      );
    },
    enabled: isAuthenticated && !!paymentStatus.transactionSignature && paymentStatus.status === 'card_requested',
    refetchInterval: 10000, // Poll every 10 seconds for card requests
    retry: 3,
  });

  // Monitor card request status
  useEffect(() => {
    if (paymentStatus.status === 'card_requested' && cardRequestData) {
      if (cardRequestData.cardReady) {
        // Card request has been fulfilled!
        setPaymentStatus({ status: 'completed' });

        // Show enhanced success notification
        toast.success(
          '🎉 Your Credit Card is Ready!',
          {
            description: `Your ${selectedCard?.name || 'credit card'} has been created and is now available in your dashboard.`,
            duration: 8000,
          }
        );

        // Invalidate queries to refresh the dashboard
        queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
        queryClient.invalidateQueries({ queryKey: ['card-requests'] });

        // Close modal after showing success message briefly
        setTimeout(() => {
          onClose();
          setPaymentStatus({ status: 'idle' });
        }, 2500);
      }
    }
  }, [cardRequestData, paymentStatus.status, onClose, queryClient, selectedCard]);

  // Monitor card creation status
  useEffect(() => {
    if (paymentStatus.status === 'waiting_for_card' && cardStatusData) {
      if (cardStatusData.cardCreated) {
        // Card has been created!
        setPaymentStatus({ status: 'completed' });
        toast.success('Success! Your new credit card is now available.');

        // Invalidate the main cards query to refresh the dashboard
        queryClient.invalidateQueries({ queryKey: ['credit-cards'] });

        // Close modal after showing success message briefly
        setTimeout(() => {
          onClose();
          setPaymentStatus({ status: 'idle' });
        }, 2000);
      }
    }
  }, [cardStatusData, paymentStatus.status, onClose, queryClient]);

  // Mutation for processing payment
  const processPaymentMutation = useMutation({
    mutationFn: async (transactionSignature: string) => {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(`${baseUrl}/api/process-payment`, {
        method: 'POST',
        data: { transactionSignature }
      });
    },
    onSuccess: (result: { cardRequested?: boolean; requestId?: string; estimatedReadyTime?: string; cardType?: string; creditLimit?: number; message?: string }) => {
      // Check if this was a card request scenario
      if (result.cardRequested) {
        setPaymentStatus(prev => ({
          ...prev,
          status: 'card_requested',
          requestId: result.requestId,
          estimatedReadyTime: result.estimatedReadyTime
        }));

        // Show specific card request notification
        toast.success(
          `💳 Card Request Created!`,
          {
            description: result.message || 'Your credit card will be ready within 15-30 min.',
            duration: 6000,
          }
        );
      } else {
        setPaymentStatus(prev => ({
          ...prev,
          status: 'waiting_for_card'
        }));
        toast.success('Payment processed! Creating your credit card...');
      }
    },
    onError: (error: Error & { response?: { data?: { error?: string } } }) => {
      setPaymentStatus({
        status: 'failed',
        error: error.response?.data?.error || 'Payment processing failed'
      });
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
    setPaymentStatus({ status: 'creating' });

    try {
      // Get USDC mint from environment or default to Devnet
      const usdcMintAddress = import.meta.env.VITE_USDC_MINT || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Devnet USDC
      const usdcMint = new PublicKey(usdcMintAddress);

      console.log('Using USDC Mint:', usdcMintAddress);

      // Get User's ATA
      const userAta = await getAssociatedTokenAddress(
        usdcMint,
        publicKey
      );

      // Get Merchant's ATA
      const merchantKey = new PublicKey(paymentInfo.walletAddress);
      const merchantAta = await getAssociatedTokenAddress(
        usdcMint,
        merchantKey
      );

      setPaymentStatus({ status: 'sending' });

      const transaction = new Transaction();

      // Check if user's ATA exists by trying to get account info
      try {
        const userAtaInfo = await connection.getAccountInfo(userAta);
        if (!userAtaInfo) {
          toast.error('Please add USDC to your wallet.');
          setPaymentStatus({ status: 'idle' });
          return;
        }
      } catch (error) {
        console.error('Error checking user ATA:', error);
        toast.error('Unable to verify your USDC account. Please ensure you have USDC in your wallet.');
        setPaymentStatus({ status: 'idle' });
        return;
      }

      // Check if merchant's ATA exists, create if not
      try {
        const merchantAtaInfo = await connection.getAccountInfo(merchantAta);
        if (!merchantAtaInfo) {
          console.log('Merchant USDC account does not exist, creating it...');

          // Import createAssociatedTokenAccountInstruction
          const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');

          // Add instruction to create merchant's ATA
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey, // payer (user pays for the creation)
              merchantAta, // ATA address
              merchantKey, // owner of the ATA
              usdcMint // token mint
            )
          );

          toast.info('Creating payment recipient account (one-time setup)...');
        }
      } catch (error) {
        console.error('Error checking merchant ATA:', error);
        // Continue anyway - the transfer will fail if there's a real issue
      }

      // Amount: card.price_sol is now holding the USDC amount.
      // USDC has 6 decimals.
      const amountMicroUnits = Math.floor(card.price_sol * 1_000_000);

      console.log(`Transferring ${card.price_sol} USDC (${amountMicroUnits} micro-units)`);

      // Create transfer instruction
      transaction.add(
        createTransferInstruction(
          userAta,
          merchantAta,
          publicKey,
          amountMicroUnits,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await sendTransaction(transaction, connection);

      setPaymentStatus({
        status: 'processing',
        transactionSignature: signature
      });

      // Wait a bit for transaction to be confirmed
      await new Promise(resolve => setTimeout(resolve, 3000));
      await processPaymentMutation.mutateAsync(signature);

    } catch (error: any) {
      console.error('Payment error:', error);

      let errorMessage = error.message || 'Payment failed';

      // Provide more helpful error messages
      if (errorMessage.includes('Account not found')) {
        errorMessage = "You don't have a USDC token account. Please add USDC to your wallet first.";
      } else if (errorMessage.includes('insufficient')) {
        errorMessage = "Insufficient USDC balance. Please add more USDC to your wallet.";
      } else if (errorMessage.includes('0x1')) {
        errorMessage = "Insufficient USDC balance for this transaction.";
      } else if (errorMessage.includes('User rejected')) {
        errorMessage = "Transaction cancelled.";
      }

      setPaymentStatus({
        status: 'failed',
        error: errorMessage
      });
      toast.error(`Payment failed: ${errorMessage}`);
    }
  };

  const getStatusMessage = () => {
    switch (paymentStatus.status) {
      case 'creating':
        return 'Creating transaction...';
      case 'sending':
        return 'Please confirm the transaction in your wallet';
      case 'confirming':
        return 'Confirming transaction...';
      case 'processing':
        return 'Processing payment...';
      case 'waiting_for_card':
        return `Payment confirmed! Creating your ${selectedCard?.name || 'credit card'}...`;
      case 'card_requested':
        return `Payment received! No cards are currently available, but we're preparing your ${selectedCard?.name || 'credit card'}. You'll be notified when it's ready.`;
      case 'completed':
        return 'Success! Your credit card is now available in your dashboard.';
      case 'failed':
        return `Payment failed: ${paymentStatus.error}`;
      default:
        return null;
    }
  };

  const formatEstimatedTime = (timeString?: string) => {
    if (!timeString) return null;

    const estimatedTime = new Date(timeString);
    const now = new Date();
    const diffMinutes = Math.ceil((estimatedTime.getTime() - now.getTime()) / (1000 * 60));

    if (diffMinutes <= 0) {
      return 'Processing now...';
    } else if (diffMinutes <= 30) {
      return `Ready in ~${diffMinutes} minutes`;
    } else {
      return 'Ready within 30 minutes';
    }
  };

  const getStatusIcon = () => {
    switch (paymentStatus.status) {
      case 'creating':
      case 'sending':
      case 'confirming':
      case 'processing':
      case 'waiting_for_card':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      case 'card_requested':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  // Payment processing view
  if (paymentStatus.status !== 'idle') {
    return (
      <div className="text-center space-y-6 py-8">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-gray-50">
            {getStatusIcon()}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold">
            {paymentStatus.status === 'completed' ? 'Payment Successful!' :
              paymentStatus.status === 'card_requested' ? 'Card Requested' : 'Processing Payment'}
          </h3>
          <p className="text-gray-600 text-sm">
            {getStatusMessage()}
          </p>
          {selectedCard && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-sm text-blue-700">
              <CreditCard className="h-4 w-4" />
              {selectedCard.name}
            </div>
          )}
          {paymentStatus.status === 'card_requested' && paymentStatus.estimatedReadyTime && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-full text-sm text-orange-700 mt-2">
              <Clock className="h-4 w-4" />
              {formatEstimatedTime(paymentStatus.estimatedReadyTime)}
            </div>
          )}
        </div>

        {paymentStatus.transactionSignature && (
          <div className="pt-4 border-t">
            <p className="text-xs text-gray-500 mb-2">Transaction ID:</p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                {paymentStatus.transactionSignature.slice(0, 8)}...{paymentStatus.transactionSignature.slice(-8)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://solscan.io/tx/${paymentStatus.transactionSignature}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {paymentStatus.status === 'failed' && (
          <Button
            onClick={() => setPaymentStatus({ status: 'idle' })}
            variant="outline"
          >
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // Main card selection view
  return (
    <div className="space-y-6">


      {!connected && (
        <div className="p-4 border border-gray-300 silver-accent rounded-lg">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-gray-700 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-800">Wallet Required</p>
              <p className="text-sm text-gray-600">Please connect your Solana wallet to purchase a card.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {STATIC_CARD_OPTIONS.map((card) => {
          const styling = getCardStyling(card.price_usd);

          return (
            <Card
              key={card.id}
              className={`relative transition-shadow cursor-pointer ${styling.cardClass}`}
              onClick={() => connected && paymentStatus.status === 'idle' && handlePurchaseCard(card)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${styling.iconClass}`}>
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <CardTitle className={`text-lg ${styling.priceClass}`}>{card.name}</CardTitle>
                  </div>
                  <Badge className={`text-xs ${styling.badgeClass} border-0`}>
                    ${card.credit_limit.toLocaleString()} limit
                  </Badge>
                </div>
                <CardDescription className={`text-sm ${card.price_usd > 0.50 ? 'text-gray-300' : 'text-gray-600'}`}>
                  {card.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-bold ${styling.priceClass}`}>{card.price_sol} USDC</span>
                      <span className={`text-sm ${card.price_usd > 0.50 ? 'text-gray-400' : 'text-gray-500'}`}>(≈ ${card.price_usd})</span>
                    </div>
                  </div>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePurchaseCard(card);
                    }}
                    disabled={!connected || paymentStatus.status !== 'idle'}
                    size="sm"
                    variant={card.price_usd <= 5.0 ? "default" : "secondary"}
                    className={card.price_usd > 5.0 ? "bg-white/90 hover:bg-white text-black border-gray-200" : "bg-black hover:bg-gray-900 text-white"}
                  >
                    {!connected ? 'Connect Wallet' : 'Purchase'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center pt-4 border-t">
        <p className="text-xs text-gray-500">
          Payments are processed instantly on the Solana blockchain. Cards are activated within minutes.
        </p>
      </div>
    </div>
  );
}