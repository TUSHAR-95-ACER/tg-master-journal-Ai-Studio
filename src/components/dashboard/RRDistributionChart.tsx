import {useMemo, memo } from 'react';
import { Trade } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Lightbulb } from 'lucide-react';
import { InfoTooltip } from '@/components/shared/InfoTooltip';

interface RRDistributionChartProps {
  trades: Trade[];
}

interface Bucket {
  label: string;
  count: number;
  percent: number;
}

function RRDistributionChartImpl({ trades }: RRDistributionChartProps) {
  const validTrades = useMemo(
    () => trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'),
    [trades]
  );

  // Winning trades: Drawdown Before TP (as % of SL)
  const drawdownBuckets = useMemo((): Bucket[] => {
    const tpTrades = validTrades.filter(t => t.result === 'Win' && t.maxAdverseMove != null && t.maxAdverseMove !== 0);
    if (tpTrades.length === 0) return [];

    const ranges = [
      { label: '0–20%', min: 0, max: 0.2 },
      { label: '20–40%', min: 0.2, max: 0.4 },
      { label: '40–60%', min: 0.4, max: 0.6 },
      { label: '60–80%', min: 0.6, max: 0.8 },
      { label: '80–100%', min: 0.8, max: 1.0 },
    ];

    return ranges.map(r => {
      const pctValue = (move: number) => Math.abs(move); // already in RR, convert to fraction of SL
      const count = tpTrades.filter(t => {
        const v = pctValue(t.maxAdverseMove!);
        return v >= r.min && (r.max === 1.0 ? v <= r.max : v < r.max);
      }).length;
      return { label: r.label, count, percent: Math.round((count / tpTrades.length) * 100) };
    });
  }, [validTrades]);

  // Losing trades: Profit Before SL (RR buckets)
  const profitBuckets = useMemo((): Bucket[] => {
    const slTrades = validTrades.filter(t => t.result === 'Loss' && t.maxRRReached != null && t.maxRRReached !== 0);
    if (slTrades.length === 0) return [];

    const ranges = [
      { label: '0–0.5 RR', min: 0, max: 0.5 },
      { label: '0.5–1 RR', min: 0.5, max: 1.0 },
      { label: '1+ RR', min: 1.0, max: Infinity },
    ];

    return ranges.map(r => {
      const count = slTrades.filter(t => {
        const v = Math.abs(t.maxRRReached!);
        return v >= r.min && (r.max === Infinity ? true : v < r.max);
      }).length;
      return { label: r.label, count, percent: Math.round((count / slTrades.length) * 100) };
    });
  }, [validTrades]);

  // Auto insights
  const drawdownInsight = useMemo(() => {
    if (drawdownBuckets.length === 0) return null;
    const top = drawdownBuckets.reduce((a, b) => (b.percent > a.percent ? b : a));
    if (top.percent === 0) return null;
    return `Most winning trades experience ${top.label} drawdown before TP (${top.percent}%)`;
  }, [drawdownBuckets]);

  const profitInsight = useMemo(() => {
    if (profitBuckets.length === 0) return null;
    const top = profitBuckets.reduce((a, b) => (b.percent > a.percent ? b : a));
    if (top.percent === 0) return null;
    return `Most losing trades had ${top.label} profit before SL (${top.percent}%)`;
  }, [profitBuckets]);

  if (drawdownBuckets.length === 0 && profitBuckets.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
      {/* Drawdown Before TP */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drawdown Before TP</h3>
          <InfoTooltip text="How much drawdown (as % of stop loss) your winning trades experience before hitting take profit" />
        </div>
        {drawdownBuckets.length > 0 ? (
          <>
            <div className="space-y-2">
              {drawdownBuckets.map(b => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{b.label}</span>
                  <div className="flex-1 h-5 bg-muted/30 rounded-md overflow-hidden relative">
                    <div
                      className="h-full bg-destructive/70 rounded-md transition-all duration-500"
                      style={{ width: `${Math.max(b.percent, 2)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-foreground">
                      {b.percent}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-6 text-right">{b.count}</span>
                </div>
              ))}
            </div>
            {drawdownInsight && (
              <div className="mt-3 flex items-start gap-1.5 text-[10px] text-primary bg-primary/5 border border-primary/10 rounded-lg px-2.5 py-2">
                <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{drawdownInsight}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No winning trades with drawdown data</p>
        )}
      </div>

      {/* Profit Before SL */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Profit Before SL</h3>
          <InfoTooltip text="How much profit (in RR) your losing trades reached before hitting stop loss" />
        </div>
        {profitBuckets.length > 0 ? (
          <>
            <div className="space-y-2">
              {profitBuckets.map(b => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{b.label}</span>
                  <div className="flex-1 h-5 bg-muted/30 rounded-md overflow-hidden relative">
                    <div
                      className="h-full bg-success/70 rounded-md transition-all duration-500"
                      style={{ width: `${Math.max(b.percent, 2)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-foreground">
                      {b.percent}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-6 text-right">{b.count}</span>
                </div>
              ))}
            </div>
            {profitInsight && (
              <div className="mt-3 flex items-start gap-1.5 text-[10px] text-primary bg-primary/5 border border-primary/10 rounded-lg px-2.5 py-2">
                <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{profitInsight}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No losing trades with profit data</p>
        )}
      </div>
    </div>
  );
}

export const RRDistributionChart = memo(RRDistributionChartImpl);
