import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PlanSectionProps {
  title: string;
  icon?: ReactNode;
  badge?: string;
  children: ReactNode;
  className?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive';
}

const accentMap = {
  primary: 'from-primary/20 to-primary/5 border-primary/20',
  success: 'from-success/20 to-success/5 border-success/20',
  warning: 'from-warning/20 to-warning/5 border-warning/20',
  destructive: 'from-destructive/20 to-destructive/5 border-destructive/20',
};

const dotMap = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

export function PlanSection({ title, icon, badge, children, className, accent = 'primary' }: PlanSectionProps) {
  return (
    <div className={cn('relative group', className)}>
      {/* Accent gradient top bar */}
      <div className={cn(
        'rounded-2xl border border-border/60 bg-card overflow-hidden',
        'shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow duration-300'
      )}>
        {/* Header */}
        <div className={cn(
          'px-6 py-4 border-b border-border/40 bg-gradient-to-r',
          accentMap[accent]
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('h-2 w-2 rounded-full', dotMap[accent])} />
              {icon && <span className="text-muted-foreground">{icon}</span>}
              <h2 className="font-heading text-sm font-bold tracking-wide uppercase text-foreground">
                {title}
              </h2>
            </div>
            {badge && (
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                {badge}
              </span>
            )}
          </div>
        </div>
        {/* Content */}
        <div className="p-6 space-y-5">
          {children}
        </div>
      </div>
    </div>
  );
}
