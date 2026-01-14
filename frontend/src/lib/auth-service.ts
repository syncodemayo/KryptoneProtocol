import axios, { type AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface AuthResponse {
  walletInfo: WalletInfo;
  token: string;
}

export interface WalletInfo {
  solana: {
    address: string;
    balance: {
      sol: {
        balance: string;
        symbol: string;
        mint: string;
        decimals: number;
      };
      usdc?: {
        balance: string;
        symbol: string;
        mint: string;
        decimals: number;
      };
      usdt?: {
        balance: string;
        symbol: string;
        mint: string;
        decimals: number;
      };
    };
  };
  isConnected: boolean;
  createdAt: string;
}

// Legacy interface for backward compatibility
export interface LegacyWalletInfo {
  solanaAddress: string;
  solanaBalance: string;
  usdcBalance: string;
}

class AuthService {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage with validation
    try {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken && typeof storedToken === 'string' && storedToken.length > 10) {
        // Basic token format validation
        const parts = storedToken.split('.');
        if (parts.length === 3) {
          this.token = storedToken;
        } else {
          console.log('Invalid token format in localStorage, clearing...');
          localStorage.removeItem('auth_token');
        }
      }
    } catch (error) {
      console.error('Error loading token from localStorage:', error);
      localStorage.removeItem('auth_token');
    }
  }

  // Generate message for signing
  generateAuthMessage(address: string): string {
    const timestamp = Date.now();
    return `Sign this message to authenticate with MaskedCash on Solana: ${address} at ${timestamp}`;
  }

  // Verify signature and get JWT token
  async authenticateWithSignature(
    solanaAddress: string,
    signature: string,
    message: string
  ): Promise<AuthResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/wallet`,
        {},
        {
          headers: {
            'solana-address': solanaAddress,
            'solana-signature': signature,
            'solana-message': message,
            'Content-Type': 'application/json',
          },
        }
      );

      const { walletInfo, token } = response.data;

      // Store token for future requests with validation
      if (token && typeof token === 'string') {
        this.token = token;
        localStorage.setItem('auth_token', token);
      } else {
        throw new Error('Invalid token received from server');
      }

      return { walletInfo, token };
    } catch (error) {
      // Better error handling
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || error.message;
        throw new Error(errorMessage);
      }
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed';
      throw new Error(errorMessage);
    }
  }

  // Fetch wallet info from API using stored token
  async fetchWalletInfo(): Promise<WalletInfo> {
    if (!this.token) {
      throw new Error('No authentication token available');
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/wallet`, {
        headers: {
          Authorization: this.token,
          'Content-Type': 'application/json',
        },
      });

      return response.data.walletInfo;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired or invalid, clear it
        this.logout();
        throw new Error('Session expired. Please reconnect your wallet.');
      }

      const errorMessage =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : 'Failed to fetch wallet info';
      throw new Error(errorMessage);
    }
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    if (!this.token || typeof this.token !== 'string') {
      return false;
    }

    // Basic JWT format check
    const parts = this.token.split('.');
    if (parts.length !== 3) return false;

    try {
      // Basic expiry check if possible by decoding payload
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        console.log('Token expired according to payload');
        return false;
      }
    } catch (e) {
      // If we can't decode, just assume it's valid if format is okay
    }

    return true;
  }

  // Check if wallet exists (used before creating wallet automatically)
  async checkWalletExists(solanaAddress: string): Promise<boolean> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/wallet/exists`, {
        params: { address: solanaAddress },
      });
      return response.data.exists;
    } catch (error) {
      // If endpoint doesn't exist or returns error, assume wallet doesn't exist
      return false;
    }
  }

  // Create wallet (no signature required for new wallets)
  async createWallet(solanaAddress: string): Promise<WalletInfo> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/wallet/create`, {
        solanaAddress,
      });

      return response.data.walletInfo;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Wallet creation failed';
      throw new Error(errorMessage);
    }
  }

  // Make authenticated API calls
  async makeAuthenticatedRequest(
    url: string,
    options: AxiosRequestConfig = {}
  ) {
    if (!this.token) {
      throw new Error('No authentication token available');
    }

    // Construct full URL with API_BASE_URL
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

    const config: AxiosRequestConfig = {
      ...options,
      url: fullUrl,
      headers: {
        ...options.headers,
        Authorization: this.token,
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired or invalid, clear it
        this.logout();
        throw new Error('Session expired. Please reconnect your wallet.');
      }

      const errorMessage =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : 'API request failed';
      throw new Error(errorMessage);
    }
  }

  // Logout and clear token
  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }
}

export const authService = new AuthService();
