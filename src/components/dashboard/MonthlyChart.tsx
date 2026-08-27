import { useMemo, memo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Trade } from '@/types/trading';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono text-sm" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MonthlyChartImpl({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => {
    const buckets = MONTHS.map(m => ({ name: m, pl: 0 }));
    const valid = trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
    valid.forEach(t => {
      const idx = new Date(t.date).getMonth();
      if (!Number.isNaN(idx)) buckets[idx].pl += t.profitLoss;
    });
    return buckets.map(b => ({ ...b, pl: Math.round(b.pl * 100) / 100 }));
  }, [trades]);

  if (data.every(d => d.pl === 0)) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="pl" name="P/L" radius={[4, 4, 0, 0]} opacity={0.85}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pl >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const MonthlyChart = memo(MonthlyChartImpl);
