import { createFileRoute, redirect } from '@tanstack/react-router';

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

// Dynamic authentication checker function
const checkAuthentication = () => {
  // Check for auth token
  const token = localStorage.getItem('auth_token');
  
  // If no token, redirect to landing page
  if (!token) {
    throw redirect({ to: '/' });
  }
  
  // Additional validation could be added here
  // For example, checking token expiry, format, etc.
};

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: checkAuthentication,
  component: AuthenticatedLayout,
});
