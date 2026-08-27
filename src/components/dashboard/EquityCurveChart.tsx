import {useMemo, memo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Trade } from '@/types/trading';

interface EquityCurveChartProps {
  trades: Trade[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono text-sm" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
};

function EquityCurveChartImpl({ trades }: EquityCurveChartProps) {
  const equityData = useMemo(() => {
    const valid = trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
    const sorted = [...valid].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumulative = 0;
    return sorted.map(t => {
      cumulative += t.profitLoss;
      return { date: t.date, equity: Math.round(cumulative * 100) / 100 };
    });
  }, [trades]);

  if (equityData.length === 0) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No trades yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={equityData}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(142,71%,45%)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          interval={equityData.length > 20 ? Math.floor(equityData.length / 10) : 'preserveStartEnd'}
        />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="equity" stroke="hsl(var(--success))" fill="url(#equityGrad)" strokeWidth={2} name="Equity" opacity={0.85} baseValue="dataMin" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const EquityCurveChart = memo(EquityCurveChartImpl);
