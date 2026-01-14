import { useEffect } from 'react';

import { Check, Monitor, Moon, Sun } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/context/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();

  /* Update theme-color meta tag
   * when theme is updated */
  useEffect(() => {
    const themeColor = theme === 'dark' ? '#0f0f23' : '#fff';
    const metaThemeColor = document.querySelector("meta[name='theme-color']");
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor);
  }, [theme]);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuContent
        align="end"
        className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-slate-900/95 via-purple-900/80 to-slate-900/95 p-2 backdrop-blur-xl"
      >
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="group flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-500/20"
        >
          <Sun className="h-4 w-4 text-cyan-400 transition-colors group-hover:text-cyan-300" />
          <span className="font-medium text-slate-300 group-hover:text-white">
            Light
          </span>
          <Check
            size={14}
            className={cn(
              'ml-auto text-cyan-400',
              theme !== 'light' && 'hidden'
            )}
          />
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="group flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20"
        >
          <Moon className="h-4 w-4 text-purple-400 transition-colors group-hover:text-purple-300" />
          <span className="font-medium text-slate-300 group-hover:text-white">
            Dark
          </span>
          <Check
            size={14}
            className={cn(
              'ml-auto text-purple-400',
              theme !== 'dark' && 'hidden'
            )}
          />
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="group flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300 hover:bg-gradient-to-r hover:from-indigo-500/20 hover:to-slate-500/20"
        >
          <Monitor className="h-4 w-4 text-indigo-400 transition-colors group-hover:text-indigo-300" />
          <span className="font-medium text-slate-300 group-hover:text-white">
            System
          </span>
          <Check
            size={14}
            className={cn(
              'ml-auto text-indigo-400',
              theme !== 'system' && 'hidden'
            )}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
