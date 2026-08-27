import { memo } from 'react';
import { Edit, Trash2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trade } from '@/types/trading';
import { getDayOfWeek } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface Props {
  trade: Trade;
  onSelect: (t: Trade) => void;
  onEdit: (t: Trade) => void;
  onDelete: (id: string) => void;
}

// Memoized row: skips re-render unless the specific trade object OR one of the
// stable handler identities changes. Parent must supply useCallback handlers.
function TradeTableRowImpl({ trade, onSelect, onEdit, onDelete }: Props) {
  const resultStyles: Record<string, string> = {
    Win: 'bg-success/15 text-success border border-success/30',
    Loss: 'bg-destructive/15 text-destructive border border-destructive/30',
    Breakeven: 'bg-muted text-muted-foreground border border-border',
    'Untriggered Setup': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25',
    Cancelled: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25',
  };
  return (
    <tr
      className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors h-8"
      onClick={() => onSelect(trade)}
    >
      <td className="px-3 py-1.5 font-mono text-xs">{trade.date}</td>
      <td className="px-3 py-1.5 text-xs text-muted-foreground">{getDayOfWeek(trade.date).slice(0, 3)}</td>
      <td className="px-3 py-1.5 font-medium text-xs">
        <span className="inline-flex items-center gap-1.5">
          {trade.asset}
          {trade.status && trade.status !== 'Complete' && (
            <span className={cn(
              'text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border',
              trade.status === 'Draft' && 'border-muted-foreground/30 text-muted-foreground bg-muted/30',
              trade.status === 'Incomplete' && 'border-warning/40 text-warning bg-warning/10',
              trade.status === 'Needs Review' && 'border-primary/40 text-primary bg-primary/10',
            )}>{trade.status}</span>
          )}
        </span>
      </td>
      <td className="px-3 py-1.5 text-xs">{trade.setup}</td>
      <td className="px-3 py-1.5 text-xs text-muted-foreground">{trade.session}</td>
      <td className="px-3 py-1.5 text-xs">
        <span className={trade.direction === 'Long' ? 'text-success' : 'text-destructive'}>{trade.direction}</span>
      </td>
      <td className="px-3 py-1.5 font-mono text-xs">{trade.quantity ?? '-'}</td>
      <td className="px-3 py-1.5 font-mono text-xs">{trade.actualRR?.toFixed(2) ?? '-'}</td>
      <td className={cn('px-3 py-1.5 font-mono text-xs font-medium',
        trade.result === 'Untriggered Setup' || trade.result === 'Cancelled' ? 'text-muted-foreground' :
        trade.profitLoss >= 0 ? 'text-success' : 'text-destructive')}>
        {trade.result === 'Untriggered Setup' || trade.result === 'Cancelled' ? '—' : `${trade.profitLoss >= 0 ? '+' : ''}${trade.profitLoss.toFixed(2)}`}
      </td>
      <td className="px-3 py-1.5 text-xs font-medium">{trade.grade || '—'}</td>
      <td className="px-3 py-1.5">
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', resultStyles[trade.result])}>{trade.result}</span>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(trade)}>
            <Edit className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Trade</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(trade.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {trade.chartLink && (
            <a href={trade.chartLink} target="_blank" rel="noopener noreferrer" className="text-primary">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

export const TradeTableRow = memo(TradeTableRowImpl);
export { ChevronDown as _ChevronDown, ChevronUp as _ChevronUp };
