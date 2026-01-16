import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';

// Mock User Type
export type UserType = 'buyer' | 'seller';

export interface User {
  address: string;
  name: string;
  type: UserType;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: () => Promise<void>;
  register: (name: string, type: UserType) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, disconnect } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load user from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('shadowpay_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  // Handle wallet connection & auto-login
  useEffect(() => {
    if (publicKey) {
        const storedUserKey = `user_${publicKey.toBase58()}`;
        const storedUser = localStorage.getItem(storedUserKey);
        
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
            localStorage.setItem('shadowpay_user', storedUser); // Set current session
        }
    } else if (isAuthenticated) {
      logout();
    }
  }, [publicKey]);

  const login = async () => {
    if (!publicKey) {
      toast.error('Wallet not connected');
      return;
    }

    setIsLoading(true);
    try {
      const message = new TextEncoder().encode(
        `Login to ShadowPay. Address: ${publicKey.toBase58()}. Nonce: ${Date.now()}`
      );
      
      try {
          if (signMessage) {
            await signMessage(message);
          } else {
            throw new Error('Wallet does not support message signing');
          }
      } catch (signError: any) {
          toast.warning('Wallet signing failed. Proceeding with mock authentication for demo.');
      }
      
      const storedUser = localStorage.getItem(`user_${publicKey.toBase58()}`);
      
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('shadowpay_user', JSON.stringify(userData));
        toast.success('Welcome back!');
      } else {
        toast.info('Please create an account to continue');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(`Login failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, type: UserType) => {
    if (!publicKey) {
      toast.error('Wallet not connected');
      return;
    }

    setIsLoading(true);
    try {
      const message = new TextEncoder().encode(
        `Create ShadowPay Account for ${name} (${type}). Address: ${publicKey.toBase58()}`
      );

      try {
          if (signMessage) {
            await signMessage(message);
          } else {
             throw new Error('Wallet does not support message signing');
          }
      } catch (signError: any) {
          toast.warning('Wallet signing failed. Proceeding with mock authentication for demo.');
      }

      const newUser: User = {
        address: publicKey.toBase58(),
        name,
        type,
      };

      if (type === 'seller') {
          const sellers = JSON.parse(localStorage.getItem('shadowpay_sellers') || '[]');
          if (!sellers.find((s: any) => s.address === newUser.address)) {
              sellers.push(newUser);
              localStorage.setItem('shadowpay_sellers', JSON.stringify(sellers));
          }
      }

      localStorage.setItem(`user_${publicKey.toBase58()}`, JSON.stringify(newUser));
      localStorage.setItem('shadowpay_user', JSON.stringify(newUser));
      setUser(newUser);
      setIsAuthenticated(true);
      toast.success('Account created successfully!');

    } catch (error: any) {
      console.error('Registration failed:', error);
      toast.error(`Registration failed: ${error.message || 'Check wallet console'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('shadowpay_user');
    disconnect();
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
