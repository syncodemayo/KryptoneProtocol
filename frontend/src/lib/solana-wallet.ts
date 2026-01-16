import { useMemo } from 'react';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import '@solana/wallet-adapter-react-ui/styles.css';
import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// You can also provide a custom RPC endpoint
// eslint-disable-next-line react-hooks/rules-of-hooks
const endpoint = useMemo(() => clusterApiUrl(WalletAdapterNetwork.Mainnet), []);

// Default styles that can be overridden by your app

export const SolanaWalletConfig = {
  network: WalletAdapterNetwork.Mainnet,
  endpoint,
  wallets: [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new TorusWalletAdapter(),
    new LedgerWalletAdapter(),
  ],
};

// Solana theme configuration
export const solanaWalletTheme = {
  lightMode: {
    accentColor: '#000000',
    accentColorForeground: 'white',
    borderRadius: 'medium',
    fontStack: 'system',
  },
  darkMode: {
    accentColor: '#ffffff',
    accentColorForeground: 'black',
    borderRadius: 'medium',
    fontStack: 'system',
  },
} as const;
