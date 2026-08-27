import {useMemo, memo } from 'react';
import { Trade } from '@/types/trading';
import { useTrading } from '@/contexts/TradingContext';
import { cn } from '@/lib/utils';

function PerformanceByGradeChartImpl({ trades }: { trades: Trade[] }) {
  const { gradesList } = useTrading();

  const data = useMemo(() => {
    const valid = trades;
    // Use dynamic grades from context + any grades found in trades
    const allGrades = [...new Set([...gradesList, ...valid.map(t => t.grade).filter(Boolean) as string[]])];

    return allGrades.map(grade => {
      const gradeTrades = valid.filter(t => t.grade === grade);
      const wins = gradeTrades.filter(t => t.result === 'Win').length;
      const total = gradeTrades.length;
      const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;
      const avgPl = total > 0 ? Math.round((gradeTrades.reduce((s, t) => s + t.profitLoss, 0) / total) * 100) / 100 : 0;

      return { grade, trades: total, winRate, avgPl };
    });
  }, [trades, gradesList]);

  const gradeColorMap: Record<string, string> = {
    'A+': 'text-gold',
    'A': 'text-primary',
    'B': 'text-foreground',
    'C': 'text-destructive',
  };

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 gap-2 px-2 py-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground border-b border-border">
        <span>Grade</span>
        <span className="text-center">Trades</span>
        <span className="text-center">Win %</span>
        <span className="text-right">Avg P/L</span>
      </div>
      {data.map(row => (
        <div key={row.grade} className={cn(
          "grid grid-cols-4 gap-2 px-2 py-2.5 border-b border-border/50 text-sm",
          row.grade === 'A+' && 'rounded-md border border-gold/35 bg-gold/10 shadow-[0_0_0_1px_hsl(var(--gold)/0.08)_inset]'
        )}>
          <span className={cn('font-bold', gradeColorMap[row.grade] || 'text-foreground')}>{row.grade}</span>
          <span className="text-center text-muted-foreground">{row.trades}</span>
          <span className="text-center text-muted-foreground">{row.winRate.toFixed(1)}%</span>
          <span className={cn('text-right font-mono text-xs', row.avgPl >= 0 ? 'text-success' : 'text-destructive')}>
            {row.avgPl.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export const PerformanceByGradeChart = memo(PerformanceByGradeChartImpl);
