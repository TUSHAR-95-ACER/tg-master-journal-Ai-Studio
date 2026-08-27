import {useMemo, memo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Trade } from '@/types/trading';
import { formatCurrency } from '@/lib/calculations';

interface HourRow {
  hour: string;
  hourNum: number;
  pl: number;
  trades: number;
  wins: number;
  rrSum: number;
  rrCount: number;
}

const HourTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as HourRow;
  const wr = d.trades ? Math.round((d.wins / d.trades) * 100) : 0;
  const avgRR = d.rrCount ? (d.rrSum / d.rrCount).toFixed(2) : '—';
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg space-y-0.5">
      <p className="text-xs font-semibold text-foreground">{d.hour}</p>
      <p className="text-[11px] text-muted-foreground">{d.trades} trade{d.trades === 1 ? '' : 's'}</p>
      <p className="text-[11px] text-muted-foreground">{wr}% WR</p>
      <p className="text-[11px] font-mono" style={{ color: d.pl >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}>
        {d.pl >= 0 ? '+' : ''}{formatCurrency(d.pl)}
      </p>
      <p className="text-[11px] text-muted-foreground">{avgRR} Avg RR</p>
    </div>
  );
};

function HourChartImpl({ trades }: { trades: Trade[] }) {
  const data = useMemo<HourRow[]>(() => {
    const valid = trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled' && t.entryTime);
    const map = new Map<number, HourRow>();
    valid.forEach(t => {
      const hh = parseInt((t.entryTime || '').slice(0, 2), 10);
      if (isNaN(hh)) return;
      const row = map.get(hh) || { hour: `${String(hh).padStart(2, '0')}:00`, hourNum: hh, pl: 0, trades: 0, wins: 0, rrSum: 0, rrCount: 0 };
      row.trades++;
      if (t.result === 'Win') row.wins++;
      row.pl += t.profitLoss;
      const rr = typeof t.actualRR === 'number' ? t.actualRR : t.plannedRR;
      if (!isNaN(rr) && rr !== 0) { row.rrSum += rr; row.rrCount++; }
      map.set(hh, row);
    });
    return Array.from(map.values()).sort((a, b) => a.hourNum - b.hourNum);
  }, [trades]);

  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>;
  }

  const maxPl = Math.max(...data.map(d => d.pl));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
        <Tooltip content={<HourTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.15)' }} />
        <Bar dataKey="pl" name="P/L" radius={[4, 4, 0, 0]} opacity={0.85}>
          {data.map((entry, i) => {
            const isBest = entry.pl > 0 && entry.pl === maxPl;
            const fill = isBest
              ? 'hsl(var(--gold))'
              : entry.pl >= 0
                ? 'hsl(var(--success))'
                : 'hsl(var(--destructive))';
            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const HourChart = memo(HourChartImpl);
