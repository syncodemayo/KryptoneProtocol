import React, { useMemo } from 'react';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

interface SolanaWalletProviderProps {
  children: React.ReactNode;
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  // Use mainnet for production, devnet for development
  const network = import.meta.env.PROD ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;

  // Configure proper RPC endpoints
  const endpoint = useMemo(() => {
    // Try environment variable first
    if (import.meta.env.VITE_SOLANA_RPC_URL) {
      return import.meta.env.VITE_SOLANA_RPC_URL;
    }
    
    // Use appropriate cluster URL based on environment
    if (import.meta.env.PROD) {
      // For production, use a reliable mainnet RPC
      return 'https://solana-mainnet.g.alchemy.com/v2/b5pBorNHFCYUfnu4Fcp8T';
    } else {
      // For development, use devnet
      return clusterApiUrl(WalletAdapterNetwork.Devnet);
    }
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
