import { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import {
  CreditCard,
  Eye,
  EyeOff,
  Plus,
  Shield,
  Lock,
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
} from 'lucide-react';

import { Logo } from '@/assets/logo';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import {
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useDebounce } from '@/hooks/use-debounce';
import { useWallet } from '@/hooks/use-wallet';
import { PurchaseCardOptions } from './purchase-card-options';

interface CreditCard {
  id: string;
  card_number: string;
  masked_card_number: string;
  holder_name: string;
  expiry_date: string;
  cvv: string;
  card_type: 'visa' | 'mastercard' | 'american-express';
  status: 'active' | 'blocked' | 'expired' | 'pending';
  balance: number;
  credit_limit: number;
  available_credit: number;
  created_at: string;
  last_used?: string;
  price_sol?: number;
  price_usd?: number;
}

interface CardsResponse {
  cards?: CreditCard[];
  message?: string;
}

export function CreditCardsTable() {
  const { makeAuthenticatedRequest, isAuthenticated } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [showCardDetails, setShowCardDetails] = useState<{ [key: string]: boolean }>({});
  const [isNewCardDialogOpen, setIsNewCardDialogOpen] = useState(false);

  // Determine card style based on card price from API
  const getCardStyle = (card: CreditCard) => {
    // blocked/expired/pending overrides
    if (card.status === 'blocked') return 'bg-gray-500 text-gray-300 border-gray-600';
    if (card.status === 'expired') return 'bg-gray-400 text-gray-700 border-gray-500';
    if (card.status === 'pending') return 'bg-gray-600 text-white border-gray-700';

    const price = card.price_usd || 0.05; // Default to $0.05 if no price data

    // Card color scheme based on price tier
    if (price <= 0.05) {
      // $0.05 Card - White
      return 'card-white';
    } else if (price <= 0.10) {
      // $0.10 Card - Silver
      return 'card-silver';
    } else {
      // $0.50 Card - Black
      return 'card-black';
    }
  };

  const getCardTypeIcon = (type: CreditCard['card_type'], isWhiteCard: boolean) => {
    switch (type) {
      case 'visa':
        return (
          <div className={`${isWhiteCard ? 'text-blue-900' : 'text-white'} font-bold text-2xl tracking-wider italic`}>
            visa
          </div>
        );
      case 'mastercard':
        return (
          <div className="flex items-center">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-red-500"></div>
              <div className="w-8 h-8 rounded-full bg-yellow-400 absolute -right-4 top-0 opacity-90"></div>
            </div>
            <span className={`ml-6 ${isWhiteCard ? 'text-gray-900' : 'text-white'} font-bold text-lg`}>mastercard</span>
          </div>
        );
      case 'american-express':
        return (
          <div className={`${isWhiteCard ? 'text-blue-900' : 'text-white'} font-bold text-lg tracking-wide`}>
            AMERICAN<br />EXPRESS
          </div>
        );
      default:
        return <CreditCard className={`h-6 w-6 ${isWhiteCard ? 'text-gray-900' : 'text-white'}`} />;
    }
  };

  const formatCardNumber = (number: string, isVisible: boolean) => {
    if (!isVisible) {
      return number; // Already masked
    }
    // Format as XXXX XXXX XXXX XXXX with proper spacing
    return number.replace(/(.{4})/g, '$1 ').trim();
  };

  // Handle search events from the dashboard
  useEffect(() => {
    const handleSearch = (event: CustomEvent) => {
      setSearchTerm(event.detail);
    };

    const handleNewCardModal = () => {
      setIsNewCardDialogOpen(true);
    };

    window.addEventListener('cardsSearch', handleSearch as EventListener);
    window.addEventListener('openNewCardModal', handleNewCardModal as EventListener);

    return () => {
      window.removeEventListener('cardsSearch', handleSearch as EventListener);
      window.removeEventListener('openNewCardModal', handleNewCardModal as EventListener);
    };
  }, []);

  // Query for credit cards
  const { data, isLoading, error } = useQuery({
    queryKey: ['credit-cards', debouncedSearchTerm, isAuthenticated],
    queryFn: async (): Promise<CardsResponse> => {
      if (!isAuthenticated) {
        return { cards: [] };
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const cardsUrl = `${baseUrl}/api/cards`;

      return await makeAuthenticatedRequest(cardsUrl);
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const toggleCardDetails = (cardId: string) => {
    setShowCardDetails(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const getStatusColor = (status: CreditCard['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'blocked': return 'bg-red-500';
      case 'expired': return 'bg-gray-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: CreditCard['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'blocked': return <Lock className="h-4 w-4" />;
      case 'expired': return <AlertTriangle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="py-16 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 border border-blue-200">
          <Shield className="h-8 w-8 text-blue-600" />
        </div>
        <p className="mb-2 font-semibold text-slate-700">
          Connect Your Wallet
        </p>
        <p className="text-sm text-slate-500">
          Please connect and authenticate your Solana wallet to access your credit cards
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="banking-card p-6 animate-pulse"
          >
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-8 bg-slate-200 rounded w-1/2"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-slate-200 rounded flex-1"></div>
                <div className="h-6 bg-slate-200 rounded flex-1"></div>
              </div>
              <div className="h-10 bg-slate-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-200">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <p className="mb-2 font-semibold text-red-700">
          Failed to load credit cards
        </p>
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const cards = data?.cards || [];
  const filteredCards = cards.filter(card =>
    !debouncedSearchTerm ||
    card.holder_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    card.masked_card_number.includes(debouncedSearchTerm) ||
    card.card_type.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    card.status.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  return (
    <div className="w-full">
      <TooltipProvider>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {/* Light theme New Card Application */}
          <Dialog open={isNewCardDialogOpen} onOpenChange={setIsNewCardDialogOpen}>
            <DialogTrigger asChild>
              <div className="bw-card h-56 cursor-pointer border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors group flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl silver-accent group-hover:shadow-md transition-all duration-300">
                    <Plus className="h-5 w-5 text-gray-700" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-gray-900">Get a Credit Card</h3>
                  <p className="text-sm text-gray-500 max-w-32">Purchase instantly with USDC payments</p>
                </div>
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl bw-card border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-gray-900">Purchase Credit Card with USDC</DialogTitle>
                <DialogDescription className="text-sm text-gray-600">
                  Choose a credit card plan and pay instantly with Solana. Your card will be activated immediately after payment.
                </DialogDescription>
              </DialogHeader>
              <PurchaseCardOptions onClose={() => setIsNewCardDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          {/* Authentic Credit Cards */}
          {filteredCards.map((card) => {
            const cardPrice = card.price_usd || 0.05; // Default to $0.05 if no price data
            const isBlackCard = cardPrice > 0.10; // Black cards are > $0.10
            const cardStyle = getCardStyle(card);

            return (
              <div key={card.id} className="-m-0.5">
                {/* Realistic Credit Card */}
                <div className="group perspective-1000 cursor-pointer">
                  <div className="relative w-full h-52 transform-style-preserve-3d transition-all duration-500 hover:scale-105 hover:-translate-y-2">
                    {/* Enhanced Card Shadow */}
                    <div className="absolute inset-0 bg-black/20 rounded-xl blur-lg transform translate-y-3 scale-95 -z-10 group-hover:bg-black/30 group-hover:blur-xl transition-all duration-500"></div>

                    {/* Main Card */}
                    <div className={`absolute inset-0 rounded-xl ${cardStyle} shadow-xl overflow-hidden group-hover:shadow-2xl transition-all duration-500`}>

                      {/* Card Background Pattern with Large Logo Watermark */}
                      <div className="absolute inset-0">
                        {/* Large Background Logo Watermark - Right Aligned */}
                        <div className="absolute inset-y-0 -right-30 flex items-center justify-end pr-4 opacity-5 group-hover:opacity-8 transition-opacity duration-500 overflow-hidden">
                          <Logo
                            className="h-80 w-80 rotate-12 transform scale-150"
                            variant={isBlackCard ? 'silver' : 'default'}
                          />
                        </div>

                        {/* Enhanced Holographic shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -skew-x-12 transform translate-x-full group-hover:-translate-x-full"></div>

                        {/* Animated decorative circles - simplified for clean look */}
                        <div className={`absolute top-3 right-3 w-24 h-24 rounded-full border ${isBlackCard ? 'border-white/5' : 'border-black/5'} opacity-30 group-hover:opacity-40 group-hover:scale-110 transition-all duration-500`}></div>
                      </div>

                      {/* Card Content */}
                      <div className={`relative z-10 flex flex-col h-full p-5 ${isBlackCard ? 'text-white' : 'text-gray-900'}`}>

                        {/* Top Row: Logo, Available Credit, and Chip */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex flex-col">
                            <div className="group-hover:scale-105 transition-transform duration-300 scale-75 origin-left">
                              {getCardTypeIcon(card.card_type, !isBlackCard)}
                            </div>
                            {card.status !== 'active' && (
                              <Badge className={`${getStatusColor(card.status)} text-white text-xs border-0 mt-1 scale-75 origin-left group-hover:scale-80 transition-transform duration-300`}>
                                {getStatusIcon(card.status)}
                                <span className="ml-1 capitalize">{card.status}</span>
                              </Badge>
                            )}
                          </div>

                          {/* EMV Chip and Available Credit */}
                          <div className="flex flex-col items-end gap-1.5">
                            <div className={`flex items-center gap-1 ${isBlackCard ? 'bg-white/10' : 'bg-gray-100'} backdrop-blur-sm rounded px-2 py-1 group-hover:scale-105 transition-all duration-300`}>
                              <DollarSign className={`h-3 w-3 ${isBlackCard ? 'text-white/80' : 'text-gray-600'}`} />
                              <span className={`text-sm font-bold ${isBlackCard ? 'text-white' : 'text-gray-900'}`}>${card.available_credit.toLocaleString()}</span>
                            </div>

                            {/* EMV Chip */}
                            <div className="w-9 h-7 rounded bg-gradient-to-br from-yellow-200 via-yellow-300 to-yellow-400 border border-yellow-500/30 shadow-inner relative group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
                              <div className="absolute inset-0.5 rounded-sm border border-yellow-600/20"></div>
                              <div className="absolute inset-0 rounded bg-gradient-to-br from-transparent to-yellow-600/10"></div>
                            </div>
                          </div>
                        </div>

                        {/* Middle: Card Number */}
                        <div className="flex-1 flex flex-col justify-center">
                          <div className="flex items-center justify-between -mt-3">
                            <span className={`text-xs font-medium ${isBlackCard ? 'text-white/70' : 'text-gray-500'} uppercase tracking-wider transition-colors duration-300`}>Card Number</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCardDetails(card.id);
                              }}
                              className={`h-5 w-7 p-0 ${isBlackCard ? 'text-white/60 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'} rounded-full cursor-pointer hover:scale-110 transition-all duration-300`}
                            >
                              {showCardDetails[card.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          </div>
                          <p className={`font-mono text-xl font-bold tracking-[0.15em] ${isBlackCard ? 'text-white' : 'text-gray-800'} drop-shadow-sm group-hover:scale-105 transition-all duration-300`}>
                            {formatCardNumber(
                              showCardDetails[card.id] ? card.card_number : card.masked_card_number,
                              showCardDetails[card.id]
                            )}
                          </p>
                        </div>

                        {/* Bottom Row: Name, Expiry, CVV */}
                        <div className="flex items-end justify-between mt-auto pt-3">
                          <div className="space-y-1 flex-1 min-w-0 pr-3">
                            <p className={`text-xs font-medium ${isBlackCard ? 'text-white/70' : 'text-gray-500'} uppercase tracking-wider transition-colors duration-300`}>Cardholder Name</p>
                            <p className={`font-semibold text-sm uppercase tracking-wide ${isBlackCard ? 'text-white' : 'text-gray-900'} drop-shadow-sm group-hover:scale-105 transition-transform duration-300 leading-tight`}>
                              {card.holder_name.length > 18 ? card.holder_name.substring(0, 18) + '...' : card.holder_name}
                            </p>
                          </div>

                          <div className="flex gap-4 items-end">
                            <div className="space-y-1 text-center min-w-0 group-hover:scale-105 transition-transform duration-300">
                              <p className={`text-xs font-medium ${isBlackCard ? 'text-white/70' : 'text-gray-500'} uppercase tracking-wider transition-colors duration-300`}>Expires</p>
                              <p className={`font-mono font-bold text-sm ${isBlackCard ? 'text-white' : 'text-gray-900'} drop-shadow-sm`}>
                                {card.expiry_date}
                              </p>
                            </div>

                            {showCardDetails[card.id] && (
                              <div className="space-y-1 text-center min-w-0 group-hover:scale-105 transition-transform duration-300">
                                <p className={`text-xs font-medium ${isBlackCard ? 'text-white/70' : 'text-gray-500'} uppercase tracking-wider transition-colors duration-300`}>CVV</p>
                                <p className={`font-mono font-bold text-sm ${isBlackCard ? 'text-white' : 'text-gray-900'} drop-shadow-sm ${isBlackCard ? 'bg-black/30' : 'bg-gray-100'} px-2 py-1 rounded transition-colors duration-300`}>
                                  {card.cvv}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Magnetic Stripe */}
                      <div className="absolute left-0 top-12 w-full h-7 bg-black/50 opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
                    </div>

                    {/* Enhanced Card Reflection */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/10 to-transparent opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity duration-500"></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Light theme Empty States */}
        {filteredCards.length === 0 && cards.length > 0 && (
          <div className="text-center py-16">
            <div className="wise-card max-w-md mx-auto p-8">
              <CreditCard className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No matching cards found
              </h3>
              <p className="wise-text-sm">
                No cards match your search for "{debouncedSearchTerm}"
              </p>
            </div>
          </div>
        )}
      </TooltipProvider>
    </div>
  );
}