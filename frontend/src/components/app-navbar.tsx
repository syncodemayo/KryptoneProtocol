import { useRouter } from '@tanstack/react-router';

import { ConnectWallet } from '@/components/connect-wallet';
import { Header } from '@/components/layout/header';
import { TopNav } from '@/components/layout/top-nav';
import { ThemeSwitch } from '@/components/theme-switch';
import { useWallet } from '@/hooks/use-wallet';

interface NavLink {
  title: string;
  href: string;
  disabled?: boolean;
}

const NAV_LINKS: NavLink[] = [
  {
    title: 'Credit Cards',
    href: '/cards',
    disabled: false,
  },
  {
    title: 'My Account',
    href: '/my-account',
    disabled: false,
  },
];

export function AppNavbar() {
  const router = useRouter();
  const currentPath = router.state.location.pathname;
  const { isAuthenticated } = useWallet();

  // Only show navigation links when user is authenticated
  const availableLinks = isAuthenticated ? NAV_LINKS : [];

  // Map navigation links with active state
  const topNavLinks = availableLinks.map(link => ({
    ...link,
    isActive: currentPath === link.href,
  }));

  return (
    <Header>
      <TopNav links={topNavLinks} />
      <div className="ms-auto flex items-center space-x-4">
        <ThemeSwitch />
        <ConnectWallet />
      </div>
    </Header>
  );
}
