import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/layout';
import { LandingPage } from '@/pages/landing-page';
import { SellersPage } from '@/pages/sellers-page';
import { ChatPage } from '@/pages/chat-page';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { RegistrationModal } from '@/components/modals/registration-modal';

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={
            isAuthenticated && user?.type === 'buyer' ? <Navigate to="/market" /> : <LandingPage />
          } />
          
          <Route path="/market" element={
            isAuthenticated ? <SellersPage /> : <Navigate to="/" />
          } />
          
          <Route path="/chat/:id" element={
             isAuthenticated ? <ChatPage /> : <Navigate to="/" />
          } />
        </Routes>
        <RegistrationModal />
      </Layout>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
