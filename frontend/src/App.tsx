import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/layout';
import { LandingPage } from '@/pages/landing-page';
import { SellersPage } from '@/pages/sellers-page';
import { TradesPage } from '@/pages/trades-page';
import { TradeDetailPage } from '@/pages/trade-detail-page';
import { ConversationsPage } from '@/pages/conversations-page';
import { ChatPage } from '@/pages/chat-page';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { RegistrationModal } from '@/components/modals/registration-modal';
import { Toaster } from 'sonner';

function AppContent() {
  const { isAuthenticated, user, isInitializing } = useAuth();
  
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          
          <Route path="/market" element={
            isAuthenticated ? (
              user?.type === 'seller' ? <Navigate to="/trades" /> : <SellersPage />
            ) : <Navigate to="/" />
          } />
          
          
          <Route path="/conversations" element={
            isAuthenticated ? <ConversationsPage /> : <Navigate to="/" />
          } />
          
          <Route path="/chat/:id" element={
             isAuthenticated ? <ChatPage /> : <Navigate to="/" />
          } />

          <Route path="/trades" element={
            isAuthenticated ? <TradesPage /> : <Navigate to="/" />
          } />

          <Route path="/trades/:id" element={
            isAuthenticated ? <TradeDetailPage /> : <Navigate to="/" />
          } />
        </Routes>
        <RegistrationModal />
        <Toaster position="top-center" />
      </Layout>
    );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
