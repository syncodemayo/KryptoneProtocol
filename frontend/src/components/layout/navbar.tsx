import { useState, useEffect } from 'react';
import { Menu, X, ChevronRight } from 'lucide-react';
import { ConnectButton } from '@/components/ui/connect-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Link } from 'react-router-dom';
// Wallet styles imported in App.tsx or already global, but good to keep if needed, though WalletMultiButton is gone.
import '@solana/wallet-adapter-react-ui/styles.css';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { isAuthenticated, user } = useAuth(); // Using AuthContext for reliable state

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Conditional links based on auth state
  const navLinks = isAuthenticated ? [
      { name: 'Marketplace', href: '/market' },
      { name: 'Conversations', href: '/conversations' },
      { name: 'My Trades', href: '/trades' }
  ].filter(link => !(user?.type === 'seller' && link.name === 'Marketplace')) : [
    { name: 'Features', href: '#features' },
    { name: 'Network', href: '#stats' },
    { name: 'Join', href: '#join' },
  ];

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out',
        isScrolled
          ? 'bg-background/60 backdrop-blur-xl border-b border-white/10 py-3 shadow-lg shadow-black/5'
          : 'bg-transparent border-transparent py-6'
      )}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">
                Kryptone Protocol
              </span>
              <span className="text-[10px] font-medium tracking-widest text-white/80 uppercase">Trustless Protocol</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <div className="flex items-center gap-1 p-1 rounded-full border border-white/5 bg-white/5 backdrop-blur-md">
              {navLinks.map((link) => (
                link.href.startsWith('#') ? (
                    <a
                      key={link.name}
                      href={link.href}
                      className="relative px-5 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-white/5"
                    >
                      {link.name}
                    </a>
                ) : (
                    <Link
                      key={link.name}
                      to={link.href}
                      className="relative px-5 py-2 text-sm font-medium text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-white/5"
                    >
                      {link.name}
                    </Link>
                )
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated && user && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "px-3 py-1 uppercase tracking-wider text-[10px] font-bold border shadow-[0_0_10px_-3px_rgba(0,0,0,0.3)]",
                    user.type === 'seller' 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/20" 
                      : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-cyan-500/20"
                  )}
                >
                    {user.type}
                </Badge>
            )}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-600 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative">
                    <ConnectButton className="!bg-background/80 !backdrop-blur-md !border !border-white/20 !rounded-xl hover:!bg-background/90 group-hover:shadow-[0_0_20px_-5px_var(--primary)]" />
                </div>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-white/10"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#020817]/95 backdrop-blur-2xl border-b border-white/10 p-4 flex flex-col gap-2 shadow-2xl animate-in slide-in-from-top-5 duration-300">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors text-base font-medium text-white/90"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="flex items-center gap-3">
                    <span className="w-1 h-1 rounded-full bg-primary/50" />
                    {link.name}
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </a>
            ))}
            <div className="pt-4 mt-2 border-t border-white/10 flex flex-col items-center gap-4 w-full">
                 {isAuthenticated && user && (
                     <Badge 
                       variant="outline" 
                       className={cn(
                         "px-3 py-1 uppercase tracking-wider text-[10px] font-bold border",
                         user.type === 'seller' 
                           ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                           : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                       )}
                     >
                         {user.type}
                     </Badge>
                 )}
                 <ConnectButton className="!w-full !justify-center !bg-primary !h-12 !rounded-xl" />
            </div>
        </div>
      )}
    </nav>
  );
}
