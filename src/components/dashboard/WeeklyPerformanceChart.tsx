import {useMemo, memo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Trade } from '@/types/trading';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 shadow-lg">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      <p className={`font-mono text-sm ${entry?.pl >= 0 ? 'text-success' : 'text-destructive'}`}>
        P/L: {entry?.pl >= 0 ? '+' : ''}{entry?.pl?.toFixed(2)}
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        Trades: {entry?.trades}
      </p>
    </div>
  );
};

/**
 * Computes calendar-row week-of-month for an ISO date (YYYY-MM-DD).
 * Week 1 = first calendar row (day 1 → first Saturday) of that date's month.
 */
function weekOfMonth(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 1;
  const firstDayOffset = new Date(y, m - 1, 1).getDay(); // 0=Sun..6=Sat
  return Math.floor((d + firstDayOffset - 1) / 7) + 1;
}

function WeeklyPerformanceChartImpl({ trades }: { trades: Trade[]; month?: number; year?: number }) {
  const data = useMemo(() => {
    // GLOBAL aggregation: combine trades by week-of-month bucket across ALL months.
    const buckets = new Map<number, { pl: number; trades: number }>();
    for (let i = 1; i <= 6; i++) buckets.set(i, { pl: 0, trades: 0 });

    for (const t of trades) {
      const w = weekOfMonth(t.date);
      const b = buckets.get(w);
      if (!b) continue;
      b.pl += t.profitLoss || 0;
      b.trades += 1;
    }

    const all = Array.from(buckets.entries()).map(([w, v]) => ({
      name: `Week ${w}`,
      pl: Math.round(v.pl * 100) / 100,
      trades: v.trades,
    }));
    // Always keep Weeks 1-4; drop trailing empty 5/6.
    let end = all.length;
    while (end > 4 && all[end - 1].trades === 0) end--;
    return all.slice(0, end);
  }, [trades]);

  if (data.every(d => d.trades === 0)) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No trades logged</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
          interval={0}
        />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="pl" name="P/L" radius={[4, 4, 0, 0]} opacity={0.8}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.pl > 0 ? 'hsl(var(--success))' : entry.pl < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const WeeklyPerformanceChart = memo(WeeklyPerformanceChartImpl);
