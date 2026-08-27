import { Check, CloudOff, Loader2, AlertCircle, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SaveStatus } from '@/hooks/useAutosave';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  label?: string;
  className?: string;
}

/**
 * Notion-style autosave indicator. Quiet and unobtrusive — never a popup.
 *  - idle / saved: muted "Saved" pill
 *  - dirty: "Unsaved changes"
 *  - saving: "Saving…" with spinner
 *  - error: "Save failed" in destructive color
 */
export function SaveStatusIndicator({ status, label, className }: SaveStatusIndicatorProps) {
  const config: Record<SaveStatus, { icon: React.ReactNode; text: string; tone: string }> = {
    idle: {
      icon: <Cloud className="h-3 w-3" />,
      text: label || 'Saved',
      tone: 'text-muted-foreground/70',
    },
    dirty: {
      icon: <CloudOff className="h-3 w-3" />,
      text: 'Unsaved',
      tone: 'text-muted-foreground',
    },
    saving: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      text: 'Saving…',
      tone: 'text-primary',
    },
    saved: {
      icon: <Check className="h-3 w-3" />,
      text: label || 'Saved',
      tone: 'text-success',
    },
    error: {
      icon: <AlertCircle className="h-3 w-3" />,
      text: 'Save failed',
      tone: 'text-destructive',
    },
  };

  const c = config[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide select-none transition-colors',
        c.tone,
        className,
      )}
      aria-live="polite"
    >
      {c.icon}
      {c.text}
    </span>
  );
}
