import { ChevronRight, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';

interface PlanListItemProps {
  onClick: () => void;
  onDelete?: () => void;
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: ReactNode;
  accentColor?: string;
}

export function PlanListItem({ onClick, onDelete, title, subtitle, meta, icon, accentColor }: PlanListItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={cn(
        'w-full text-left rounded-xl border border-border/50 bg-card px-5 py-4',
        'hover:border-primary/30 hover:shadow-[var(--shadow-elevated)] transition-all duration-200',
        'group relative overflow-hidden'
      )}
    >
      {/* Subtle left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-center justify-between">
        <button onClick={onClick} className="flex items-center gap-4 flex-1 min-w-0 text-left">
          {icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground block truncate">{title}</span>
            {subtitle && <span className="text-xs text-muted-foreground mt-0.5 block truncate">{subtitle}</span>}
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {meta && (
            <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
              {meta}
            </span>
          )}

          {/* Edit (click row) indicator */}
          <button onClick={onClick} className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
          </button>

          {/* Delete */}
          {onDelete && !confirmDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          )}

          {/* Confirm delete */}
          {onDelete && confirmDelete && (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-[10px] rounded-lg px-2.5 font-semibold"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] rounded-lg px-2 font-medium"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
              >
                Cancel
              </Button>
            </div>
          )}

          {!confirmDelete && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
      </div>
    </div>
  );
}
