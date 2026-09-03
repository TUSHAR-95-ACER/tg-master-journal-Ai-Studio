import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MarketTicker } from '@/components/news/MarketTicker';
import { AICoachProvider, useAICoach } from '@/contexts/AICoachContext';
import { AICoachDrawer } from '@/components/ai/AICoachDrawer';
import { RouteSeo } from '@/components/seo/RouteSeo';
import { useAuth } from '@/contexts/AuthContext';
import { isRecoveryActive } from '@/lib/recoveryState';


const PATH_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/trades': 'Trades',
  '/accounts': 'Accounts',
  '/notebook': 'Notebook',
  '/macro-intelligence': 'Macro Intelligence',
  '/weekly-plan': 'Weekly Plans',
  '/daily-plan': 'Daily Plans',
  '/trading-checklist': 'Trading Checklist',
  '/weekly-review': 'Weekly Review',
  '/psychology': 'Psychology',
  '/mistakes': 'Mistakes',
  '/setup-playbook': 'Setup Playbook',
  '/analytics': 'Analytics',
  '/bias-analytics': 'Bias Analytics',
  '/behavior-patterns': 'Behavior Patterns',
  '/trade-quality': 'Trade Quality',
  '/ai-insights': 'AI Insights',
  '/research-lab': 'Research Lab',
  '/calendar': 'Calendar',
  '/trading-rules': 'Trading Rules',
  '/control-center': 'Control Center',
  '/system-analytics': 'System Analytics',
  '/settings': 'Settings',
};

function PageContextRegistrar() {
  const { pathname } = useLocation();
  const { setPage } = useAICoach();
  useEffect(() => {
    const label = PATH_LABELS[pathname] || `Page: ${pathname}`;
    setPage({ label, detail: `The trader is currently on the "${label}" page (route ${pathname}). Focus your reply on this page's purpose unless they ask something broader.` });
  }, [pathname, setPage]);
  return null;
}

function ShellInner() {
  const { isPasswordRecovery } = useAuth();

  if (isPasswordRecovery || isRecoveryActive()) {
    console.info('[auth-recovery] AppLayout blocked journal view due to active recovery - redirecting to /reset-password');
    return <Navigate to="/reset-password" replace />;
  }

  console.info('[auth-debug] AppLayout rendered (no redirect)', {
    isPasswordRecovery,
    isRecoveryActive: isRecoveryActive(),
    userId: 'present',
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <MarketTicker />
        <main className="flex-1 overflow-y-auto font-body [&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading [&_h1]:uppercase [&_h2]:uppercase [&_h3]:uppercase">
          <Outlet />
        </main>
      </div>
      <AICoachDrawer />
      <PageContextRegistrar />
      <RouteSeo />
    </div>
  );
}


export function AppLayout() {
  return (
    <AICoachProvider>
      <ShellInner />
    </AICoachProvider>
  );
}
