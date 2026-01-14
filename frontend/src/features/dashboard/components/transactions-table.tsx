import { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import {
  Receipt,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { useWallet } from '@/hooks/use-wallet';

interface Transaction {
  id: string;
  card_id: string;
  amount: number;
  merchant: string;
  category: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'purchase' | 'refund' | 'payment';
  masked_card_number?: string;
}

interface TransactionsResponse {
  transactions?: Transaction[];
  message?: string;
}

export function TransactionsTable() {
  const { makeAuthenticatedRequest, isAuthenticated } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Handle search events from the dashboard
  useEffect(() => {
    const handleSearch = (event: CustomEvent) => {
      setSearchTerm(event.detail);
    };

    window.addEventListener('transactionsSearch', handleSearch as EventListener);
    
    return () => {
      window.removeEventListener('transactionsSearch', handleSearch as EventListener);
    };
  }, []);

  // Query for transactions
  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', debouncedSearchTerm, isAuthenticated],
    queryFn: async (): Promise<TransactionsResponse> => {
      if (!isAuthenticated) {
        return { transactions: [] };
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const transactionsUrl = `${baseUrl}/api/transactions?limit=100&offset=0`;
      
      return await makeAuthenticatedRequest(transactionsUrl);
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAmountIcon = (amount: number, type: Transaction['type']) => {
    if (type === 'refund') {
      return <TrendingUp className="h-4 w-4 text-green-400" />;
    }
    return amount < 0 ? 
      <TrendingDown className="h-4 w-4 text-red-400" /> : 
      <TrendingUp className="h-4 w-4 text-green-400" />;
  };

  const formatAmount = (amount: number, type: Transaction['type']) => {
    const absAmount = Math.abs(amount);
    if (type === 'refund') {
      return `+$${absAmount.toFixed(2)}`;
    }
    return amount < 0 ? `-$${absAmount.toFixed(2)}` : `+$${absAmount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryEmoji = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'food': '🍔',
      'gas': '⛽',
      'shopping': '🛒',
      'healthcare': '🏥',
      'entertainment': '🎬',
      'travel': '✈️',
      'groceries': '🥬',
      'utilities': '⚡',
      'transport': '🚗',
      'purchase': '💳',
      'payment': '💰',
      'refund': '↩️',
    };
    return categoryMap[category.toLowerCase()] || '💳';
  };

  const openTransactionDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailsModalOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="py-16 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded bg-gray-100 dark:bg-gray-800">
          <Receipt className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        </div>
        <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
          Connect Your Wallet
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please connect and authenticate your Solana wallet to view transactions
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="banking-card">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <p className="mb-2 font-semibold text-red-700 dark:text-red-300">
          Failed to load transactions
        </p>
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const transactions = data?.transactions || [];
  const filteredTransactions = transactions.filter(transaction => 
    !debouncedSearchTerm || 
    transaction.merchant.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    transaction.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    transaction.amount.toString().includes(debouncedSearchTerm) ||
    transaction.status.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );

  return (
    <>
      <div className="w-full">
        {transactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded bg-gray-100 dark:bg-gray-800">
              <Receipt className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
            <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              No Transactions Yet
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your transaction history will appear here once you start using your cards
            </p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded bg-gray-100 dark:bg-gray-800">
              <Receipt className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
            <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
              No transactions found
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No transactions match your search for "{debouncedSearchTerm}"
            </p>
          </div>
        ) : (
          <div className="banking-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-gray-700">
                  <TableHead className="text-gray-700 dark:text-gray-300 font-semibold bg-gray-50 dark:bg-gray-800">
                    Transaction
                  </TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300 font-semibold bg-gray-50 dark:bg-gray-800">
                    Card
                  </TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300 font-semibold bg-gray-50 dark:bg-gray-800">
                    Amount
                  </TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300 font-semibold bg-gray-50 dark:bg-gray-800">
                    Status
                  </TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300 font-semibold bg-gray-50 dark:bg-gray-800">
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction, index) => (
                  <TableRow 
                    key={transaction.id} 
                    className={`border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                      index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'
                    }`}
                    onClick={() => openTransactionDetails(transaction)}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 dark:bg-gray-700">
                          <span className="text-sm">{getCategoryEmoji(transaction.category)}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{transaction.merchant}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{transaction.category}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                        {transaction.masked_card_number || '****'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {getAmountIcon(transaction.amount, transaction.type)}
                        <span className={`font-semibold ${
                          transaction.amount < 0 || transaction.type === 'purchase' 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`}>
                          {formatAmount(transaction.amount, transaction.type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(transaction.status)} text-white text-xs`}>
                        {getStatusIcon(transaction.status)}
                        <span className="ml-1 capitalize">{transaction.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(transaction.date)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              Transaction Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this transaction
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="banking-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getCategoryEmoji(selectedTransaction.category)}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedTransaction.merchant}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{selectedTransaction.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold ${
                      selectedTransaction.amount < 0 || selectedTransaction.type === 'purchase' 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {formatAmount(selectedTransaction.amount, selectedTransaction.type)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Transaction ID</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{selectedTransaction.id.slice(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Card</p>
                  <p className="text-gray-900 dark:text-gray-100">{selectedTransaction.masked_card_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Status</p>
                  <Badge className={`${getStatusColor(selectedTransaction.status)} text-white text-xs`}>
                    {getStatusIcon(selectedTransaction.status)}
                    <span className="ml-1 capitalize">{selectedTransaction.status}</span>
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Type</p>
                  <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedTransaction.type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Date & Time</p>
                  <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedTransaction.date)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}