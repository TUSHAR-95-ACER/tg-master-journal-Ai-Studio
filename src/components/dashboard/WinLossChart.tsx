import {useMemo, memo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Trade } from '@/types/trading';

interface WinLossChartProps {
  trades: Trade[];
}

function WinLossChartImpl({ trades }: WinLossChartProps) {
  const data = useMemo(() => {
    const wins = trades.filter(t => t.result === 'Win').length;
    const losses = trades.filter(t => t.result === 'Loss').length;
    const be = trades.filter(t => t.result === 'Breakeven').length;
    const missed = trades.filter(t => t.result === 'Untriggered Setup').length;
    const cancelled = trades.filter(t => t.result === 'Cancelled').length;
    return [
      { name: 'Wins', value: wins },
      { name: 'Losses', value: losses },
      { name: 'Break Even', value: be },
      { name: 'Untriggered Setup', value: missed },
      { name: 'Cancelled', value: cancelled },
    ].filter(d => d.value > 0);
  }, [trades]);

  const COLORS = [
    'hsl(142 71% 45% / 0.8)',   // green - Win
    'hsl(0 84% 60% / 0.8)',     // red - Loss
    'hsl(215 20% 55% / 0.8)',    // grey - Breakeven
    'hsl(210 100% 50% / 0.8)',  // blue - Missed
    'hsl(48 96% 53% / 0.8)',    // yellow - Cancelled
  ];

  const COLOR_MAP: Record<string, string> = {
    'Wins': COLORS[0],
    'Losses': COLORS[1],
    'Break Even': COLORS[2],
    'Untriggered Setup': COLORS[3],
    'Cancelled': COLORS[4],
  };

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No trades yet</div>
    );
  }

  return (
    <div className="flex flex-col items-center h-full">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={COLOR_MAP[d.name]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_MAP[d.name] }} />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
}

export const WinLossChart = memo(WinLossChartImpl);
