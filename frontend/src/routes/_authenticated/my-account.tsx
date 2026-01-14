import { useEffect } from 'react';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';

import { AppNavbar } from '@/components/app-navbar';
import { Main } from '@/components/layout/main';
import { MyAccount } from '@/features/dashboard/components/my-account';
import { useWallet } from '@/hooks/use-wallet';

function MyAccountPage() {
  const { isAuthenticated, isLoadingWallet } = useWallet();
  const router = useRouter();

  // Redirect to homepage if user becomes unauthenticated (e.g., disconnects wallet)
  useEffect(() => {
    if (!isLoadingWallet && !isAuthenticated) {
      router.navigate({ to: '/' });
    }
  }, [isAuthenticated, isLoadingWallet, router]);

  // Show loading state while checking authentication
  if (isLoadingWallet) {
    return (
      <>
        <AppNavbar />
        <Main>
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
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

  return (
    <>
      {/* ===== Unified Navigation ===== */}
      <AppNavbar />

      {/* ===== Main ===== */}
      <Main>
        <div className="space-y-4">
          <MyAccount />
        </div>
      </Main>
    </>
  );
}

export const Route = createFileRoute('/_authenticated/my-account')({
  beforeLoad: () => {
    // Check if user has an auth token before loading the route
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw redirect({ to: '/' });
    }
  },
  component: MyAccountPage,
});
