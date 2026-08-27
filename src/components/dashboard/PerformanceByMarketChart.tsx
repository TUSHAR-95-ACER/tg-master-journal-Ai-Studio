import {useMemo, memo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Trade } from '@/types/trading';

const CHART_COLORS = [
  'hsl(210 100% 50% / 0.8)',
  'hsl(142 71% 45% / 0.8)',
  'hsl(38 92% 50% / 0.8)',
  'hsl(0 84% 60% / 0.8)',
  'hsl(270 60% 50% / 0.8)',
  'hsl(180 60% 45% / 0.8)',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{payload[0].name}</p>
      <p className="font-mono text-sm">{payload[0].value} trades</p>
    </div>
  );
};

function PerformanceByMarketChartImpl({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => {
    const valid = trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
    const map = new Map<string, number>();
    valid.forEach(t => map.set(t.market, (map.get(t.market) || 0) + 1));
    return Array.from(map.entries()).map(([name, trades]) => ({ name, trades }));
  }, [trades]);

  if (data.length === 0) return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="trades" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export const PerformanceByMarketChart = memo(PerformanceByMarketChartImpl);
