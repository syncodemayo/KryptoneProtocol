import { useCallback, useEffect, useState } from 'react';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle,
  Copy,
  Key,
  LogOut,
  Network,
  QrCode,
  RefreshCw,
  Shield,
  TrendingUp,
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
import { useWallet as useCustomWallet } from '@/hooks/use-wallet';
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
      icon: '🟣',
      gradient: 'from-purple-100 to-violet-100 border-purple-200',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      icon: '🔵',
      gradient: 'from-blue-100 to-cyan-100 border-blue-200',
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      icon: '🟢',
      gradient: 'from-green-100 to-emerald-100 border-green-200',
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
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-hidden overflow-y-auto border border-indigo-200 bg-white shadow-2xl backdrop-blur-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          {/* Solid background overlay */}
          <div className="absolute inset-0 bg-white"></div>

          <div className="relative">
            <DialogHeader className="space-y-3 pb-4 sm:space-y-4 sm:pb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-100 to-indigo-100 sm:h-12 sm:w-12">
                  {type === 'deposit' ? (
                    <ArrowDownToLine className="h-5 w-5 text-emerald-600 sm:h-6 sm:w-6" />
                  ) : (
                    <ArrowUpFromLine className="h-5 w-5 text-orange-600 sm:h-6 sm:w-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate bg-gradient-to-r from-cyan-600 to-indigo-600 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
                    {type === 'deposit' ? 'Receive Assets' : 'Send Assets'}
                  </DialogTitle>
                  <p className="text-xs text-gray-600 sm:text-sm">
                    {type === 'deposit'
                      ? 'Transfer tokens to your Solana wallet'
                      : 'Transfer tokens from your Solana wallet'}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2 sm:space-y-3">
                <Label className="text-xs font-medium tracking-wider text-indigo-600 uppercase">
                  Select Token
                </Label>
                <Select value={selectedToken} onValueChange={setSelectedToken}>
                  <SelectTrigger className="h-10 rounded-xl border-indigo-200 bg-gray-50 text-gray-900 sm:h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-indigo-200 bg-white">
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
                            <span className="ml-1 text-xs text-gray-600 sm:ml-2">
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
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-100/20 to-transparent"></div>
                  <div className="relative space-y-4 sm:space-y-6">
                    <div className="text-center">
                      <Label className="mb-2 block text-xs font-medium tracking-wider uppercase text-gray-700 sm:mb-3">
                        Deposit Address
                      </Label>

                      {/* QR Code - Responsive sizing */}
                      <div className="mb-3 flex justify-center sm:mb-4">
                        <div className="rounded-xl border border-gray-300 bg-white p-3 sm:rounded-2xl sm:p-4">
                          {isGeneratingQR ? (
                            <div className="flex h-[140px] w-[140px] items-center justify-center sm:h-[180px] sm:w-[180px]">
                              <RefreshCw className="h-6 w-6 animate-spin text-gray-400 sm:h-8 sm:w-8" />
                            </div>
                          ) : qrCodeDataUrl ? (
                            <img
                              src={qrCodeDataUrl}
                              alt={`QR Code for ${selectedToken} deposit address`}
                              className="h-[140px] w-[140px] rounded-lg sm:h-[180px] sm:w-[180px]"
                            />
                          ) : (
                            <div className="flex h-[140px] w-[140px] items-center justify-center rounded-lg bg-gray-100 sm:h-[180px] sm:w-[180px]">
                              <QrCode className="h-8 w-8 text-gray-400 sm:h-12 sm:w-12" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Address Display - Responsive */}
                      <div className="relative overflow-hidden rounded-xl border border-gray-300 bg-gray-50 p-3 sm:p-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <code className="min-w-0 flex-1 font-mono text-xs break-all text-gray-800 sm:text-sm">
                            {getDepositAddress() || 'Address not available'}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              navigator.clipboard.writeText(getDepositAddress())
                            }
                            disabled={!getDepositAddress()}
                            className="flex-shrink-0 text-cyan-600 hover:bg-cyan-100 hover:text-cyan-700"
                          >
                            <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Network Info */}
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs sm:mt-4 sm:text-sm">
                        <Network className="h-3 w-3 text-gray-600 sm:h-4 sm:w-4" />
                        <span className="text-gray-600">Network: Solana</span>
                      </div>
                    </div>

                    {/* Warning - Responsive padding */}
                    <div className="relative overflow-hidden rounded-xl border border-yellow-300 bg-yellow-100 p-3 sm:p-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-100/50 to-amber-100/50"></div>
                      <div className="relative">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 sm:h-5 sm:w-5" />
                          <div className="min-w-0 text-xs text-yellow-800 sm:text-sm">
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
                      className="h-10 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-sm font-semibold text-white transition-all duration-300 hover:from-emerald-500 hover:to-green-500 sm:h-12 sm:text-base"
                      disabled={!getDepositAddress()}
                    >
                      <Copy className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      Copy Address
                    </Button>
                  </div>
                </div>
              ) : (
                // Withdraw form
                <div className="space-y-3 sm:space-y-4">
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium tracking-wider text-orange-600 uppercase">
                        Amount
                      </Label>
                      <span className="text-xs text-gray-600">
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
                          onChange={e => setAmount(e.target.value)}
                          className="h-10 rounded-xl border-orange-200 bg-gray-50 text-center text-base font-semibold text-gray-900 placeholder:text-gray-500 focus:border-orange-300 sm:h-12 sm:text-lg"
                          step="any"
                          min="0"
                        />
                        <div className="absolute top-1/2 right-2 -translate-y-1/2 sm:right-3">
                          <span className="text-xs font-bold text-orange-600 sm:text-sm">
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
                        className="h-10 rounded-xl border-orange-300 bg-orange-100 px-3 text-xs text-orange-700 hover:bg-orange-200 sm:h-12 sm:px-4 sm:text-sm"
                      >
                        MAX
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <Label className="text-xs font-medium tracking-wider text-orange-600 uppercase">
                      Destination Address
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="Enter Solana address"
                        value={withdrawAddress}
                        onChange={e => handleAddressChange(e.target.value)}
                        className={`h-10 rounded-xl border bg-gray-50 pr-10 text-sm text-gray-900 placeholder:text-gray-500 sm:h-12 sm:pr-12 sm:text-base ${isAddressValid === true
                            ? 'border-green-300 focus:border-green-400'
                            : isAddressValid === false
                              ? 'border-red-300 focus:border-red-400'
                              : 'border-orange-200 focus:border-orange-300'
                          }`}
                      />
                      <div className="absolute top-1/2 right-2 -translate-y-1/2 sm:right-3">
                        {isAddressValid === true && (
                          <CheckCircle className="h-4 w-4 text-green-600 sm:h-5 sm:w-5" />
                        )}
                        {isAddressValid === false && (
                          <XCircle className="h-4 w-4 text-red-600 sm:h-5 sm:w-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Network Fees Info */}
                  <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-blue-100 p-3 sm:p-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 to-cyan-100/50"></div>
                    <div className="relative">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 sm:h-5 sm:w-5" />
                        <div className="text-xs text-blue-800 sm:text-sm">
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
                    className="h-10 w-full rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-sm font-semibold text-white transition-all duration-300 hover:from-orange-500 hover:to-red-500 sm:h-12 sm:text-base"
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
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto border border-orange-200 bg-white shadow-2xl backdrop-blur-md sm:max-w-lg">
          <div className="absolute inset-0 bg-white"></div>
          <div className="relative">
            <DialogHeader className="space-y-4 pb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-orange-300 bg-gradient-to-r from-orange-100 to-red-100">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl font-bold text-orange-700">
                    Confirm Transaction
                  </DialogTitle>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-xl border border-orange-200 bg-orange-100 p-6">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-100/50 to-red-100/50"></div>
                <div className="relative">
                  <p className="mb-4 font-medium text-orange-800">
                    Review transaction details:
                  </p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Token:</span>
                      <span className="font-medium text-orange-800">
                        {selectedToken}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-medium text-orange-800">
                        {amount} {selectedToken}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Network:</span>
                      <span className="font-medium text-orange-800">
                        Solana
                      </span>
                    </div>
                    <div className="flex items-start justify-between">
                      <span className="text-gray-600">To:</span>
                      <span className="ml-2 text-right font-mono text-xs break-all text-orange-800">
                        {withdrawAddress}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-red-200 bg-red-100 p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-red-100/50 to-rose-100/50"></div>
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                    <div className="text-sm text-red-800">
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
                  className="h-12 flex-1 rounded-xl border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmWithdrawal}
                  className="h-12 flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 font-semibold text-white hover:from-red-500 hover:to-rose-500"
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
  const { isAuthenticated, disconnect } = useCustomWallet();
  const [tokenBalances, setTokenBalances] = useState<SolanaTokenBalances | null>(null);
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
    if (num < 0.00001) return '< 0.00001';
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
      localStorage.clear();
      disconnect();
      onClose();
      toast.success('Wallet disconnected');
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

    const tokens = getNetworkTokens();

    return (
      <div
        className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-lg ${isMain
            ? 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-100/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>

        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${network === 'solana'
                    ? 'border-purple-200 bg-purple-100 text-purple-600'
                    : 'border-violet-200 bg-violet-100 text-violet-600'
                  }`}
              >
                {network === 'solana' ? '🟣' : '🟪'}
              </div>
              <div>
                <h3
                  className={`text-sm font-semibold ${isMain ? 'text-indigo-700' : 'text-gray-900'
                    }`}
                >
                  {label}
                </h3>
                <p className="text-xs capitalize text-gray-500">{network}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isMain && (
                <div className="rounded-full bg-indigo-100 px-2 py-1">
                  <span className="text-xs font-medium text-indigo-700">
                    Connected
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-gray-500">
              Address
            </Label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <code className="min-w-0 flex-1 font-mono text-xs break-all text-gray-800">
                {address}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(address, label)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Token Balances */}
          {tokens.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-gray-500">
                Token Balances
              </Label>
              <div className="space-y-2">
                {tokens.map(([tokenKey, tokenData]) => {
                  const symbol = tokenData.symbol;
                  const balance = formatBalance(tokenData.balance);
                  return (
                    <div
                      key={tokenKey}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">
                          {getTokenIcon(symbol)}
                        </span>
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {symbol}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {balance}
                        </span>
                        <span className="ml-1 text-xs text-gray-500">
                          {symbol}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                setDepositWithdrawModal({
                  isOpen: true,
                  type: 'deposit',
                  network,
                })
              }
              className="flex-1 rounded-xl bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-500"
            >
              <ArrowDownToLine className="mr-1 h-3 w-3" />
              Receive
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setDepositWithdrawModal({
                  isOpen: true,
                  type: 'withdraw',
                  network,
                })
              }
              disabled={!tokens.some(([, token]) => parseFloat(token.balance) > 0)}
              className="flex-1 rounded-xl bg-orange-600 text-xs font-medium text-white hover:bg-orange-500 disabled:bg-gray-300 disabled:text-gray-500"
            >
              <ArrowUpFromLine className="mr-1 h-3 w-3" />
              Send
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto border border-indigo-200 bg-white shadow-2xl sm:max-w-3xl lg:max-w-4xl">
          <div className="absolute inset-0 bg-white"></div>

          <div className="relative">
            <DialogHeader className="space-y-4 pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-100 to-purple-100">
                    <Wallet className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-indigo-700">
                      Your Wallets
                    </DialogTitle>
                    <p className="text-sm text-gray-600">
                      Manage your crypto wallets and balances
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchTokenBalances}
                    disabled={isLoadingBalances}
                    className="rounded-xl border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isLoadingBalances ? 'animate-spin' : ''
                        }`}
                    />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExportKeysModal(true)}
                    className="rounded-xl border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  >
                    <Key className="mr-1 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {isLoadingWallet ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <div
                      key={i}
                      className="h-40 animate-pulse rounded-2xl border border-gray-200 bg-gray-100"
                    />
                  ))}
                </div>
              ) : (
                <>
                  {/* Connection Status */}
                  {publicKey && (
                    <div className="relative overflow-hidden rounded-xl border border-green-200 bg-green-100 p-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-100/50 to-emerald-100/50"></div>
                      <div className="relative flex items-start gap-3">
                        <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-green-800">
                            Wallet Connected
                          </p>
                          <p className="text-xs text-green-700">
                            Your Solana wallet is connected and ready to use.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wallet Cards */}
                  {walletInfo?.solana?.address && (
                    <WalletRow
                      label="Solana Wallet"
                      address={walletInfo.solana.address}
                      network="solana"
                      isMain={true}
                    />
                  )}

                  {/* Portfolio Summary */}
                  {tokenBalances && isAuthenticated && (
                    <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-100/20 via-transparent to-cyan-100/20"></div>
                      <div className="relative">
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-100">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-blue-700">
                              Portfolio Overview
                            </h3>
                            <p className="text-sm text-blue-600">
                              Your token holdings across networks
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          {Object.entries(tokenBalances).map(
                            ([tokenKey, tokenData]) => {
                              const balance = formatBalance(tokenData.balance);
                              const hasBalance = parseFloat(tokenData.balance) > 0;

                              return (
                                <div
                                  key={tokenKey}
                                  className="relative overflow-hidden rounded-xl border border-white bg-white p-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="text-lg">
                                        {getTokenIcon(tokenData.symbol)}
                                      </span>
                                      <div>
                                        <span className="text-sm font-semibold text-gray-900">
                                          {tokenData.symbol}
                                        </span>
                                        <p className="text-xs text-gray-500">
                                          {tokenKey.includes('solana')
                                            ? 'Solana'
                                            : tokenKey.includes('polygon')
                                              ? 'Polygon'
                                              : 'Solana'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span
                                        className={`text-sm font-bold ${hasBalance
                                            ? 'text-gray-900'
                                            : 'text-gray-400'
                                          }`}
                                      >
                                        {balance}
                                      </span>
                                      <p className="text-xs text-gray-500">
                                        {tokenData.symbol}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Security & Settings */}
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-100/50 to-gray-50"></div>
                    <div className="relative">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white">
                          <Shield className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">
                            Security & Settings
                          </h3>
                          <p className="text-sm text-gray-600">
                            Manage your wallet security and preferences
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExportKeysModal(true)}
                          className="h-12 rounded-xl border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Export Private Keys
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDisconnect}
                          className="h-12 rounded-xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Disconnect Wallet
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Keys Modal */}
      <Dialog open={exportKeysModal} onOpenChange={setExportKeysModal}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-md overflow-y-auto border border-red-200 bg-white shadow-2xl backdrop-blur-md sm:max-w-lg">
          <div className="absolute inset-0 bg-white"></div>
          <div className="relative">
            <DialogHeader className="space-y-4 pb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-200 bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl font-bold text-red-700">
                    Export Private Keys
                  </DialogTitle>
                  <p className="text-sm text-red-600">
                    Access your private keys (Advanced users only)
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              {/* Warning Section */}
              <div className="relative overflow-hidden rounded-xl border border-red-200 bg-red-100 p-6">
                <div className="absolute inset-0 bg-gradient-to-r from-red-100/50 to-rose-100/50"></div>
                <div className="relative">
                  <div className="mb-4 flex items-start gap-3">
                    <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0 text-red-600" />
                    <div>
                      <p className="mb-2 text-sm font-semibold text-red-800">
                        🚨 Critical Security Warning
                      </p>
                      <div className="space-y-2 text-xs text-red-700">
                        <p>• Never share your private keys with anyone</p>
                        <p>• Store them securely offline</p>
                        <p>• Anyone with access can steal your funds</p>
                        <p>• Only export if absolutely necessary</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Export Options - Private keys are managed server-side for security */}
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-600">
                    Private keys are securely managed by MaskedCash and cannot be exported directly.
                    Your wallet is protected with enterprise-grade security.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end">
                <Button
                  onClick={() => setExportKeysModal(false)}
                  className="h-10 rounded-xl bg-gray-600 text-white hover:bg-gray-500"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit/Withdraw Modal */}
      <DepositWithdrawModal
        isOpen={depositWithdrawModal.isOpen}
        onClose={() =>
          setDepositWithdrawModal(prev => ({ ...prev, isOpen: false }))
        }
        type={depositWithdrawModal.type}
        walletInfo={walletInfo}
        tokenBalances={tokenBalances}
        network={depositWithdrawModal.network}
      />
    </>
  );
}
