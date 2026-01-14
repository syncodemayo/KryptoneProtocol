import { useState } from 'react';

import { useWalletModal } from '@solana/wallet-adapter-react-ui';

import {
  Loader2,
  Shield,
  Wallet,
  CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useWallet } from '@/hooks/use-wallet';

import { WalletsModal } from './wallets-modal';

export function ConnectWallet() {
  const {
    isAuthenticated,
    isAuthenticating,
    authenticateWallet,
    walletInfo,
    isLoadingWallet,
    isConnected,
  } = useWallet();
  const { setVisible } = useWalletModal();
  const [showWalletsModal, setShowWalletsModal] = useState(false);

  const handleConnectClick = () => {
    setVisible(true);
  };

  return (
    <>
      <div className="flex gap-2">
        {!isConnected ? (
          // Black and white connect wallet button
          <Button 
            onClick={handleConnectClick}
            className="bg-black hover:bg-gray-900 text-white font-semibold px-6 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200"
          >
            <Wallet className="h-4 w-4" />
            <span>Connect Wallet</span>
          </Button>
        ) : (
          <>
            {/* Show authentication button when connected but not authenticated */}
            {!isAuthenticated && (
              <Button
                onClick={authenticateWallet}
                type="button"
                disabled={isAuthenticating}
                size="sm"
                className="flex items-center gap-2 bg-black hover:bg-gray-900 text-white px-4 py-2 text-sm font-medium"
              >
                {isAuthenticating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                <span>
                  {isAuthenticating ? 'Signing...' : 'Sign In'}
                </span>
              </Button>
            )}

            {/* Authenticated state - success indicator */}
            {isAuthenticated && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg">
                <CheckCircle className="h-4 w-4 text-black" />
                <span className="text-sm font-medium text-gray-900">Connected</span>
              </div>
            )}
          </>
        )}
      </div>

      <WalletsModal
        isOpen={showWalletsModal}
        onClose={() => setShowWalletsModal(false)}
        walletInfo={walletInfo}
        isLoadingWallet={isLoadingWallet}
      />
    </>
  );
}
