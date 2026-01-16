import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectButtonProps {
  className?: string;
}

export function ConnectButton({ className }: ConnectButtonProps) {
  const { connected, publicKey } = useWallet();

  return (
    <WalletMultiButton 
      style={{ borderRadius: '9999px' }} // Fallback/Force rounded full
      className={cn(
        "!bg-primary !transition-all !duration-300 hover:!opacity-90",
        // Default styles that can be overridden
        "!text-white !font-medium !h-10 !px-6",
        className
      )}
    >
        <span className="flex items-center gap-2">
             <Wallet className="w-5 h-5 mr-1" />
             {connected && publicKey ? (
                 <span>{publicKey.toBase58().slice(0, 4) + '..' + publicKey.toBase58().slice(-4)}</span>
             ) : (
                 <span>Connect Wallet</span>
             )}
        </span>
    </WalletMultiButton>
  );
}
