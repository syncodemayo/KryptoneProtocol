import { useEffect, useState } from 'react';
import { useRouter } from '@tanstack/react-router';

import { cn } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean;
  ref?: React.Ref<HTMLElement>;
};

export function Header({ className, fixed, children, ...props }: HeaderProps) {
  const [offset, setOffset] = useState(0);
  const router = useRouter();
  const { isAuthenticated } = useWallet();

  const handleLogoClick = () => {
    const targetPath = isAuthenticated ? '/cards' : '/';
    router.navigate({ to: targetPath });
  };

  useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop);
    };

    document.addEventListener('scroll', onScroll, { passive: true });
    return () => document.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'relative z-50 h-16 bg-white border-b border-gray-100',
        fixed && 'header-fixed peer/header sticky top-0 w-[inherit]',
        offset > 10 && 'shadow-sm',
        className
      )}
      {...props}
    >
      <div className="relative flex h-full items-center justify-between px-6 sm:px-8 max-w-7xl mx-auto">
        {/* Light theme logo */}
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={handleLogoClick}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-lg">
              <img
                src="/images/logo.png"
                alt="MaskedCash"
                className="h-16 w-16 brightness-0"
              />
            </div>
            <span className="text-xl font-semibold text-gray-900">
              MaskedCash
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {children}
        </div>
      </div>
    </header>
  );
}
