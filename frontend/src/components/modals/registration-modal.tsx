import { useState, useEffect } from 'react';
import { useAuth, type UserType } from '@/context/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  const { isAuthenticated, user, register, login, isLoading, isRegistered } = useAuth();
  const { connected } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [userType, setUserType] = useState<UserType>('buyer');

  // Open modal if wallet is connected but user is not authenticated
  useEffect(() => {
    if (connected && !isAuthenticated && !user) {
      setIsOpen(true);
    } else {
        setIsOpen(false);
    }
  }, [connected, isAuthenticated, user]);

  const handleRegister = async () => {
    await register(userType);
  };

  const handleLogin = async () => {
    await login();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px] bg-[#020817] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>{isRegistered ? 'Welcome Back' : 'Create ShadowPay Account'}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isRegistered 
              ? 'Please sign a message to authenticate and access your account.' 
              : 'Sign a message to verify your identity and create your profile.'}
          </DialogDescription>
        </DialogHeader>

        {isRegistered === null ? (
           <div className="py-12 flex flex-col items-center justify-center space-y-4">
             <Loader2 className="w-8 h-8 text-primary animate-spin" />
             <p className="text-sm text-center text-muted-foreground">
               Checking registration status...
             </p>
           </div>
        ) : !isRegistered ? (
          <div className="grid gap-4 py-4">
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
        ) : (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Loader2 className={cn("w-8 h-8 text-primary", isLoading && "animate-spin")} />
            </div>
            <p className="text-sm text-center text-muted-foreground">
                Your wallet is registered. Sign the message to continue.
            </p>
          </div>
        )}

        <DialogFooter>
          {isRegistered ? (
            <Button onClick={handleLogin} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90">
              {isLoading ? (
                  <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing...
                  </>
              ) : (
                  'Sign In to Account'
              )}
            </Button>
          ) : (
            <Button onClick={handleRegister} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90">
              {isLoading ? (
                  <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing...
                  </>
              ) : (
                  'Create Account'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
