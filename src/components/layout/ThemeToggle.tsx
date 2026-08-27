import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark';

const THEMES: { id: Theme; label: string; color: string }[] = [
  { id: 'light', label: 'Light', color: 'bg-[hsl(40,20%,98%)]' },
  { id: 'dark', label: 'Dark', color: 'bg-[hsl(222,47%,7%)]' },
];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-purple', 'theme-sunset');
  if (theme === 'dark') root.classList.add('dark');
  localStorage.setItem('ef-theme', theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('ef-theme') as Theme;
    if (saved && ['light', 'dark'].includes(saved)) return saved;
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  useEffect(() => { applyTheme(theme); }, [theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {THEMES.map(t => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn('gap-2 cursor-pointer', theme === t.id && 'bg-accent')}
          >
            <span className={cn('h-4 w-4 rounded-full border border-border shrink-0', t.color)} />
            <span className="text-xs font-medium">{t.label}</span>
            {theme === t.id && <span className="ml-auto text-[10px] text-primary">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
