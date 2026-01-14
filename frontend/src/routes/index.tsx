import { useEffect } from 'react';
import { useNavigate, createFileRoute } from '@tanstack/react-router';


import { useWallet } from '@/hooks/use-wallet';
import { LandingPage } from '@/components/landing-page';

function IndexPage() {
  const { isLoadingWallet, isConnected, isAuthenticated, isAuthenticating, address } = useWallet();
  const navigate = useNavigate();

  // Debug logging
  console.log('IndexPage render:', {
    isLoadingWallet,
    isConnected,
    isAuthenticated,
    isAuthenticating,
    address,
    hasToken: !!localStorage.getItem('auth_token')
  });

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoadingWallet && !isAuthenticating) {
      navigate({ to: '/cards' });
    }
  }, [isAuthenticated, isLoadingWallet, isAuthenticating, navigate]);
  // Show landing page for unauthenticated users
  return <LandingPage />;
}

export const Route = createFileRoute('/')({
  component: IndexPage,
});