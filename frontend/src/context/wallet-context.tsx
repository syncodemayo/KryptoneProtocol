import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';

import {
    useConnection,
    useWallet as useSolanaWallet,
} from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import type { AxiosRequestConfig } from 'axios';
import bs58 from 'bs58';
import { toast } from 'sonner';

import { type WalletInfo, authService } from '@/lib/auth-service';

interface WalletContextType {
    address: string | undefined;
    isConnected: boolean;
    chainId: string;
    balance: { formatted: string; symbol: string } | null;
    isAuthenticated: boolean;
    isAuthenticating: boolean;
    walletInfo: WalletInfo | null;
    isLoadingWallet: boolean;
    error: string | null;
    showAuthPrompt: boolean;
    disconnect: () => void;
    openConnectModal: () => void;
    openAccountModal: () => void;
    openChainModal: () => void;
    makeAuthenticatedRequest: (url: string, options?: AxiosRequestConfig) => Promise<any>;
    fetchWalletInfo: () => Promise<void>;
    authenticateWallet: () => Promise<void>;
    formattedBalance: string;
    shortAddress: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const {
        publicKey,
        connected,
        disconnect: solanaDisconnect,
        signMessage,
    } = useSolanaWallet();
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();

    const address = publicKey?.toString();
    const [balance, setBalance] = useState<number | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
    const [isLoadingWallet, setIsLoadingWallet] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const authAttempts = useRef(new Set<string>());
    const authTimeout = useRef<NodeJS.Timeout | null>(null);

    // Initialize auth state
    useEffect(() => {
        try {
            const authenticated = authService.isAuthenticated();
            setIsAuthenticated(authenticated);
            if (authenticated && address) {
                authAttempts.current.add(address);
            }
        } catch (_err) {
            setIsAuthenticated(false);
        }
    }, [address]);

    const fetchBalance = useCallback(async () => {
        if (!publicKey || !connection) return;
        try {
            const balance = await connection.getBalance(publicKey);
            setBalance(balance / LAMPORTS_PER_SOL);
        } catch (_err) {
            setBalance(null);
        }
    }, [publicKey, connection]);

    useEffect(() => {
        if (connected && publicKey) {
            fetchBalance();
            const balanceInterval = setInterval(fetchBalance, 30000);
            return () => clearInterval(balanceInterval);
        } else {
            setBalance(null);
        }
    }, [connected, publicKey, fetchBalance]);

    const fetchWalletInfo = useCallback(async () => {
        if (!authService.isAuthenticated()) {
            setWalletInfo(null);
            setIsAuthenticated(false);
            return;
        }

        setIsLoadingWallet(true);
        try {
            const freshWalletInfo = await authService.fetchWalletInfo();
            setWalletInfo(freshWalletInfo);
            setIsAuthenticated(true);
            setError(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch wallet info';
            if (errorMessage.includes('Session expired') || errorMessage.includes('No authentication token') || errorMessage.includes('Unauthorized')) {
                setIsAuthenticated(false);
                setWalletInfo(null);
                authService.logout();
                if (address) authAttempts.current.add(address);
            }
            setError(errorMessage);
        } finally {
            setIsLoadingWallet(false);
        }
    }, [address]);

    const authenticateWallet = useCallback(async () => {
        if (!connected || !address || !signMessage) {
            toast.error('Please connect your wallet first');
            return;
        }

        setIsAuthenticating(true);
        setError(null);

        try {
            const walletExists = await authService.checkWalletExists(address);
            if (!walletExists) {
                await authService.createWallet(address);
                toast.success('Wallet created successfully!');
            }

            const message = authService.generateAuthMessage(address);
            const messageBytes = new TextEncoder().encode(message);

            toast.info('Please sign the message to authenticate', { duration: 5000 });

            const signature = await signMessage(messageBytes);
            const signatureBase58 = bs58.encode(signature);

            await authService.authenticateWithSignature(address, signatureBase58, message);

            setIsAuthenticated(true);
            toast.success('Authenticated successfully!');
            authAttempts.current.add(address);

            const freshWalletInfo = await authService.fetchWalletInfo();
            setWalletInfo(freshWalletInfo);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
            if (errorMessage.includes('User rejected')) {
                toast.error('Authentication cancelled');
                authAttempts.current.add(address);
            } else {
                toast.error(`Authentication failed: ${errorMessage}`);
            }
            setError(errorMessage);
        } finally {
            setIsAuthenticating(false);
        }
    }, [connected, address, signMessage]);

    useEffect(() => {
        if (!connected || !address || !signMessage) return;

        if (isAuthenticated) {
            if (!walletInfo && !isLoadingWallet) {
                console.log('Fetching wallet info for authenticated session:', address);
                fetchWalletInfo();
            }
            return;
        }

        if (authService.isAuthenticated()) {
            setIsAuthenticated(true);
            authAttempts.current.add(address);
            fetchWalletInfo();
            return;
        }

        if (authAttempts.current.has(address) || isAuthenticating) return;

        if (authTimeout.current) clearTimeout(authTimeout.current);
        authTimeout.current = setTimeout(() => {
            if (!connected || !address || isAuthenticated || isAuthenticating || authAttempts.current.has(address)) return;
            console.log('Auto-authenticating for address:', address);
            authenticateWallet();
        }, 1500);

        return () => { if (authTimeout.current) clearTimeout(authTimeout.current); };
    }, [connected, address, signMessage, isAuthenticated, isAuthenticating, walletInfo, isLoadingWallet, fetchWalletInfo, authenticateWallet]);

    useEffect(() => {
        if (!connected) {
            setIsAuthenticated(false);
            setWalletInfo(null);
            setIsAuthenticating(false);
            setError(null);
        }
    }, [connected]);

    const handleLogout = useCallback(() => {
        authService.logout();
        setIsAuthenticated(false);
        setWalletInfo(null);
        if (address) authAttempts.current.add(address);
        solanaDisconnect();
    }, [solanaDisconnect, address]);

    const makeAuthenticatedRequest = async (url: string, options: AxiosRequestConfig = {}) => {
        if (!authService.isAuthenticated()) {
            setIsAuthenticated(false);
            throw new Error('Please authenticate first');
        }
        try {
            return await authService.makeAuthenticatedRequest(url, options);
        } catch (error) {
            if (error instanceof Error && (error.message.includes('Session expired') || error.message.includes('Unauthorized'))) {
                setIsAuthenticated(false);
                setWalletInfo(null);
                if (address) authAttempts.current.add(address);
            }
            throw error;
        }
    };

    const value = {
        address,
        isConnected: connected,
        chainId: 'solana-mainnet',
        balance: balance ? { formatted: balance.toFixed(4), symbol: 'SOL' } : null,
        isAuthenticated,
        isAuthenticating,
        walletInfo,
        isLoadingWallet,
        error,
        showAuthPrompt: connected && !isAuthenticated,
        disconnect: handleLogout,
        openConnectModal: () => setVisible(true),
        openAccountModal: () => { },
        openChainModal: () => { },
        makeAuthenticatedRequest,
        fetchWalletInfo,
        authenticateWallet,
        formattedBalance: balance ? `${balance.toFixed(4)} SOL` : '0.0000 SOL',
        shortAddress: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
    };

    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}
