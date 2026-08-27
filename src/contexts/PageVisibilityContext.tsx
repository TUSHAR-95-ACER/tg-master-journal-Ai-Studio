import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// All toggleable pages (Settings is always visible)
export const TOGGLEABLE_PAGES = [
  { path: '/', label: 'Dashboard', section: 'OVERVIEW' },
  { path: '/trades', label: 'Trades', section: 'OVERVIEW' },
  { path: '/accounts', label: 'Accounts', section: 'OVERVIEW' },
  { path: '/notebook', label: 'Notebook', section: 'OVERVIEW' },
  
  { path: '/weekly-plan', label: 'Weekly Plan', section: 'PLANNING & REVIEW' },
  { path: '/daily-plan', label: 'Daily Plan', section: 'PLANNING & REVIEW' },
  { path: '/weekly-review', label: 'Weekly Review', section: 'PLANNING & REVIEW' },
  { path: '/psychology', label: 'Psychology', section: 'PLANNING & REVIEW' },
  { path: '/mistakes', label: 'Mistakes', section: 'PLANNING & REVIEW' },
  { path: '/setup-playbook', label: 'Setup Playbook', section: 'PLANNING & REVIEW' },
  { path: '/trading-checklist', label: 'Trading Checklist', section: 'PLANNING & REVIEW' },
  { path: '/analytics', label: 'Analytics', section: 'INTELLIGENCE' },
  { path: '/bias-analytics', label: 'Bias Analytics', section: 'INTELLIGENCE' },
  { path: '/behavior-patterns', label: 'Behavior', section: 'INTELLIGENCE' },
  { path: '/trade-quality', label: 'Trade Quality', section: 'INTELLIGENCE' },
  { path: '/ai-insights', label: 'AI Insights', section: 'INTELLIGENCE' },
  { path: '/research-lab', label: 'Research Lab', section: 'INTELLIGENCE' },
  { path: '/backtesting-lab', label: 'Backtest Lab', section: 'INTELLIGENCE' },
  { path: '/trading-rules', label: 'Trading Rules', section: 'SYSTEM' },
  { path: '/control-center', label: 'Control Center', section: 'SYSTEM' },
  
  { path: '/calendar', label: 'Calendar', section: 'OVERVIEW' },
] as const;

type PagePath = typeof TOGGLEABLE_PAGES[number]['path'];

interface PageVisibilityContextType {
  isPageEnabled: (path: string) => boolean;
  togglePage: (path: string) => void;
  enabledPages: Record<string, boolean>;
  enableAll: () => void;
  disableAllExcept: (paths: string[]) => void;
}

const STORAGE_KEY = 'page-visibility-prefs';

function getDefaults(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  TOGGLEABLE_PAGES.forEach((p) => {
    defaults[p.path] = true;
  });
  return defaults;
}

const fallbackContext: PageVisibilityContextType = {
  isPageEnabled: () => true,
  togglePage: () => undefined,
  enabledPages: getDefaults(),
  enableAll: () => undefined,
  disableAllExcept: () => undefined,
};

const PageVisibilityContext = createContext<PageVisibilityContextType>(fallbackContext);

export function PageVisibilityProvider({ children }: { children: ReactNode }) {
  const [enabledPages, setEnabledPages] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...getDefaults(), ...parsed };
      }
    } catch {}

    return getDefaults();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledPages));
  }, [enabledPages]);

  const isPageEnabled = (path: string) => enabledPages[path] !== false;

  const togglePage = (path: string) => {
    setEnabledPages((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const enableAll = () => setEnabledPages(getDefaults());

  const disableAllExcept = (paths: string[]) => {
    const next: Record<string, boolean> = {};
    TOGGLEABLE_PAGES.forEach((p) => {
      next[p.path] = paths.includes(p.path);
    });
    setEnabledPages(next);
  };

  return (
    <PageVisibilityContext.Provider value={{ isPageEnabled, togglePage, enabledPages, enableAll, disableAllExcept }}>
      {children}
    </PageVisibilityContext.Provider>
  );
}

export function usePageVisibility() {
  return useContext(PageVisibilityContext);
}
