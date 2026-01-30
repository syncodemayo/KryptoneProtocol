import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import bs58 from 'bs58';
import { API_BASE_URL } from '@/lib/config';
import { authService } from '@/lib/auth-service';

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
  register: (type: UserType) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isInitializing: boolean;
  isRegistered: boolean | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { publicKey, signMessage, disconnect, connecting } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

  // Load session from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('shadowpay_user');
    const token = localStorage.getItem('shadowpay_token');
    
    // Clear stale session if token is literally "null" or "undefined"
    if (token === 'null' || token === 'undefined') {
      localStorage.removeItem('shadowpay_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('shadowpay_user');
      setIsInitializing(false);
      return;
    }

    if (storedUser && token) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        authService.setToken(token);
      } catch (e) {
        console.error('Failed to parse stored user', e);
        localStorage.removeItem('shadowpay_user');
      }
      setIsInitializing(false);
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
                // Re-hydrate user object from backend info
                const rehydratedUser: User = {
                    address: userData.solanaAddress,
                    name: userData.shadowPay.userType || 'User',
                    type: (userData.shadowPay.userType?.toLowerCase() === 'seller' ? 'seller' : 'buyer') as UserType,
                };
                setUser(rehydratedUser);
                setIsAuthenticated(true);
                authService.setToken(token);
                localStorage.setItem('shadowpay_user', JSON.stringify(rehydratedUser));
            }
        })
        .catch(() => {
            localStorage.removeItem('shadowpay_token');
        })
        .finally(() => {
            setIsInitializing(false);
        });
    } else {
        setIsInitializing(false);
    }
  }, []);

  // Handle wallet disconnection
  useEffect(() => {
    // Only logout if we ARE NOT connecting, and have NO publicKey, but think we ARE authenticated.
    // This happens when a user explicitly disconnects or the session is stale.
    // Adding a small delay to allow wallet adapter to stabilize on refresh
    if (!connecting && !publicKey && isAuthenticated) {
      const timeout = setTimeout(() => {
        if (!publicKey && !connecting) {
          console.log('[AuthContext] Wallet disconnected, logging out');
          logout();
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [publicKey, isAuthenticated, connecting]);

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

      const data = await loginResponse.json();
      if (!loginResponse.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      const { token } = data;

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
      localStorage.setItem('auth_token', token);
      authService.setToken(token);
      localStorage.setItem('shadowpay_user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      setIsAuthenticated(true);
      toast.success('Authentication successful!');

      // Redirect based on role
      if (loggedInUser.type === 'seller') {
        navigate('/trades');
      } else {
        navigate('/market');
      }

    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(`Login failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (type: UserType) => {
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
      
      const loginData = await loginResponse.json();
      if (!loginResponse.ok) {
        throw new Error(loginData.error || 'Authentication failed');
      }
      const { token } = loginData;
      localStorage.setItem('shadowpay_token', token);
      localStorage.setItem('auth_token', token);
      authService.setToken(token);

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
      if (!regResponse.ok) {
          throw new Error(data.error || 'Failed to register with ShadowPay');
      }

      const newUser: User = {
        address: publicKey.toBase58(),
        name: data.message?.includes('already registered') ? (user?.name || 'User') : 'User',
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
          navigate('/trades');
      } else {
          navigate('/market');
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
    authService.logout();
    authService.setToken(null);
    disconnect();
    toast.success('Logged out');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, logout, isLoading, isInitializing, isRegistered }}>
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
