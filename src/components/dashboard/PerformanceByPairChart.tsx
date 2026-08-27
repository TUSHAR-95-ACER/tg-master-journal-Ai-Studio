import {useMemo, memo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
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
      <p className="font-mono text-xs text-muted-foreground">Trades: {entry?.trades}</p>
    </div>
  );
};

function PerformanceByPairChartImpl({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => {
    const valid = trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
    const map = new Map<string, { wins: number; total: number; pl: number }>();
    valid.forEach(t => {
      const m = map.get(t.asset) || { wins: 0, total: 0, pl: 0 };
      m.total++;
      if (t.result === 'Win') m.wins++;
      m.pl += t.profitLoss;
      map.set(t.asset, m);
    });
    return Array.from(map.entries())
      .map(([name, d]) => ({ name, trades: d.total, pl: Math.round(d.pl * 100) / 100 }))
      .sort((a, b) => b.pl - a.pl);
  }, [trades]);

  if (data.length === 0) return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.slice(0, 8)} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={65} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="pl" name="P/L" radius={[0, 4, 4, 0]} opacity={0.8}>
          {data.slice(0, 8).map((entry, i) => (
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

export const PerformanceByPairChart = memo(PerformanceByPairChartImpl);
