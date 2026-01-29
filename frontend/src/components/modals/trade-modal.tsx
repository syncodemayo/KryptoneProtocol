import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-context';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  otherPartyAddress: string;
  onTradeCreated: (trade: any) => void;
}

export function TradeModal({ isOpen, onClose, otherPartyAddress, onTradeCreated }: TradeModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [itemName, setItemName] = useState('');
  const [priceInSol, setPriceInSol] = useState('');
  const [description, setDescription] = useState('');

  const handleCreateTrade = async () => {
    if (!itemName || !priceInSol) {
      toast.error('Item name and price are required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('shadowpay_token');
      
      const payload: any = {
        itemName,
        description,
        priceInSol,
      };

      if (user?.type === 'seller') {
          payload.buyerWallet = otherPartyAddress;
      } else {
          payload.sellerAddress = otherPartyAddress;
      }

      const response = await fetch('http://localhost:5001/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Trade initiated successfully!');
        onTradeCreated(data.trade);
        onClose();
        // Reset form
        setItemName('');
        setPriceInSol('');
        setDescription('');
      } else {
        toast.error(data.error || 'Failed to initiate trade');
      }
    } catch (error) {
      console.error('Error creating trade:', error);
      toast.error('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-[#020817] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            Initiate Secure Trade
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create an escrow-protected trade. The funds will be held securely until you confirm receipt.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="itemName">Item Name</Label>
            <Input
              id="itemName"
              placeholder="e.g. Digital Artwork #123"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-primary"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="price">Price (SOL)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              placeholder="0.5"
              value={priceInSol}
              onChange={(e) => setPriceInSol(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-primary"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide details about the item or terms of trade"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-primary"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-white hover:bg-white/10">
            Cancel
          </Button>
          <Button onClick={handleCreateTrade} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initiating...
              </>
            ) : (
              'Create Trade'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
