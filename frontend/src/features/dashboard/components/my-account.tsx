import { useEffect, useState } from 'react';

import { 
  Copy, 
  ExternalLink, 
  LogOut, 
  RefreshCw, 
  User, 
  CreditCard, 
  TrendingUp, 
  Wallet, 
  DollarSign, 
  Activity,
  PieChart,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useWallet } from '@/hooks/use-wallet';

interface Analytics {
  totalCreditLimit?: string;
  availableCredit?: string;
  totalBalance?: string;
  creditUtilization?: string | number;
  totalCards?: number;
  activeCards?: number;
  totalTransactions?: number;
  totalSpent?: string;
  recentTransactions?: number;
}

interface AccountData {
  analytics: Analytics;
  cards: unknown[];
}

export function MyAccount() {
  const { isAuthenticated, address, disconnect, makeAuthenticatedRequest } = useWallet();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountData = async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      
      // Fetch user analytics and cards data
      const [analyticsResponse, cardsResponse] = await Promise.all([
        makeAuthenticatedRequest(`${baseUrl}/api/user/analytics`),
        makeAuthenticatedRequest(`${baseUrl}/api/cards`)
      ]);
      
      setAccountData({
        analytics: analyticsResponse,
        cards: cardsResponse.cards || []
      });
    } catch (error) {
      console.error('Error fetching account data:', error);
      setError('Failed to load account information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountData();
  }, [isAuthenticated]);

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Show connect wallet prompt if user is not authenticated
  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex min-h-[500px] items-center justify-center">
          <div className="bw-card max-w-md mx-auto p-8 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full silver-accent border border-gray-300">
              <Wallet className="h-8 w-8 text-black" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h2>
            <p className="text-sm text-gray-600">
              Connect your wallet to view your credit card account information and manage your profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Loading skeleton for header */}
          <div className="bw-card p-6 animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          </div>
          
          {/* Loading skeleton for analytics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bw-card p-6 animate-pulse">
                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-2 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="bw-card max-w-md mx-auto p-8 text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 border border-gray-300">
              <Activity className="h-8 w-8 text-gray-800" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Account</h2>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button
              onClick={fetchAccountData}
              className="bw-button-primary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const analytics = accountData?.analytics || {};
  const cards = accountData?.cards || [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="space-y-8">
        {/* Enhanced Profile Header */}
        <div className="bw-card relative overflow-hidden">
          {/* Subtle background */}
          <div className="absolute inset-0 bg-gray-50"></div>
          
          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-32 h-32 rounded-full border border-gray-200 opacity-20"></div>
          <div className="absolute top-8 right-8 w-24 h-24 rounded-full border border-gray-200 opacity-15"></div>
          <div className="absolute bottom-4 left-4 w-20 h-20 rounded-full border border-gray-200 opacity-10"></div>
          
          <CardContent className="relative z-10 pt-8 pb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <Avatar className="h-16 w-16 ring-4 ring-white shadow-lg">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/identicon/svg?seed=${address}`}
                    />
                    <AvatarFallback className="bg-black text-white">
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-gray-400 border-2 border-white"></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
                    <Badge className="badge-silver">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600 mr-1.5 animate-pulse"></div>
                      Connected
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-200">
                      <code className="text-sm font-mono text-gray-700">
                        {address && formatAddress(address)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyAddress}
                        className="h-6 w-6 p-0 hover:bg-gray-100"
                      >
                        <Copy className={`h-3 w-3 ${copiedAddress ? 'text-black' : 'text-gray-500'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-6 w-6 p-0 hover:bg-gray-100"
                      >
                        <a
                          href={`https://solscan.io/account/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3 text-gray-500" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Enhanced Disconnect Wallet Button */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  disconnect();
                  toast.success('Wallet disconnected successfully');
                }}
                className="flex items-center gap-2 border-gray-400 text-gray-800 hover:bg-gray-100 hover:border-gray-500"
              >
                <LogOut className="h-4 w-4" />
                Disconnect Wallet
              </Button>
            </div>
          </CardContent>
        </div>

        {/* Enhanced Analytics Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bw-card hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg silver-accent">
                  <DollarSign className="h-5 w-5 text-black" />
                </div>
                <TrendingUp className="h-4 w-4 text-gray-600" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Total Credit Limit</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${analytics.totalCreditLimit || '0.00'}
                </p>
                <p className="text-xs text-gray-500">Across all cards</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bw-card hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-gray-300">
                  <Wallet className="h-5 w-5 text-gray-800" />
                </div>
                <Activity className="h-4 w-4 text-gray-600" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Available Credit</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${analytics.availableCredit || '0.00'}
                </p>
                <p className="text-xs text-gray-500">Ready to spend</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bw-card hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-gray-400">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <PieChart className="h-4 w-4 text-gray-600" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Current Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${analytics.totalBalance || '0.00'}
                </p>
                <p className="text-xs text-gray-500">Total outstanding</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bw-card hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-gray-500">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <TrendingUp className="h-4 w-4 text-gray-600" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">Credit Utilization</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.creditUtilization || '0'}%
                </p>
                <p className="text-xs text-gray-500">Of total limit</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Account Summary Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bw-card">
            <CardHeader className="pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg silver-accent">
                  <PieChart className="h-5 w-5 text-gray-800" />
                </div>
                <CardTitle className="text-lg">Account Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Total Cards</div>
                  <div className="text-xl font-bold text-gray-900">{analytics.totalCards || 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Active Cards</div>
                  <div className="text-xl font-bold text-gray-800">{analytics.activeCards || 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Total Transactions</div>
                  <div className="text-xl font-bold text-black">{analytics.totalTransactions || 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">Total Spent</div>
                  <div className="text-xl font-bold text-gray-900">${analytics.totalSpent || '0.00'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bw-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg silver-accent">
                    <Calendar className="h-5 w-5 text-gray-800" />
                  </div>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAccountData}
                  className="hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Recent Transactions</span>
                  <Badge className="badge-silver">
                    {analytics.recentTransactions || 0} last 30 days
                  </Badge>
                </div>
                {cards.length === 0 ? (
                  <div className="text-center py-4">
                    <CreditCard className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-3">
                      No credit cards yet. Apply for your first card to get started!
                    </p>
                    <Button 
                      onClick={() => window.location.href = '/cards'}
                      className="bw-button-primary text-xs px-4 py-2"
                    >
                      Apply for Card
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    You have {analytics.totalCards || 0} credit card{(analytics.totalCards || 0) !== 1 ? 's' : ''} with ${analytics.availableCredit || '0.00'} available credit.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
