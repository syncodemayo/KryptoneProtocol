import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { User, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Mock data if local storage is empty
const MOCK_SELLERS = [
  { address: '8x...2k9a', name: 'CryptoKing', type: 'seller' },
  { address: '3m...9s2p', name: 'SafeTrader_007', type: 'seller' },
  { address: '9x...1m3k', name: 'FastEscrow', type: 'seller' },
  { address: '7l...4n2j', name: 'SolanaWhale', type: 'seller' },
];

export function SellersPage() {
  const navigate = useNavigate();
  
  // Combine mock data with local storage sellers
  const storedSellers = JSON.parse(localStorage.getItem('shadowpay_sellers') || '[]');
  // Filter out duplicates based on address, preferring stored (registered) ones? 
  // For simplicity, just combining or using mocks if empty.
  const sellers = storedSellers.length > 0 ? storedSellers : MOCK_SELLERS;

  const handleStartChat = (sellerAddress: string) => {
    navigate(`/chat/${sellerAddress}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
         <h1 className="text-3xl font-bold text-white tracking-tight">Marketplace</h1>
         <p className="text-muted-foreground">Find verified sellers to buy goods securely.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sellers.map((seller: any, index: number) => (
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
                Verified Seller • 98% Completion Rate
              </CardDescription>
            </CardContent>
            <CardFooter>
              <Button onClick={() => handleStartChat(seller.address)} className="w-full gap-2 bg-gradient-to-r from-primary to-blue-600 hover:opacity-90">
                <MessageCircle className="w-4 h-4" />
                Start Chat
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
