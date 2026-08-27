import { ReactNode } from 'react';
import { HeaderActions } from '@/components/layout/HeaderActions';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';

interface PlanListHeaderProps {
  title: string;
  subtitle: string;
  onNew: () => void;
  newLabel?: string;
}

export function PlanListHeader({ title, subtitle, onNew, newLabel = 'New Plan' }: PlanListHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground font-medium">{subtitle}</p>
      </div>
      <HeaderActions>
        <Button onClick={onNew} size="sm" className="gap-2 rounded-xl font-semibold shadow-sm">
          <Plus className="h-4 w-4" />
          {newLabel}
        </Button>
      </HeaderActions>
    </div>
  );
}

interface PlanDetailHeaderProps {
  onBack: () => void;
  backLabel?: string;
  children?: ReactNode;
}

export function PlanDetailHeader({ onBack, backLabel = 'Back to plans', children }: PlanDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        {backLabel}
      </button>
      <HeaderActions>{children}</HeaderActions>
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
  icon?: ReactNode;
}

export function PlanEmptyState({ message, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {icon && (
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-5">
          {icon}
        </div>
      )}
      <p className="text-muted-foreground font-medium">{message}</p>
      <Button onClick={onAction} variant="outline" size="sm" className="mt-5 rounded-xl font-semibold">
        {actionLabel}
      </Button>
    </div>
  );
}
