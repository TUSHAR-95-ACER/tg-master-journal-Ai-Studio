import { useMemo } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import { PageHeader } from '@/components/shared/MetricCard';
import { RRDistributionChart } from '@/components/dashboard/RRDistributionChart';
import { Trade } from '@/types/trading';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, BarChart3, Activity, Zap, Award, AlertTriangle } from 'lucide-react';

function MetricTile({ label, value, sub, icon: Icon, color, gold }: { label: string; value: string | number; sub?: string; icon: any; color?: string; gold?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 hover:border-border transition-colors", gold ? "border-gold/45 bg-[linear-gradient(135deg,hsl(var(--gold)/0.1),hsl(var(--card))_58%)] shadow-[0_0_0_1px_hsl(var(--gold)/0.1)_inset]" : "border-border/60")}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", gold ? "bg-gold/10 border border-gold/30" : color || "bg-primary/10")}>
          <Icon className={cn("h-3.5 w-3.5", gold ? "text-gold" : color ? "text-white" : "text-primary")} />
        </div>
        <span className={cn("text-[10px] font-semibold uppercase tracking-wider", gold ? "text-gold" : "text-muted-foreground")}>{label}</span>
      </div>
      <p className={cn("text-2xl font-black font-mono tracking-tight", gold && "text-gold")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function SystemAnalytics() {
  const { trades } = useTrading();

  const validTrades = useMemo(() => trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'), [trades]);
  const wins = validTrades.filter(t => t.result === 'Win');
  const losses = validTrades.filter(t => t.result === 'Loss');
  const winRate = validTrades.length > 0 ? ((wins.length / validTrades.length) * 100).toFixed(1) : '0';
  const avgWin = wins.length > 0 ? (wins.reduce((s, t) => s + t.profitLoss, 0) / wins.length).toFixed(2) : '0';
  const avgLoss = losses.length > 0 ? (losses.reduce((s, t) => s + Math.abs(t.profitLoss), 0) / losses.length).toFixed(2) : '0';
  const profitFactor = losses.length > 0 && parseFloat(avgLoss) > 0 ? (parseFloat(avgWin) / parseFloat(avgLoss)).toFixed(2) : '—';
  const avgRR = wins.filter(t => t.actualRR).length > 0
    ? (wins.filter(t => t.actualRR).reduce((s, t) => s + (t.actualRR || 0), 0) / wins.filter(t => t.actualRR).length).toFixed(2) : '—';
  const totalPL = validTrades.reduce((s, t) => s + t.profitLoss, 0).toFixed(2);
  const bestTrade = validTrades.length > 0 ? Math.max(...validTrades.map(t => t.profitLoss)).toFixed(2) : '0';
  const worstTrade = validTrades.length > 0 ? Math.min(...validTrades.map(t => t.profitLoss)).toFixed(2) : '0';

  return (
    <div className="p-3 sm:p-6 w-full space-y-6">
      <PageHeader title="System Analytics" subtitle="Trade system metrics, RR distribution & performance insights">
      </PageHeader>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile icon={Target} label="Win Rate" value={`${winRate}%`} sub={`${wins.length}W / ${losses.length}L`} />
        <MetricTile icon={BarChart3} label="Profit Factor" value={profitFactor} sub={`Avg W: $${avgWin} | Avg L: $${avgLoss}`} />
        <MetricTile icon={Activity} label="Avg Win RR" value={avgRR} sub="Risk-reward on winners" gold />
        <MetricTile icon={Zap} label="Net P/L" value={`$${totalPL}`} sub={`${validTrades.length} trades`} color={parseFloat(totalPL) >= 0 ? 'bg-success' : 'bg-destructive'} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricTile icon={TrendingUp} label="Best Trade" value={`$${bestTrade}`} gold />
        <MetricTile icon={TrendingDown} label="Worst Trade" value={`$${worstTrade}`} color="bg-destructive" />
        <MetricTile icon={Award} label="Total Wins" value={wins.length} sub={`of ${validTrades.length} trades`} />
        <MetricTile icon={AlertTriangle} label="Total Losses" value={losses.length} sub={`of ${validTrades.length} trades`} />
      </div>

      {/* RR Distribution */}
      <RRDistributionChart trades={trades} />
    </div>
  );
}
