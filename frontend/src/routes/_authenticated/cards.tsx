import { useState, useEffect } from 'react';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';

import { AppNavbar } from '@/components/app-navbar';
import { Main } from '@/components/layout/main';
import { CreditCardsTable } from '@/features/dashboard/components/credit-cards-table';
import { CardRequestsList } from '@/features/dashboard/components/card-requests-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/hooks/use-wallet';

function CreditCards() {
  const { makeAuthenticatedRequest, isAuthenticated, isLoadingWallet } = useWallet();
  const [activeTab, setActiveTab] = useState('cards');
  const router = useRouter();

  // Query for card requests to show badge count
  const { data: cardRequestsData } = useQuery({
    queryKey: ['card-requests', isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated) return { cardRequests: [] };
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(`${baseUrl}/api/card-requests`);
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Query for credit cards to show badge count
  const { data: cardsData } = useQuery({
    queryKey: ['credit-cards', isAuthenticated],
    queryFn: async () => {
      if (!isAuthenticated) return { cards: [] };

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      return await makeAuthenticatedRequest(`${baseUrl}/api/cards`);
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Redirect to homepage if user becomes unauthenticated (e.g., disconnects wallet)
  useEffect(() => {
    if (!isLoadingWallet && !isAuthenticated) {
      router.navigate({ to: '/' });
    }
  }, [isAuthenticated, isLoadingWallet, router]);

  // Listen for switch to cards tab event from notifications
  useEffect(() => {
    const handleSwitchToCardsTab = () => {
      setActiveTab('cards');
    };

    window.addEventListener('switchToCardsTab', handleSwitchToCardsTab);
    return () => {
      window.removeEventListener('switchToCardsTab', handleSwitchToCardsTab);
    };
  }, []);

  // Show loading state while checking authentication
  if (isLoadingWallet) {
    return (
      <>
        <AppNavbar />
        <Main>
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grey-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </Main>
      </>
    );
  }

  // Don't render the page if not authenticated (redirect will happen via useEffect)
  if (!isAuthenticated) {
    return null;
  }

  const pendingRequestsCount = cardRequestsData?.cardRequests?.filter((req: { status: string }) => req.status === 'pending').length || 0;
  const activeCardsCount = cardsData?.cards?.filter((card: { status: string }) => card.status === 'active').length || 0;

  return (
    <>
      <AppNavbar />
      
      <Main>
        <div className="max-w-6xl mx-auto py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="cards" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span>My Cards</span>
                {activeCardsCount > 0 && (
                  <Badge variant="default" className="ml-1 bg-black text-white">
                    {activeCardsCount}
                  </Badge>
                )}
                
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Card Requests</span>
                {pendingRequestsCount > 0 && (
                  <Badge variant="default" className="ml-1 bg-black text-white">
                    {pendingRequestsCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cards" className="space-y-6">
              <CreditCardsTable />
            </TabsContent>

            <TabsContent value="requests" className="space-y-6">
              <CardRequestsList />
            </TabsContent>
          </Tabs>
        </div>
      </Main>
    </>
  );
}

export const Route = createFileRoute('/_authenticated/cards')({
  beforeLoad: () => {
    // Check if user has an auth token before loading the route
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw redirect({ to: '/' });
    }
  },
  component: CreditCards,
});
