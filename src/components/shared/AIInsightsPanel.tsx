import { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateInsights } from '@/lib/insightEngine';

interface AIInsightsProps {
  page: string;
  payload: Record<string, unknown>;
  title?: string;
  className?: string;
  /** Optional pre-computed insights. If provided, used as-is. */
  insights?: string[];
}

/**
 * Offline Insight Panel — dynamic, ranked, page-aware.
 * Calls the detector-based engine in src/lib/insightEngine.ts.
 * No AI calls, no network, no fixed templates — every observation must be evidenced
 * by data the page already has.
 */
export function AIInsightsPanel({ page, payload, title = 'Insights', className, insights }: AIInsightsProps) {
  const lines = useMemo(() => {
    if (insights && insights.length) return insights.slice(0, 10);
    return generateInsights(page, payload as Record<string, any>);
  }, [page, payload, insights]);

  return (
    <section
      className={cn(
        'rounded-2xl border border-gold/25 bg-[linear-gradient(135deg,hsl(var(--gold)/0.04),hsl(var(--card))_60%)] overflow-hidden',
        className,
      )}
      aria-label={title}
    >
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border/40">
        <div className="h-7 w-7 rounded-lg bg-gold/10 text-gold border border-gold/30 flex items-center justify-center">
          <Lightbulb className="h-3.5 w-3.5" />
        </div>
        <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
      </div>
      <div className="p-5">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough data yet to generate insights.</p>
        ) : (
          <ol className="space-y-2.5">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-3 text-sm leading-snug text-foreground/90">
                <span className="font-mono text-xs text-muted-foreground w-5 shrink-0 pt-0.5">{i + 1}</span>
                <span className="flex-1">{line}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 pt-3 border-t border-border/30 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          Derived directly from logged journal data · no AI required
        </p>
      </div>
    </section>
  );
}

