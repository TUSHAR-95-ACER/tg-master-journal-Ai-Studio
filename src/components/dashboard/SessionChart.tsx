import {useMemo, memo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Trade } from '@/types/trading';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 shadow-lg">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      <p className="font-mono text-sm text-muted-foreground">
        Win %: <span className="text-foreground">{entry?.winRate?.toFixed(1)}</span>
      </p>
      <p className={`font-mono text-sm ${entry?.pl >= 0 ? 'text-success' : 'text-destructive'}`}>
        P/L: {entry?.pl >= 0 ? '+' : ''}{entry?.pl?.toFixed(2)}
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        Trades: {entry?.total}
      </p>
    </div>
  );
};

function SessionChartImpl({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => {
    const valid = trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
    const map = new Map<string, { wins: number; total: number; pl: number }>();
    valid.forEach(t => {
      const m = map.get(t.session) || { wins: 0, total: 0, pl: 0 };
      m.total++;
      m.pl += t.profitLoss;
      if (t.result === 'Win') m.wins++;
      map.set(t.session, m);
    });
    return Array.from(map.entries()).map(([name, d]) => ({
      name,
      pl: Math.round(d.pl * 100) / 100,
      winRate: d.total ? (d.wins / d.total) * 100 : 0,
      total: d.total,
    }));
  }, [trades]);

  if (data.length === 0) return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
          angle={data.length > 4 ? -45 : 0}
          textAnchor={data.length > 4 ? 'end' : 'middle'}
          height={data.length > 4 ? 50 : 30}
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

export const SessionChart = memo(SessionChartImpl);
