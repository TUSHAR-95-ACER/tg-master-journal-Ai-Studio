import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Copy, Archive, Trash2, ArrowRight } from 'lucide-react';
import { Strategy } from '@/types/research';
import { summarizeStrategy } from '@/lib/researchAnalytics';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<Strategy['status'], string> = {
  Testing:    'bg-primary/10 text-primary border-primary/30',
  Promising:  'bg-primary/10 text-primary border-primary/30',
  Validated:  'bg-[hsl(var(--gold)/0.12)] text-[hsl(var(--gold))] border-[hsl(var(--gold)/0.45)] shadow-[0_0_0_1px_hsl(var(--gold)/0.15)_inset]',
  Failed:     'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  Archived:   'bg-muted text-muted-foreground border-border',
};

const ACCENT: Record<string, string> = {
  blue: 'from-blue-500/15', emerald: 'from-emerald-500/15', amber: 'from-amber-500/15',
  purple: 'from-purple-500/15', rose: 'from-rose-500/15', cyan: 'from-cyan-500/15',
  orange: 'from-orange-500/15', slate: 'from-slate-500/15',
};

interface Props {
  strategy: Strategy;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function StrategyCard({ strategy, onOpen, onEdit, onDuplicate, onArchive, onDelete }: Props) {
  const kpi = summarizeStrategy(strategy);
  return (
    <Card
      onClick={onOpen}
      className={cn(
        'group relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5',
        'bg-gradient-to-br to-card', ACCENT[strategy.color] || 'from-primary/10',
      )}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-2xl shrink-0">{strategy.icon}</div>
            <div className="min-w-0">
              <h3 className="font-heading font-semibold truncate">{strategy.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{strategy.type}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Rename / Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}><Archive className="h-4 w-4 mr-2" />Archive</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {strategy.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{strategy.description}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Tests" value={String(kpi.totalTests)} />
          <Stat label="Win Rate" value={`${kpi.winRate.toFixed(0)}%`} accent={kpi.winRate >= 50 ? 'success' : undefined} />
          <Stat label="Avg RR" value={kpi.avgRR ? kpi.avgRR.toFixed(2) : '—'} />
          <Stat label="Bias Acc" value={`${kpi.biasAccuracy.toFixed(0)}%`} />
          <Stat label="Validation" value={`${kpi.validationScore}`} accent="gold" />
          <div className="flex items-center">
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', STATUS_STYLES[strategy.status])}>
              {strategy.status}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end pt-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Open <ArrowRight className="h-3 w-3 ml-1" />
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'success' | 'primary' | 'gold' }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', accent === 'success' && 'text-success', accent === 'primary' && 'text-primary', accent === 'gold' && 'text-gold')}>{value}</span>
    </div>
  );
}
