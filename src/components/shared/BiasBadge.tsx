import { cn } from '@/lib/utils';
import { BIAS_OPTIONS, getBiasMeta, type Bias } from '@/lib/bias';
import { SelectContent, SelectItem } from '@/components/ui/select';

interface BiasBadgeProps {
  bias: string | undefined | null;
  size?: 'sm' | 'md';
  hideNeutral?: boolean;
  className?: string;
}

/** Pill badge with directional icon — use anywhere a bias label is shown. */
export function BiasBadge({ bias, size = 'sm', hideNeutral = false, className }: BiasBadgeProps) {
  const meta = getBiasMeta(bias);
  if (!meta) return null;
  if (hideNeutral && meta.value === 'Neutral') return null;
  const Icon = meta.icon;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-mono font-bold uppercase tracking-widest rounded-full border',
      size === 'sm' ? 'text-[10px] px-2.5 py-1' : 'text-xs px-3 py-1.5',
      meta.text, meta.bg, meta.border,
      className,
    )}>
      <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

/** Inline icon-only variant. */
export function BiasIcon({ bias, className }: { bias: string | undefined | null; className?: string }) {
  const meta = getBiasMeta(bias);
  if (!meta) return null;
  const Icon = meta.icon;
  return <Icon className={cn('h-3.5 w-3.5', meta.text, className)} strokeWidth={2.5} />;
}

/** Drop-in <SelectContent> with all bias options + icons. */
export function BiasSelectContent({ includeNone = false }: { includeNone?: boolean }) {
  return (
    <SelectContent>
      {includeNone && <SelectItem value="none">—</SelectItem>}
      {BIAS_OPTIONS.map(opt => {
        const Icon = opt.icon;
        return (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="inline-flex items-center gap-2">
              <Icon className={cn('h-3.5 w-3.5', opt.text)} strokeWidth={2.5} />
              <span>{opt.label}</span>
            </span>
          </SelectItem>
        );
      })}
    </SelectContent>
  );
}

export type { Bias };
