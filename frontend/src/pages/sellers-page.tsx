// ... imports
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { User, MessageCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';

interface Seller {
  address: string;
  name: string;
  type: string;
  createdAt?: string;
  completionRate?: number;
}

export function SellersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/sellers');
        if (!response.ok) {
          throw new Error('Failed to fetch sellers');
        }
        const data = await response.json();
        if (data.success) {
          setSellers(data.sellers);
        } else {
          toast.error(data.error || 'Failed to load sellers');
        }
      } catch (error) {
        console.error('Error fetching sellers:', error);
        toast.error('Connection error. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchSellers();
  }, []);

  const handleStartChat = (sellerAddress: string) => {
    if (!user) {
        toast.error('Please login to start a chat');
        return;
    }
    // Always start new chat context (generic chat page)
    navigate(`/chat/${sellerAddress}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
         <h1 className="text-3xl font-bold text-white tracking-tight">Marketplace</h1>
         <p className="text-muted-foreground">Find verified sellers to buy goods securely.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-gray-400">Loading marketplace...</p>
        </div>
      ) : sellers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sellers.map((seller: Seller, index: number) => (
            <Card key={index} className="bg-white/5 border-white/10 text-white backdrop-blur-sm hover:bg-white/10 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-medium">
                  {seller.name}
                </CardTitle>
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                   <User className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground font-mono bg-black/40 p-2 rounded truncate">
                  {seller.address}
                </div>
                <CardDescription className="pt-2 text-gray-400">
                  {seller.completionRate !== undefined ? `${seller.completionRate}% Completion Rate` : 'No Rating Yet'}
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Button onClick={() => handleStartChat(seller.address)} className="w-full gap-2 bg-white text-black hover:bg-white/90">
                  <MessageCircle className="w-4 h-4" />
                  Start Chat
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-xl">
          <User className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">No Sellers Found</h3>
          <p className="text-gray-400">There are currently no registered sellers in the marketplace.</p>
        </div>
      )}
    </div>
  );
}
