import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import bs58 from 'bs58';
import { API_BASE_URL } from '@/lib/config';

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
  isRegistered: boolean | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, disconnect } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

  // Load session from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('shadowpay_user');
    const token = localStorage.getItem('shadowpay_token');
    
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    } else if (token) {
        // Attempt to re-hydrate user from token if missing in local storage
        fetch(`${API_BASE_URL}/api/user/info`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => {
            if (res.ok) return res.json();
            throw new Error('Invalid token');
        })
        .then(userData => {
            if (userData && userData.shadowPay) {
                // We need the address from the wallet adapter generally, but if wallet is not connected yet,
                // we might need to rely on what the backend thinks or wait for wallet.
                // However, without publicKey, we can't fully restore 'User' object as defined.
                // But wait, the token implies we verified the address.
                // We can't easily get the address from the backend /api/user/info IF it doesn't return it?
                // api/user/info returns { success: true, shadowPay: { ... } }
                // Let's assume shadowPay has the address or we can infer it?
                // We should probably rely on wallet adapter reconnection too?
            }
        })
        .catch(() => {
            // failed, clear token
            localStorage.removeItem('shadowpay_token');
        });
    }
  }, []);

  // Handle wallet disconnection - REMOVED to prevent logout on page refresh
  // useEffect(() => {
  //   if (!publicKey && isAuthenticated) {
  //     logout();
  //   }
  // }, [publicKey]);

  // Check registration status when wallet connects
  useEffect(() => {
    const checkStatus = async () => {
      if (publicKey && !isAuthenticated) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/message?solanaAddress=${publicKey.toBase58()}`);
          if (response.ok) {
            const data = await response.json();
            setIsRegistered(data.isRegistered);
          } else {
            console.error('Failed to check registration status, defaulting to new user');
            setIsRegistered(false);
          }
        } catch (error) {
          console.error('Error checking registration status:', error);
          setIsRegistered(false);
        }
      } else if (!publicKey) {
        setIsRegistered(null);
      }
    };
    
    checkStatus();
  }, [publicKey, isAuthenticated]);

  const login = async () => {
    if (!publicKey || !signMessage) {
      toast.error('Wallet not connected or does not support signing');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Get auth message from backend
      const msgResponse = await fetch(`${API_BASE_URL}/api/auth/message?solanaAddress=${publicKey.toBase58()}`);
      if (!msgResponse.ok) throw new Error('Failed to get auth message');
      const { message } = await msgResponse.json();

      // 2. Sign message
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);

      // 3. Login with backend
      const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solanaAddress: publicKey.toBase58(),
          signature: signatureBase58,
          message,
        }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const { token } = await loginResponse.json();

      // 4. Fetch user info with the new token
      const userResponse = await fetch(`${API_BASE_URL}/api/user/info`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const userData = await userResponse.json();
      
      const loggedInUser: User = {
        address: publicKey.toBase58(),
        name: userData.shadowPay?.userType || 'User',
        type: (userData.shadowPay?.userType?.toLowerCase() === 'seller' ? 'seller' : 'buyer') as UserType,
      };

      // 5. Store session
      localStorage.setItem('shadowpay_token', token);
      localStorage.setItem('shadowpay_user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      setIsAuthenticated(true);
      toast.success('Authentication successful!');

      // Redirect based on role
      if (loggedInUser.type === 'seller') {
        window.location.href = '/trades';
      } else {
        window.location.href = '/market';
      }

    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(`Login failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, type: UserType) => {
    if (!publicKey || !signMessage) {
      toast.error('Wallet not connected');
      return;
    }

    setIsLoading(true);
    try {
      // 1. First ensure we are authenticated with backend
      const msgResponse = await fetch(`${API_BASE_URL}/api/auth/message?solanaAddress=${publicKey.toBase58()}`);
      const { message } = await msgResponse.json();
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);

      const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solanaAddress: publicKey.toBase58(),
          signature: signatureBase58,
          message,
        }),
      });
      
      const { token } = await loginResponse.json();
      localStorage.setItem('shadowpay_token', token);

      // 2. Register with ShadowPay
      const regResponse = await fetch(`${API_BASE_URL}/api/user/register-shadowpay`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userType: type === 'seller' ? 'Seller' : 'Buyer',
          signature: signatureBase58,
          message: message,
        }),
      });

      const data = await regResponse.json();

      const newUser: User = {
        address: publicKey.toBase58(),
        name: data.message?.includes('already registered') ? (user?.name || name) : name,
        type: type,
      };

      localStorage.setItem('shadowpay_user', JSON.stringify(newUser));
      setUser(newUser);
      setIsAuthenticated(true);
      
      if (data.message?.includes('already registered')) {
          toast.info('You are already registered. Welcome back!');
      } else {
          toast.success('Account created successfully!');
      }

      // Redirect based on role
      if (newUser.type === 'seller') {
          window.location.href = '/trades';
      } else {
          window.location.href = '/market';
      }

    } catch (error: any) {
      console.error('Registration failed:', error);
      toast.error(`Registration failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('shadowpay_user');
    localStorage.removeItem('shadowpay_token');
    disconnect();
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, logout, isLoading, isRegistered }}>
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
