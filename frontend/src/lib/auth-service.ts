import axios, { type AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface AuthResponse {
  token: string;
  solanaAddress: string;
  polygonAddress: string | null;
  safeWalletAddress?: string | null;
  message: string;
}

export interface WalletsInfo {
  solanaAddress: string;
  polygonAddress: string | null;
  polygonConnected: boolean;
  safeWalletAddress: string | null;
  safeWalletConnected: boolean;
}

// Legacy interfaces for backward compatibility
export interface WalletInfo {
  solana?: {
    address: string;
  };
  polygon?: {
    address: string;
  };
  createdAt?: string;
}

export interface LegacyWalletInfo {
  solanaAddress: string;
  solanaBalance: string;
  usdcBalance: string;
}

class AuthService {
  private token: string | null = null;
  private polygonAddress: string | null = null;
  private safeWalletAddress: string | null = null;

  constructor() {
    // Load token and addresses from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
    this.polygonAddress = localStorage.getItem('polygon_address');
    this.safeWalletAddress = localStorage.getItem('safe_wallet_address');
  }

  // Generate message for signing
  generateAuthMessage(address: string): string {
    const timestamp = Date.now();
    return `Sign this message to authenticate with PolyBrain Lending Protocol: ${address} at ${timestamp}`;
  }

  // Login with Solana wallet signature
  async login(
    solanaAddress: string,
    signature: string,
    message: string
  ): Promise<AuthResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        {
          solanaAddress,
          signature,
          message,
        }
      );

      const { token, polygonAddress } = response.data;

      // Store token for future requests
      this.token = token;
      localStorage.setItem('auth_token', token);

      // Store polygon address if connected
      if (polygonAddress) {
        this.polygonAddress = polygonAddress;
        localStorage.setItem('polygon_address', polygonAddress);
      }

      return response.data;
    } catch (error) {
      const errorMessage =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : 'Authentication failed';
      throw new Error(errorMessage);
    }
  }

  // Legacy method for backward compatibility
  async authenticateWithSignature(
    solanaAddress: string,
    signature: string,
    message: string
  ): Promise<{ walletInfo: WalletInfo; token: string }> {
    const response = await this.login(solanaAddress, signature, message);
    return {
      walletInfo: {
        solana: { address: response.solanaAddress },
        polygon: response.polygonAddress ? { address: response.polygonAddress } : undefined,
      },
      token: response.token,
    };
  }

  // Connect Polygon wallet
  async connectPolygonWallet(
    solanaAddress: string,
    polygonAddress: string,
    signature?: string,
    message?: string
  ): Promise<{ success: boolean; polygonAddress: string }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/connect-polygon`,
        {
          solanaAddress,
          polygonAddress,
          signature,
          message,
        }
      );

      // Store polygon address
      this.polygonAddress = response.data.polygonAddress;
      localStorage.setItem('polygon_address', response.data.polygonAddress);

      return response.data;
    } catch (error) {
      const errorMessage =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : 'Failed to connect Polygon wallet';
      throw new Error(errorMessage);
    }
  }

  // Disconnect Polygon wallet
  async disconnectPolygonWallet(solanaAddress: string): Promise<void> {
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/disconnect-polygon`,
        { solanaAddress },
        {
          headers: {
            Authorization: this.token ? `Bearer ${this.token}` : '',
          },
        }
      );

      this.polygonAddress = null;
      localStorage.removeItem('polygon_address');
    } catch (error) {
      const errorMessage =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : error instanceof Error
            ? error.message
            : 'Failed to disconnect Polygon wallet';
      throw new Error(errorMessage);
    }
  }

  // Get connected wallets info
  async getWalletsInfo(): Promise<WalletsInfo> {
    if (!this.token) {
      throw new Error('No authentication token available');
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/wallets`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      // Update local addresses
      if (response.data.polygonAddress) {
        this.polygonAddress = response.data.polygonAddress;
        localStorage.setItem('polygon_address', response.data.polygonAddress);
      }
      if (response.data.safeWalletAddress) {
        this.safeWalletAddress = response.data.safeWalletAddress;
        localStorage.setItem('safe_wallet_address', response.data.safeWalletAddress);
      }

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
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

  // Legacy method - fetch wallet info
  async fetchWalletInfo(): Promise<WalletInfo> {
    const walletsInfo = await this.getWalletsInfo();
    return {
      solana: { address: walletsInfo.solanaAddress },
      polygon: walletsInfo.polygonAddress ? { address: walletsInfo.polygonAddress } : undefined,
    };
  }

  // Get current token
  getToken(): string | null {
    return this.token;
  }

  // Get connected Polygon address
  getPolygonAddress(): string | null {
    return this.polygonAddress;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Check if Polygon wallet is connected
  isPolygonConnected(): boolean {
    return !!this.polygonAddress;
  }

  // Connect Safe wallet
  async connectSafeWallet(safeWalletAddress: string): Promise<{ success: boolean; safeWalletAddress: string }> {
    if (!this.token) {
      throw new Error('No authentication token available');
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/add-polymarket-wallet`,
        { safeWalletAddress },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Store Safe wallet address
      this.safeWalletAddress = response.data.safeWalletAddress;
      localStorage.setItem('safe_wallet_address', response.data.safeWalletAddress);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        // Extract the error message from the backend response
        const backendError = error.response.data.error;
        const errorCode = error.response.data.code;
        
        // If it's a NOT_OWNER error, provide a clear message
        if (errorCode === 'NOT_OWNER' || backendError.includes('not an owner')) {
          throw new Error('Your Polygon wallet is not an owner of this Safe wallet. Please ensure you are using the correct Safe wallet address that you own.');
        }
        
        // Return the backend error message as-is for other cases
        throw new Error(backendError);
      }
      
      // Fallback for non-axios errors
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect Safe wallet';
      throw new Error(errorMessage);
    }
  }

  // Get connected Safe wallet address
  getSafeWalletAddress(): string | null {
    return this.safeWalletAddress;
  }

  // Check if Safe wallet is connected
  isSafeWalletConnected(): boolean {
    return !!this.safeWalletAddress;
  }

  // Legacy method - create wallet (now just returns success since we don't create custodial wallets)
  async createWallet(_solanaAddress: string): Promise<WalletInfo> {
    // No longer needed - users connect their own wallets
    return {
      solana: { address: _solanaAddress },
    };
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
    this.polygonAddress = null;
    this.safeWalletAddress = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('polygon_address');
    localStorage.removeItem('safe_wallet_address');
  }
}

export const authService = new AuthService();
