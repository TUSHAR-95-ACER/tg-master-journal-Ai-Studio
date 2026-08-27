import { Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAICoach } from '@/contexts/AICoachContext';
import { cn } from '@/lib/utils';

interface HeaderActionsProps {
  className?: string;
  /** Optional page action buttons rendered to the right of the utilities (e.g. + New Day) */
  children?: React.ReactNode;
}

/**
 * Single global header-utility cluster.
 * Renders: ☀ Theme Toggle  +  [AI Coach]  +  (page action buttons)
 *
 * Drop into any page header's right-hand action area, e.g.
 *   <HeaderActions><Button>+ New Day</Button></HeaderActions>
 *
 * Or use standalone (no children) on pages with no page-level action.
 */
export function HeaderActions({ className, children }: HeaderActionsProps) {
  const { openDrawer } = useAICoach();
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ThemeToggle />
      <button
        onClick={openDrawer}
        title="Open AI Coach"
        className="h-8 px-3 rounded-full border border-primary/40 bg-card text-foreground hover:bg-primary/10 hover:border-primary/60 transition-colors flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider shadow-sm"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>AI Coach</span>
      </button>
      {children ? <div className="ml-2 flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
