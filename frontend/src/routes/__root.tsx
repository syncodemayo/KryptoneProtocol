import { type QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';

import { NavigationProgress } from '@/components/navigation-progress';
import { Toaster } from '@/components/ui/sonner';
import { GeneralError } from '@/features/errors/general-error';
import { NotFoundError } from '@/features/errors/not-found-error';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => {
    return (
      <>
        <NavigationProgress />
        <Outlet />

        {/* Professional banking-style toaster */}
        <Toaster
          duration={5000}
          toastOptions={{
            style: {
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '12px',
              color: '#1e293b',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.1)',
            },
          }}
        />

        {import.meta.env.MODE === 'development' && (
          <>
            <ReactQueryDevtools buttonPosition="bottom-left" />
            <TanStackRouterDevtools position="bottom-right" />
          </>
        )}
      </>
    );
  },
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
});
