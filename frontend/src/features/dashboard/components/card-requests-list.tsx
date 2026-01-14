import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, CreditCard, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/use-wallet';

interface CardRequest {
  id: string;
  transaction_signature: string;
  amount_sol: number;
  amount_usd: number;
  requested_card_type: string;
  requested_credit_limit: number;
  status: 'pending' | 'completed' | 'failed';
  estimated_ready_time: string;
  created_at: string;
  processed_at?: string;
  assigned_card_id?: string;
}

interface CardRequestsResponse {
  cardRequests: CardRequest[];
}

export function CardRequestsList() {
  const { makeAuthenticatedRequest, isAuthenticated } = useWallet();

  const { data, isLoading, error } = useQuery({
    queryKey: ['card-requests', isAuthenticated],
    queryFn: async (): Promise<CardRequestsResponse> => {
      if (!isAuthenticated) {
        return { cardRequests: [] };
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(`${baseUrl}/api/card-requests`);
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCardType = (type: string) => {
    switch (type) {
      case 'visa': return 'Visa';
      case 'mastercard': return 'Mastercard';
      case 'american-express': return 'American Express';
      default: return type;
    }
  };

  // Track completed requests to show notifications
  useEffect(() => {
    const cardRequests = data?.cardRequests || [];
    const completedRequests = cardRequests.filter(req => req.status === 'completed');
    
    // Check if we have any newly completed requests
    completedRequests.forEach(request => {
      const notificationKey = `card-request-${request.id}`;
      const shownKey = `card-request-shown-${request.id}`;
      
      // Only show notification if we haven't shown it before for this request
      if (!localStorage.getItem(notificationKey) && !sessionStorage.getItem(shownKey)) {
        toast.success(
          `🎉 Your ${formatCardType(request.requested_card_type)} Card is Ready!`,
          {
            description: `Credit limit: $${request.requested_credit_limit.toLocaleString()} • Click to view your new card`,
            duration: 8000,
            action: {
              label: "View Card",
              onClick: () => {
                // Switch to the cards tab if we're on the same page
                const event = new CustomEvent('switchToCardsTab');
                window.dispatchEvent(event);
              },
            },
          }
        );
        
        // Mark this notification as shown (use both localStorage and sessionStorage for redundancy)
        localStorage.setItem(notificationKey, 'shown');
        sessionStorage.setItem(shownKey, 'shown');
      }
    });
  }, [data, formatCardType]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-gray-400';
      case 'pending': return 'bg-gray-600';
      case 'failed': return 'bg-gray-800';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatTime = (timeString: string) => {
    const time = new Date(timeString);
    const now = new Date();
    const diffMinutes = Math.ceil((time.getTime() - now.getTime()) / (1000 * 60));

    if (diffMinutes <= 0) {
      return 'Ready for processing';
    } else if (diffMinutes <= 60) {
      return `Ready in ~${diffMinutes} minutes`;
    } else {
      return time.toLocaleDateString() + ' ' + time.toLocaleTimeString();
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-black" />
          <h2 className="text-xl font-semibold text-gray-900">Card Requests</h2>
        </div>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-black" />
          <h2 className="text-xl font-semibold text-gray-900">Card Requests</h2>
        </div>
        <p className="text-sm text-gray-700">Failed to load card requests</p>
      </div>
    );
  }

  const cardRequests = data.cardRequests || [];

  if (cardRequests.length === 0) {
    return null; // Don't show the component if there are no requests
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {cardRequests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full silver-accent">
                <CreditCard className="h-4 w-4 text-black" />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {formatCardType(request.requested_card_type)}
                  </span>
                  <Badge className="text-xs badge-silver">
                    ${request.requested_credit_limit.toLocaleString()} limit
                  </Badge>
                </div>
                
                <div className="text-sm text-gray-600">
                  {request.amount_sol} SOL • {new Date(request.created_at).toLocaleDateString()}
                </div>
                
                {request.status === 'pending' && (
                  <div className="text-xs text-gray-700 mt-1">
                    {formatTime(request.estimated_ready_time)}
                  </div>
                )}
                
                {request.status === 'completed' && request.processed_at && (
                  <div className="text-xs text-gray-700 mt-1">
                    Completed on {new Date(request.processed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge 
                className={`${getStatusColor(request.status)} text-white text-xs border-0`}
              >
                {getStatusIcon(request.status)}
                <span className="ml-1 capitalize">{request.status}</span>
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`https://solscan.io/tx/${request.transaction_signature}`, '_blank')}
                className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-600 hover:text-black"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}