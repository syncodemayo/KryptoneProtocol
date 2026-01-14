import { Link } from '@tanstack/react-router';

import { CreditCard, FileText, User, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type TopNavProps = React.HTMLAttributes<HTMLElement> & {
  links: {
    title: string;
    href: string;
    isActive: boolean;
    disabled?: boolean;
  }[];
};

export function TopNav({ className, links, ...props }: TopNavProps) {
  // Light theme icon mapping
  const getNavIcon = (title: string) => {
    switch (title.toLowerCase()) {
      case 'credit cards':
        return <CreditCard className="h-4 w-4" />;
      case 'transactions':
        return <FileText className="h-4 w-4" />;
      case 'my account':
        return <User className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-gray-600 hover:bg-gray-100"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            className="w-48 border-gray-200 bg-white shadow-lg"
          >
            {links.map(({ title, href, isActive, disabled }) => (
              <DropdownMenuItem key={`${title}-${href}`} asChild>
                <Link
                  to={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                  disabled={disabled}
                >
                  {getNavIcon(title)}
                  <span>{title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop Navigation - Light theme pills */}
      <nav
        className={cn('hidden items-center lg:flex', className)}
        {...props}
      >
        <div className="flex items-center bg-gray-100 rounded-full p-1">
          {links.map(({ title, href, isActive, disabled }) => (
            <Link
              key={`${title}-${href}`}
              to={href}
              disabled={disabled}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {getNavIcon(title)}
              <span>{title}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
