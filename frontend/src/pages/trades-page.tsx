import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/lib/config';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Trade {
  tradeId: string;
  itemName: string;
  description: string;
  priceInSol: number;
  status: string;
  sellerAddress: string;
  buyerAddress: string;
  createdAt: string;
}

export function TradesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTrades();
  }, []);

  const fetchTrades = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/trades`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('shadowpay_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch trades');
      const data = await response.json();
      setTrades(data.trades);
    } catch (error) {
      console.error('Error fetching trades:', error);
      toast.error('Failed to load trades');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'ACCEPTED': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'DEPOSIT_PENDING': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'DEPOSIT_CONFIRMED': return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'SUCCESS': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'REJECTED': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'CANCELLED': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">My Trades</h1>
          <p className="text-muted-foreground">Manage and track your active escrow trades.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trades.map(trade => (
              <Card 
                key={trade.tradeId} 
                className="bg-[#0f172a]/40 border-white/10 overflow-hidden hover:border-primary/50 hover:bg-white/[0.08] hover:shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)] transition-all duration-300 group cursor-pointer"
                onClick={() => navigate(`/trades/${trade.tradeId}`)}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className={getStatusColor(trade.status)}>
                      {trade.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(trade.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-xl font-semibold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {trade.itemName}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {trade.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Price</span>
                      <span className="text-lg font-bold text-white">{trade.priceInSol} SOL</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Role</span>
                      <div className="text-sm font-medium text-white">
                        {trade.sellerAddress === user?.address ? 'Seller' : 'Buyer'}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-white/5 py-3 px-6 flex justify-between items-center">
                  <span className="text-xs text-white/40 font-mono truncate max-w-[150px]">
                    ID: {trade.tradeId.split('_')[1]}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-white group-hover:translate-x-1 transition-transform">
                    Details <ArrowRight className="w-3 h-3" />
                  </span>
                </CardFooter>
              </Card>
            ))}

            {trades.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 px-4 rounded-3xl border border-dashed border-white/10 bg-white/5">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-white/20" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No trades found</h3>
                <p className="text-muted-foreground text-center max-w-xs">
                  You haven't participated in any trades yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
