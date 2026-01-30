import { useCallback, useEffect, useState } from 'react';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle,
  Coins,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Lock,
  LogOut,
  Network,
  QrCode,
  RefreshCw,
  Shield,
  TrendingUp,
  Unlock,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';
import QRCodeLib from 'qrcode';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';
import { type WalletInfo, authService } from '@/lib/auth-service';

interface TokenBalance {
  balance: string;
  symbol: string;
  mint: string;
  decimals: number;
}

interface SolanaTokenBalances {
  sol: TokenBalance;
  usdc?: TokenBalance;
  usdt?: TokenBalance;
}

interface WalletsModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletInfo: WalletInfo | null;
  isLoadingWallet: boolean;
}

interface DepositWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'deposit' | 'withdraw';
  walletInfo: WalletInfo | null;
  tokenBalances: SolanaTokenBalances | null;
  network: 'solana' | 'polygon';
}

function DepositWithdrawModal({
  isOpen,
  onClose,
  type,
  walletInfo,
  tokenBalances,
}: DepositWithdrawModalProps) {
  const [selectedToken, setSelectedToken] = useState<string>('SOL');
  const [amount, setAmount] = useState<string>('');
  const [withdrawAddress, setWithdrawAddress] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isAddressValid, setIsAddressValid] = useState<boolean | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const tokens = [
    {
      symbol: 'SOL',
      name: 'Solana',
      icon: '⚪',
      gradient: 'from-slate-500/20 to-blue-500/20 border-slate-500/30',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      icon: '🔵',
      gradient: 'from-blue-500/20 to-slate-500/20 border-blue-500/30',
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      icon: '🔹',
      gradient: 'from-blue-600/20 to-slate-400/20 border-blue-600/30',
    },
  ];

  const getDepositAddress = useCallback(() => {
    if (!walletInfo?.solana?.address) return '';
    return walletInfo.solana.address;
  }, [walletInfo]);

  const getTokenBalance = (tokenSymbol: string) => {
    if (!tokenBalances) return '0.00';
    const token =
      tokenBalances[tokenSymbol.toLowerCase() as keyof SolanaTokenBalances];
    return token ? parseFloat(token.balance).toFixed(6) : '0.00';
  };

  const handleMaxAmount = () => {
    const balance = getTokenBalance(selectedToken);
    setAmount(balance);
  };

  const handleDeposit = async () => {
    toast.success('Deposit address copied! Send your tokens to this address.');
    await navigator.clipboard.writeText(getDepositAddress());
  };

  const validateSolanaAddress = (address: string) => {
    if (!address) {
      setIsAddressValid(null);
      return;
    }

    try {
      new PublicKey(address);
      setIsAddressValid(true);
    } catch {
      setIsAddressValid(false);
    }
  };

  const handleAddressChange = (value: string) => {
    setWithdrawAddress(value);
    validateSolanaAddress(value);
  };

  const handleWithdraw = async () => {
    if (!amount || !withdrawAddress) {
      toast.error('Please enter amount and withdrawal address');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (numericAmount > parseFloat(getTokenBalance(selectedToken))) {
      toast.error('Insufficient balance');
      return;
    }

    if (!isAddressValid) {
      toast.error('Please enter a valid Solana address');
      return;
    }

    setShowConfirmation(true);
  };

  const confirmWithdrawal = async () => {
    setShowConfirmation(false);
    setIsProcessing(true);

    try {
      const response = await authService.makeAuthenticatedRequest(
        '/api/withdraw',
        {
          method: 'POST',
          data: {
            tokenType: selectedToken,
            amount: parseFloat(amount),
            address: withdrawAddress,
          },
        }
      );

      if (response.result?.success) {
        toast.success('Withdrawal completed successfully!', {
          description: response.result.txHash
            ? `Transaction: ${response.result.txHash.slice(0, 10)}...`
            : undefined,
          action: response.result.explorerUrl
            ? {
                label: 'View Transaction',
                onClick: () =>
                  window.open(response.result.explorerUrl, '_blank'),
              }
            : undefined,
        });

        setAmount('');
        setWithdrawAddress('');
        setIsAddressValid(null);
        onClose();
      } else {
        throw new Error(response.result?.error || 'Withdrawal failed');
      }
    } catch (error: unknown) {
      toast.error(
        `Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const generateQRCode = useCallback(async (address: string) => {
    if (!address) return;

    try {
      setIsGeneratingQR(true);
      const qrDataUrl = await QRCodeLib.toDataURL(address, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch {
      toast.error('Failed to generate QR code');
    } finally {
      setIsGeneratingQR(false);
    }
  }, []);

  useEffect(() => {
    if (type === 'deposit') {
      const address = getDepositAddress();
      if (address) {
        generateQRCode(address);
      }
    }
  }, [selectedToken, type, walletInfo, generateQRCode, getDepositAddress]);

  const selectedTokenData = tokens.find(t => t.symbol === selectedToken);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-hidden overflow-y-auto border border-blue-500/50 bg-slate-900/98 shadow-2xl backdrop-blur-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          {/* Solid background overlay */}
          <div className="absolute inset-0 bg-slate-900/95"></div>

          <div className="relative">
            <DialogHeader className="space-y-3 pb-4 sm:space-y-4 sm:pb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/30 bg-gradient-to-r from-blue-500/20 to-slate-500/20 sm:h-12 sm:w-12">
                  {type === 'deposit' ? (
                    <ArrowDownToLine className="h-5 w-5 text-blue-400 sm:h-6 sm:w-6" />
                  ) : (
                    <ArrowUpFromLine className="h-5 w-5 text-slate-400 sm:h-6 sm:w-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate bg-gradient-to-r from-blue-300 to-slate-300 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
                    {type === 'deposit' ? 'Receive Assets' : 'Send Assets'}
                  </DialogTitle>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    {type === 'deposit'
                      ? 'Transfer tokens to your Solana wallet'
                      : 'Transfer tokens from your Solana wallet'}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-xs font-medium tracking-wider text-blue-300 uppercase">
                  Select Token
                </Label>
                <Select value={selectedToken} onValueChange={setSelectedToken}>
                  <SelectTrigger className="h-10 rounded-xl border-blue-500/30 bg-slate-800/50 text-white sm:h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-blue-500/30 bg-slate-800">
                    {tokens.map(token => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-base sm:text-lg">
                            {token.icon}
                          </span>
                          <div>
                            <span className="text-sm font-medium sm:text-base">
                              {token.symbol}
                            </span>
                            <span className="ml-1 text-xs text-slate-400 sm:ml-2">
                              ({token.name})
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === 'deposit' ? (
                <div
                  className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${selectedTokenData?.gradient} border p-4 sm:p-6`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
                  <div className="relative space-y-4 sm:space-y-6">
                    <div className="text-center">
                      <Label className="mb-2 block text-xs font-medium tracking-wider uppercase opacity-80 sm:mb-3">
                        Deposit Address
                      </Label>

                      {/* QR Code - Responsive sizing */}
                      <div className="mb-3 flex justify-center sm:mb-4">
                        <div className="rounded-xl border border-slate-300 bg-white p-3 sm:rounded-2xl sm:p-4">
                          {isGeneratingQR ? (
                            <div className="flex h-[140px] w-[140px] items-center justify-center sm:h-[180px] sm:w-[180px]">
                              <RefreshCw className="h-6 w-6 animate-spin text-slate-400 sm:h-8 sm:w-8" />
                            </div>
                          ) : qrCodeDataUrl ? (
                            <img
                              src={qrCodeDataUrl}
                              alt={`QR Code for ${selectedToken} deposit address`}
                              className="h-[140px] w-[140px] rounded-lg sm:h-[180px] sm:w-[180px]"
                            />
                          ) : (
                            <div className="flex h-[140px] w-[140px] items-center justify-center rounded-lg bg-slate-100 sm:h-[180px] sm:w-[180px]">
                              <QrCode className="h-8 w-8 text-slate-400 sm:h-12 sm:w-12" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Address Display - Responsive */}
                      <div className="relative overflow-hidden rounded-xl border border-slate-600/50 bg-slate-800/50 p-3 sm:p-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <code className="min-w-0 flex-1 font-mono text-xs break-all text-slate-200 sm:text-sm">
                            {getDepositAddress() || 'Address not available'}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              navigator.clipboard.writeText(getDepositAddress())
                            }
                            disabled={!getDepositAddress()}
                            className="flex-shrink-0 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                          >
                            <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Network Info */}
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs sm:mt-4 sm:text-sm">
                        <Network className="h-3 w-3 opacity-60 sm:h-4 sm:w-4" />
                        <span className="opacity-80">Network: Solana</span>
                      </div>
                    </div>

                    {/* Warning - Responsive padding */}
                    <div className="relative overflow-hidden rounded-xl border border-yellow-500/30 bg-yellow-600/20 p-3 sm:p-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-blue-500/10"></div>
                      <div className="relative">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400 sm:h-5 sm:w-5" />
                          <div className="min-w-0 text-xs text-yellow-200 sm:text-sm">
                            <p className="mb-1 font-medium">Security Notice:</p>
                            <p>
                              Only send {selectedToken} tokens on the Solana
                              network. Wrong network transfers may result in
                              permanent loss.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleDeposit}
                      className="h-10 w-full rounded-xl bg-gradient-to-r from-blue-600 to-slate-600 text-sm font-semibold transition-all duration-300 hover:from-blue-500 hover:to-slate-500 sm:h-12 sm:text-base"
                      disabled={!getDepositAddress()}
                    >
                      <Copy className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      Copy Address
                    </Button>
                  </div>
                </div>
              ) : (
                // Withdraw Form
                <div className="space-y-3 sm:space-y-4">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium tracking-wider text-slate-300 uppercase">
                        Amount
                      </Label>
                      <span className="text-xs text-slate-400">
                        Balance: {getTokenBalance(selectedToken)}{' '}
                        {selectedToken}
                      </span>
                    </div>
                    <div className="flex gap-2 sm:gap-3">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={amount}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                          className="h-10 rounded-xl border-slate-500/30 bg-slate-800/50 text-center text-base font-semibold text-white placeholder:text-slate-500 focus:border-slate-400/50 sm:h-12 sm:text-lg"
                          step="any"
                          min="0"
                        />
                        <div className="absolute top-1/2 right-2 -translate-y-1/2 sm:right-3">
                          <span className="text-xs font-bold text-slate-400 sm:text-sm">
                            {selectedToken}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMaxAmount}
                        disabled={
                          parseFloat(getTokenBalance(selectedToken)) === 0
                        }
                        className="h-10 rounded-xl border-slate-400/30 bg-slate-500/10 px-3 text-xs text-slate-300 hover:bg-slate-500/20 sm:h-12 sm:px-4 sm:text-sm"
                      >
                        MAX
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <Label className="text-xs font-medium tracking-wider text-slate-300 uppercase">
                      Destination Address
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="Enter Solana address"
                        value={withdrawAddress}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAddressChange(e.target.value)}
                        className={`h-10 rounded-xl border bg-slate-800/50 pr-10 text-sm text-white placeholder:text-slate-500 sm:h-12 sm:pr-12 sm:text-base ${
                          isAddressValid === true
                            ? 'border-green-500/50 focus:border-green-400/50'
                            : isAddressValid === false
                              ? 'border-red-500/50 focus:border-red-400/50'
                              : 'border-slate-500/30 focus:border-slate-400/50'
                        }`}
                      />
                      <div className="absolute top-1/2 right-2 -translate-y-1/2 sm:right-3">
                        {isAddressValid === true && (
                          <CheckCircle className="h-4 w-4 text-green-400 sm:h-5 sm:w-5" />
                        )}
                        {isAddressValid === false && (
                          <XCircle className="h-4 w-4 text-red-400 sm:h-5 sm:w-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Network Fees Info */}
                  <div className="relative overflow-hidden rounded-xl border border-blue-500/30 bg-blue-600/20 p-3 sm:p-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-blue-500/10"></div>
                    <div className="relative">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400 sm:h-5 sm:w-5" />
                        <div className="text-xs text-blue-200 sm:text-sm">
                          <p className="mb-1 font-medium">Network Fees:</p>
                          <p>
                            Small SOL fee will be deducted for Solana network
                            costs.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleWithdraw}
                    className="h-10 w-full rounded-xl bg-gradient-to-r from-slate-600 to-red-600 text-sm font-semibold transition-all duration-300 hover:from-slate-500 hover:to-red-500 sm:h-12 sm:text-base"
                    disabled={
                      !amount ||
                      !withdrawAddress ||
                      !isAddressValid ||
                      isProcessing ||
                      parseFloat(getTokenBalance(selectedToken)) === 0 ||
                      parseFloat(amount) <= 0 ||
                      parseFloat(amount) >
                        parseFloat(getTokenBalance(selectedToken))
                    }
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin sm:h-5 sm:w-5" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ArrowUpFromLine className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                        Send {selectedToken}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto border border-slate-500/50 bg-slate-900/98 shadow-2xl backdrop-blur-md sm:max-w-lg">
          {/* Solid background overlay */}
          <div className="absolute inset-0 bg-slate-900/95"></div>
          <div className="relative">
            <DialogHeader className="space-y-4 pb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-400/30 bg-gradient-to-r from-slate-500/20 to-red-500/20">
                  <AlertCircle className="h-6 w-6 text-slate-400" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl font-bold text-slate-300">
                    Confirm Transaction
                  </DialogTitle>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-xl border border-slate-500/30 bg-slate-600/20 p-6">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-500/5 to-red-500/10"></div>
                <div className="relative">
                  <p className="mb-4 font-medium text-slate-200">
                    Review transaction details:
                  </p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Token:</span>
                      <span className="font-medium text-slate-200">
                        {selectedToken}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Amount:</span>
                      <span className="font-medium text-slate-200">
                        {amount} {selectedToken}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Network:</span>
                      <span className="font-medium text-slate-200">
                        Solana
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-slate-400">To:</span>
                      <span className="ml-2 text-right font-mono text-xs break-all text-slate-200">
                        {withdrawAddress}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-red-600/20 p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-blue-500/10"></div>
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                    <div className="text-sm text-red-200">
                      <p className="mb-2 font-medium">⚠️ Final Warning:</p>
                      <p className="mb-2">
                        This action cannot be undone. Verify:
                      </p>
                      <ul className="list-inside list-disc space-y-1 text-xs">
                        <li>Address is correct and supports {selectedToken}</li>
                        <li>Correct network (Solana)</li>
                        <li>Amount is accurate</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  className="h-12 flex-1 rounded-xl border-slate-600/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmWithdrawal}
                  className="h-12 flex-1 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 font-semibold hover:from-red-500 hover:to-blue-500"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Send'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WalletsModal({
  isOpen,
  onClose,
  walletInfo,
  isLoadingWallet,
}: WalletsModalProps) {
  const { publicKey } = useWallet();
  const {
    isAuthenticated,
    logout,
  } = useAuth();
  const [tokenBalances, setTokenBalances] = useState<SolanaTokenBalances | null>(
    null
  );
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [depositWithdrawModal, setDepositWithdrawModal] = useState<{
    isOpen: boolean;
    type: 'deposit' | 'withdraw';
    network: 'solana' | 'polygon';
  }>({ isOpen: false, type: 'deposit', network: 'solana' });
  const [exportKeysModal, setExportKeysModal] = useState(false);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} address copied to clipboard`);
    } catch {
      toast.error('Failed to copy address');
    }
  };

  const fetchTokenBalances = useCallback(async () => {
    if (!walletInfo || !isAuthenticated) {
      setTokenBalances(null);
      return;
    }

    try {
      setIsLoadingBalances(true);
      const data = await authService.makeAuthenticatedRequest(
        '/api/balance/tokens',
        {
          method: 'GET',
        }
      );
      setTokenBalances(data);
    } catch {
      setTokenBalances(null);
      if (isAuthenticated) {
        toast.error('Failed to fetch token balances');
      }
    } finally {
      setIsLoadingBalances(false);
    }
  }, [walletInfo, isAuthenticated]);

  useEffect(() => {
    if (isOpen && walletInfo && !isLoadingWallet && isAuthenticated) {
      fetchTokenBalances();
    } else {
      setTokenBalances(null);
    }
  }, [
    isOpen,
    walletInfo,
    isLoadingWallet,
    isAuthenticated,
    fetchTokenBalances,
  ]);

  const formatBalance = (balance: string | number) => {
    const num = parseFloat(balance.toString());
    if (num === 0) return '0.00';
    if (num < 0.0001) return '< 0.0001';
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(4);
    return num.toFixed(2);
  };

  const getTokenIcon = (symbol: string) => {
    switch (symbol) {
      case 'SOL':
        return '🟣';
      case 'USDC':
        return '🔵';
      case 'USDT':
        return '🟢';
      case 'MATIC':
        return '🟣';
      default:
        return '⚪';
    }
  };

  const handleDisconnect = () => {
    try {
      logout();
      onClose();
    } catch {
      toast.error('Failed to disconnect wallet');
    }
  };

  const WalletRow = ({
    label,
    address,
    network,
    isMain = false,
  }: {
    label: string;
    address: string;
    network: 'solana' | 'polygon';
    isMain?: boolean;
  }) => {
    const getNetworkTokens = () => {
      if (!tokenBalances || !isAuthenticated) return [];

      if (network === 'solana') {
        return Object.entries(tokenBalances).filter(
          ([key]) => key === 'sol' || key.includes('_solana')
        );
      } else if (network === 'polygon') {
        return Object.entries(tokenBalances).filter(
          ([key]) => key === 'matic' || key.includes('_polygon')
        );
      }
      return [];
    };

    const networkTokens = getNetworkTokens();
    const networkIcon = network === 'solana' ? '🟢' : '🟣';
    const networkColor = network === 'solana' ? 'slate' : 'blue';

    return (
      <div
        className={`relative overflow-hidden rounded-xl bg-gradient-to-r from-${networkColor}-600/20 to-${networkColor === 'slate' ? 'slate' : 'slate'}-600/20 border border-${networkColor}-500/30`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>

        <div className="relative p-4 sm:p-6">
          {/* Header - Responsive */}
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-600/50 bg-gradient-to-r from-slate-800/80 to-slate-700/80 sm:h-10 sm:w-10">
                {isMain ? (
                  <Wallet className="h-4 w-4 text-blue-400 sm:h-5 sm:w-5" />
                ) : (
                  <span className="text-base sm:text-lg">{networkIcon}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white sm:text-base">
                  {label}
                </div>
                <div className="truncate font-mono text-xs text-slate-300">
                  {address ? (
                    `${address.slice(0, 6)}...${address.slice(-4)}`
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400">
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Unavailable</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 capitalize">
                  {network} Network
                </div>
              </div>
            </div>

            {address && (
              <div className="flex flex-shrink-0 gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(address, label)}
                  className="h-7 w-7 p-0 text-slate-300 hover:bg-white/10 hover:text-white sm:h-8 sm:w-8"
                >
                  <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const explorerUrl =
                      network === 'solana'
                        ? `https://explorer.solana.com/address/${address}`
                        : `https://polygonscan.com/address/${address}`;
                    window.open(explorerUrl, '_blank');
                  }}
                  className="h-7 w-7 p-0 text-slate-300 hover:bg-white/10 hover:text-white sm:h-8 sm:w-8"
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                {isMain && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                    className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300 sm:h-8 sm:w-8"
                  >
                    <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {!isMain && address && (
            <>
              {/* Balances - Responsive */}
              <div className="mb-3 space-y-2 sm:mb-4 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Coins className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
                    <span className="text-xs font-medium tracking-wider text-slate-300 uppercase">
                      Token Balances
                    </span>
                  </div>
                  {isLoadingBalances && isAuthenticated && (
                    <RefreshCw className="h-3 w-3 animate-spin text-slate-400 sm:h-4 sm:w-4" />
                  )}
                </div>

                {!isAuthenticated ? (
                  <div className="rounded-lg bg-slate-800/30 py-2 text-center text-xs text-slate-400 sm:py-3">
                    Please authenticate to view balances
                  </div>
                ) : isLoadingBalances ? (
                  <div className="rounded-lg bg-slate-800/30 py-2 text-center text-xs text-slate-400 sm:py-3">
                    Loading balances...
                  </div>
                ) : networkTokens.length > 0 ? (
                  <div className="grid gap-1 sm:gap-2">
                    {networkTokens.map(([tokenKey, token]) => (
                      <div
                        key={tokenKey}
                        className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 px-2 py-1.5 sm:px-3 sm:py-2"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                          <span className="flex-shrink-0 text-xs sm:text-sm">
                            {getTokenIcon(token.symbol)}
                          </span>
                          <span className="truncate text-xs font-medium text-slate-200 sm:text-sm">
                            {token.symbol}
                          </span>
                          {network === 'polygon' && token.symbol === 'USDC' && (
                            <span className="hidden text-xs text-slate-400 sm:inline">
                              (Polygon)
                            </span>
                          )}
                          {network === 'solana' && token.symbol === 'USDC' && (
                            <span className="hidden text-xs text-slate-400 sm:inline">
                              (Solana)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
                          <span className="font-mono text-xs text-slate-200 sm:text-sm">
                            {formatBalance(token.balance)}
                          </span>
                          {parseFloat(token.balance) > 0 && (
                            <TrendingUp className="h-2.5 w-2.5 text-green-400 sm:h-3 sm:w-3" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isAuthenticated ? (
                  <div className="rounded-lg bg-slate-800/30 py-2 text-center text-xs text-slate-400 sm:py-3">
                    No balances available
                  </div>
                ) : null}
              </div>

              {/* Action Buttons - Responsive - Only show for Solana network */}
              {network === 'solana' && (
                <div className="flex gap-2 sm:gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 rounded-lg border-blue-400/30 bg-blue-500/10 text-xs text-blue-300 hover:bg-blue-500/20 sm:h-10 sm:text-sm"
                    onClick={() =>
                      setDepositWithdrawModal({
                        isOpen: true,
                        type: 'deposit',
                        network,
                      })
                    }
                    disabled={!isAuthenticated}
                  >
                    <ArrowDownToLine className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Receive</span>
                    <span className="sm:hidden">RCV</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 rounded-lg border-slate-400/30 bg-slate-500/10 text-xs text-slate-300 hover:bg-slate-500/20 sm:h-10 sm:text-sm"
                    onClick={() =>
                      setDepositWithdrawModal({
                        isOpen: true,
                        type: 'withdraw',
                        network,
                      })
                    }
                    disabled={
                      !isAuthenticated ||
                      networkTokens.length === 0 ||
                      networkTokens.every(
                        ([_, token]) => parseFloat(token.balance) === 0
                      )
                    }
                  >
                    <ArrowUpFromLine className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Send</span>
                    <span className="sm:hidden">SND</span>
                  </Button>
                </div>
              )}

              {/* Info text for Polygon wallet */}
              {network === 'polygon' && (
                <div className="rounded-lg bg-slate-800/20 py-1.5 text-center text-xs text-slate-500 sm:py-2">
                  Used for Polymarket trading
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const hasAnyWalletData = publicKey || walletInfo;
  const hasCustodialWallets =
    walletInfo?.solana?.address || walletInfo?.polygon?.address;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-md overflow-hidden overflow-y-auto border border-blue-500/50 bg-slate-900/98 shadow-2xl backdrop-blur-md sm:max-w-lg md:max-w-xl lg:max-w-3xl">
          {/* Solid background overlay */}
          <div className="absolute inset-0 bg-slate-900/95"></div>

          <div className="relative">
            <DialogHeader className="space-y-3 pb-4 sm:space-y-4 sm:pb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/30 bg-gradient-to-r from-blue-500/20 to-blue-500/20 sm:h-12 sm:w-12">
                  <Wallet className="h-5 w-5 text-blue-400 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="bg-gradient-to-r from-blue-300 to-blue-300 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
                    Wallet Manager
                  </DialogTitle>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    Manage your multi-chain wallets and assets
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4">
              {publicKey && (
                <WalletRow
                  label="Main Wallet (Connected)"
                  address={publicKey.toBase58()}
                  network="solana"
                  isMain={true}
                />
              )}

              {isLoadingWallet && (
                <div className="py-6 text-center sm:py-8">
                  <div className="mb-2 flex items-center justify-center gap-2 sm:mb-3 sm:gap-3">
                    <RefreshCw className="h-5 w-5 animate-spin text-blue-400 sm:h-6 sm:w-6" />
                    <span className="text-sm font-medium text-blue-300 sm:text-base">
                      Initializing custody wallets...
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 sm:text-sm">
                    Setting up secure multi-chain infrastructure
                  </p>
                </div>
              )}

              {!isLoadingWallet && walletInfo?.polygon?.address && (
                <WalletRow
                  label="Polygon Custody Wallet"
                  address={walletInfo.polygon.address}
                  network="polygon"
                />
              )}

              {!isLoadingWallet && walletInfo?.solana?.address && (
                <WalletRow
                  label="Solana Custody Wallet"
                  address={walletInfo.solana.address}
                  network="solana"
                />
              )}

              {!isLoadingWallet && !hasCustodialWallets && walletInfo && (
                <div className="relative overflow-hidden rounded-xl border border-slate-500/30 bg-gradient-to-r from-slate-600/20 to-blue-600/20 p-3 sm:p-4">
                  <div className="relative text-center">
                    <AlertCircle className="mx-auto mb-2 h-6 w-6 text-slate-400 sm:h-8 sm:w-8" />
                    <p className="mb-1 text-sm font-medium text-slate-300 sm:text-base">
                      Custody Setup In Progress
                    </p>
                    <p className="text-xs text-slate-200/70">
                      Your custody wallets are being initialized. Please refresh
                      in a moment.
                    </p>
                  </div>
                </div>
              )}

              {!isLoadingWallet && !hasAnyWalletData && (
                <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-r from-red-600/20 to-blue-600/20 p-6 sm:p-8">
                  <div className="relative text-center">
                    <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400 sm:h-12 sm:w-12" />
                    <p className="mb-2 text-sm font-medium text-red-300 sm:text-base">
                      No Wallets Found
                    </p>
                    <p className="text-xs text-red-200/70 sm:text-sm">
                      Please authenticate your wallet to continue.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions - Responsive */}
            <div className="flex flex-col items-stretch justify-between gap-2 pt-4 sm:flex-row sm:items-center sm:gap-3 sm:pt-6">
              {isAuthenticated && hasCustodialWallets && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportKeysModal(true)}
                  className="h-9 rounded-lg border-red-400/30 bg-red-500/10 text-xs text-red-300 hover:bg-red-500/20 sm:h-auto sm:text-sm"
                >
                  <Key className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                  Export Keys
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onClose}
                className="h-9 rounded-lg border-slate-600/50 bg-slate-800/50 text-xs text-slate-300 hover:bg-slate-700/50 sm:ml-auto sm:h-auto sm:text-sm"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DepositWithdrawModal
        isOpen={depositWithdrawModal.isOpen}
        onClose={() =>
          setDepositWithdrawModal({
            isOpen: false,
            type: 'deposit',
            network: 'solana',
          })
        }
        type={depositWithdrawModal.type}
        walletInfo={walletInfo}
        tokenBalances={tokenBalances}
        network={depositWithdrawModal.network}
      />

      <ExportKeysModal
        isOpen={exportKeysModal}
        onClose={() => setExportKeysModal(false)}
      />
    </>
  );
}

interface ExportKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ExportKeysModal({ isOpen, onClose }: ExportKeysModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [exportedKeys, setExportedKeys] = useState<Record<
    string,
    string
  > | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [step, setStep] = useState<'confirm' | 'export' | 'display'>('confirm');

  const requiredConfirmation = 'I_UNDERSTAND_THE_RISKS';

  const handleExport = async () => {
    if (confirmationText !== requiredConfirmation) {
      toast.error('Please type the exact confirmation text');
      return;
    }

    try {
      setStep('export');

      const response = await authService.makeAuthenticatedRequest(
        '/api/wallet/export-keys',
        {
          method: 'POST',
          data: {
            confirmation: requiredConfirmation,
          },
        }
      );

      setExportedKeys(response.keys);
      setStep('display');
      toast.success('Private keys exported successfully');
    } catch (error: unknown) {
      toast.error(
        `Failed to export keys: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setStep('confirm');
    }
  };

  const copyKeyToClipboard = async (key: string, network: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success(`${network} private key copied to clipboard`);
    } catch {
      toast.error('Failed to copy private key');
    }
  };

  const handleClose = () => {
    setConfirmationText('');
    setExportedKeys(null);
    setShowKeys(false);
    setStep('confirm');
    onClose();
  };

  const downloadKeysAsFile = () => {
    if (!exportedKeys) return;

    const keysData = {
      exported_at: new Date().toISOString(),
      warning:
        'SECURITY WARNING: These private keys provide full access to your wallet. Store them securely and never share them.',
      keys: exportedKeys,
    };

    const blob = new Blob([JSON.stringify(keysData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-private-keys-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Private keys downloaded as JSON file');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md border border-red-500/30 bg-gradient-to-br from-slate-900/95 via-red-900/30 to-slate-900/95 sm:max-w-lg">
        <div className="relative">
          <DialogHeader className="space-y-4 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-400/30 bg-gradient-to-r from-red-500/20 to-blue-500/20">
                <Shield className="h-6 w-6 text-red-400" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold text-red-300">
                  Export Private Keys
                </DialogTitle>
                <p className="text-sm text-slate-400">
                  Extreme caution required
                </p>
              </div>
            </div>
          </DialogHeader>

          {step === 'confirm' && (
            <div className="space-y-6">
              {/* Security Warnings */}
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-r from-red-600/20 to-blue-600/20 p-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-blue-500/10"></div>
                  <div className="relative">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-400" />
                      <div className="text-sm text-red-200">
                        <p className="mb-3 font-bold text-red-300">
                          🚨 CRITICAL SECURITY WARNING
                        </p>
                        <div className="space-y-2">
                          <p>
                            Private keys provide{' '}
                            <strong>complete control</strong> over your wallet
                            and funds.
                          </p>
                          <p>
                            <strong>
                              Never share your private keys with anyone!
                            </strong>
                          </p>
                          <p>Anyone with access to these keys can:</p>
                          <ul className="mt-2 ml-3 list-inside list-disc space-y-1">
                            <li>Steal all your funds</li>
                            <li>Make unauthorized transactions</li>
                            <li>Access your wallet from anywhere</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-slate-500/30 bg-gradient-to-r from-slate-600/20 to-blue-600/20 p-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-500/5 to-blue-500/10"></div>
                  <div className="relative">
                    <div className="flex items-start gap-3">
                      <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
                      <div className="text-sm text-slate-200">
                        <p className="mb-2 font-medium">
                          Security Best Practices:
                        </p>
                        <ul className="list-inside list-disc space-y-1 text-xs">
                          <li>Store keys offline in secure location</li>
                          <li>Use hardware wallet or encrypted storage</li>
                          <li>Never enter keys on untrusted websites</li>
                          <li>Create secure backups in multiple locations</li>
                          <li>Consider using a password manager</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium text-red-300">
                  Type to confirm:{' '}
                  <code className="rounded border border-red-500/30 bg-slate-800/50 px-2 py-1 font-mono text-xs">
                    {requiredConfirmation}
                  </code>
                </Label>
                <Input
                  placeholder="Type the confirmation text exactly"
                  value={confirmationText}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmationText(e.target.value)}
                  className="border-red-500/30 bg-slate-800/50 font-mono text-white focus:border-red-400/50"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 rounded-xl border-slate-600/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={confirmationText !== requiredConfirmation}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 font-semibold hover:from-red-500 hover:to-blue-500"
                >
                  <Unlock className="mr-2 h-5 w-5" />
                  Export Keys
                </Button>
              </div>
            </div>
          )}

          {step === 'export' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative mb-6">
                <RefreshCw className="h-12 w-12 animate-spin text-red-400" />
                <div className="absolute inset-0 animate-ping">
                  <div className="h-12 w-12 rounded-full border-2 border-red-400/30"></div>
                </div>
              </div>
              <p className="mb-2 font-medium text-red-300">
                Exporting private keys...
              </p>
              <p className="text-xs text-slate-400">
                This may take a moment for security
              </p>
            </div>
          )}

          {step === 'display' && exportedKeys && (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-xl border border-green-500/30 bg-gradient-to-r from-green-600/20 to-blue-600/20 p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-blue-500/10"></div>
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-sm font-medium text-green-300">
                      Private keys exported successfully
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {exportedKeys.solana && (
                  <div className="relative overflow-hidden rounded-xl border border-slate-500/30 bg-gradient-to-r from-slate-600/20 to-slate-600/20 p-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-500/5 to-slate-500/10"></div>
                    <div className="relative">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-lg">🟣</span>
                        <span className="text-sm font-medium text-slate-300">
                          Solana Network Key
                        </span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
                        <code
                          className={`flex-1 font-mono text-xs break-all ${!showKeys ? 'select-none' : ''} text-slate-300`}
                        >
                          {showKeys ? exportedKeys.solana : '•'.repeat(64)}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            copyKeyToClipboard(exportedKeys.solana, 'Solana')
                          }
                          className="text-slate-400 hover:bg-slate-500/10 hover:text-slate-300"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowKeys(!showKeys)}
                  className="border-slate-600/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50"
                >
                  {showKeys ? (
                    <EyeOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  {showKeys ? 'Hide Keys' : 'Reveal Keys'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadKeysAsFile}
                  className="border-blue-400/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                >
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Download JSON
                </Button>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-600/20 to-blue-600/20 p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-blue-500/10"></div>
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400" />
                    <div className="text-sm text-yellow-200">
                      <p className="mb-1 font-medium">
                        Final Security Reminder:
                      </p>
                      <p>
                        Store these keys securely and delete them from this
                        device when done. Never share them with anyone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleClose}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-slate-700 to-slate-600 font-semibold hover:from-slate-600 hover:to-slate-500"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}