import { useState, useEffect } from 'react';
import { useAuth, type UserType } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';

export function RegistrationModal() {
  const { isAuthenticated, user, register, isLoading } = useAuth();
  const { connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [userType, setUserType] = useState<UserType>('buyer');

  // Open modal if wallet is connected but user is not authenticated/registered
  useEffect(() => {
    if (connected && !isAuthenticated && !user) {
      setIsOpen(true);
    } else {
        setIsOpen(false);
    }
  }, [connected, isAuthenticated, user]);

  const handleRegister = async () => {
    if (!name.trim()) return;
    await register(name, userType);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] bg-[#020817] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Create ShadowPay Account</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Sign a message to verify your identity and create your profile.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="text-white">Display Name</Label>
            <Input
              id="name"
              placeholder="Enter your username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-primary"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type" className="text-white">Account Type</Label>
            <Select value={userType} onValueChange={(val: UserType) => setUserType(val)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Select user type" />
              </SelectTrigger>
              <SelectContent className="bg-[#020817] border-white/10 text-white">
                <SelectItem value="buyer">Buyer (I want to buy goods using crypto)</SelectItem>
                <SelectItem value="seller">Seller (I want to sell goods using crypto)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleRegister} disabled={isLoading || !name.trim()} className="w-full bg-primary hover:bg-primary/90">
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing...
                </>
            ) : (
                'Create Account'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
