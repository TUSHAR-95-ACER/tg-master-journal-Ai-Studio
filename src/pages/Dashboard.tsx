import { useMemo } from 'react';
import { WeekdayChart } from '@/components/dashboard/WeekdayChart';
import { HourChart } from '@/components/dashboard/HourChart';
import { MonthlyChart } from '@/components/dashboard/MonthlyChart';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Activity,
  ArrowDown,
  CheckCircle2,
  XCircle,
  LineChart,
  Crosshair,
  Coins,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { useTrading } from '@/contexts/TradingContext';
import { MetricCard, PageHeader } from '@/components/shared/MetricCard';
import { ChartHeader } from '@/components/shared/InfoTooltip';

import {
  calcWinRate,
  calcProfitFactor,
  calcExpectancy,
  calcMaxDrawdown,
  formatCurrency,
  formatPercent,
  calcAvgRR,
} from '@/lib/calculations';
import { EquityCurveChart } from '@/components/dashboard/EquityCurveChart';
import { PerformanceByPairChart } from '@/components/dashboard/PerformanceByPairChart';
import { SessionChart } from '@/components/dashboard/SessionChart';
import { WeeklyPerformanceChart } from '@/components/dashboard/WeeklyPerformanceChart';
import { PerformanceByGradeChart } from '@/components/dashboard/PerformanceByGradeChart';
import { DashboardCalendar } from '@/components/dashboard/DashboardCalendar';
import { AIInsightsPanel } from '@/components/shared/AIInsightsPanel';
import { adaptTrades } from '@/lib/aiInsightAdapters';
import type { Trade } from '@/types/trading';

const MS_PER_DAY = 86_400_000;

function avgDurationMinutes(trades: Trade[]): number | null {
  const valid = trades.filter((t) => t.entryTime && t.exitTime && t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
  if (valid.length === 0) return null;
  const total = valid.reduce((sum, t) => {
    const entry = new Date(`${t.date}T${t.entryTime}`);
    const exit = new Date(`${t.date}T${t.exitTime}`);
    return sum + (exit.getTime() - entry.getTime()) / 60000;
  }, 0);
  return total / valid.length;
}

function fmtDuration(mins: number | null): string {
  if (mins == null) return 'N/A';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDurationDelta(diff: number): string {
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const abs = Math.abs(diff);
  if (abs < 1) return '0m';
  if (abs < 60) return `${sign}${Math.round(abs)}m`;
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`;
}

interface StreakInfo { bestWin: number; worstLoss: number; }
function calcStreaks(trades: Trade[]): StreakInfo {
  const sorted = [...trades]
    .filter((t) => t.result === 'Win' || t.result === 'Loss')
    .sort((a, b) => new Date(`${a.date}T${a.entryTime || '00:00'}`).getTime() - new Date(`${b.date}T${b.entryTime || '00:00'}`).getTime());
  let bestWin = 0, worstLoss = 0, w = 0, l = 0;
  for (const t of sorted) {
    if (t.result === 'Win') { w++; l = 0; if (w > bestWin) bestWin = w; }
    else { l++; w = 0; if (l > worstLoss) worstLoss = l; }
  }
  return { bestWin, worstLoss };
}

export default function Dashboard() {
  const { trades } = useTrading();

  const validTrades = useMemo(
    () => trades.filter((t) => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'),
    [trades],
  );

  // ---- Period comparison: current 30 days vs previous 30 days ----
  const { current, previous, hasPrev } = useMemo(() => {
    const now = Date.now();
    const cur: Trade[] = [];
    const prev: Trade[] = [];
    let oldest = now;
    for (const t of trades) {
      const ts = new Date(`${t.date}T00:00:00`).getTime();
      if (isNaN(ts)) continue;
      if (ts < oldest) oldest = ts;
      const ageDays = (now - ts) / MS_PER_DAY;
      if (ageDays <= 30) cur.push(t);
      else if (ageDays <= 60) prev.push(t);
    }
    const dataAgeDays = (now - oldest) / MS_PER_DAY;
    return { current: cur, previous: prev, hasPrev: dataAgeDays >= 30 && prev.length > 0 };
  }, [trades]);

  const metrics = useMemo(() => ({
    total: trades.length,
    winRate: calcWinRate(trades),
    totalProfit: validTrades.reduce((s, t) => s + t.profitLoss, 0),
    profitFactor: calcProfitFactor(trades),
    expectancy: calcExpectancy(trades),
    maxDrawdown: calcMaxDrawdown(trades),
    avgRR: calcAvgRR(trades),
  }), [trades, validTrades]);

  const avgDurMins = useMemo(() => avgDurationMinutes(validTrades), [validTrades]);

  const deltas = useMemo(() => {
    if (!hasPrev) {
      return {
        total: null, winRate: null, totalPl: null, profitFactor: null,
        expectancy: null, maxDD: null, avgDur: null,
      } as const;
    }
    const curValid = current.filter((t) => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
    const prvValid = previous.filter((t) => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');

    const pct = (a: number, b: number) => {
      if (b === 0) return a === 0 ? 0 : 100;
      return ((a - b) / Math.abs(b)) * 100;
    };
    const fmtPct = (p: number) => `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
    const fmtNum = (n: number, suffix = '', digits = 2) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`;
    const fmtMoney = (n: number) => `${n > 0 ? '+' : ''}${formatCurrency(n)}`;
    const tone = (diff: number, lowerIsBetter = false): 'up' | 'down' | 'flat' => {
      if (Math.abs(diff) < 0.0001) return 'flat';
      const good = lowerIsBetter ? diff < 0 : diff > 0;
      return good ? 'up' : 'down';
    };

    const curTotal = current.length, prvTotal = previous.length;
    const totalDiff = pct(curTotal, prvTotal);

    const curWR = calcWinRate(current), prvWR = calcWinRate(previous);
    const wrDiff = curWR - prvWR;

    const curPL = curValid.reduce((s, t) => s + t.profitLoss, 0);
    const prvPL = prvValid.reduce((s, t) => s + t.profitLoss, 0);
    const plDiff = curPL - prvPL;

    const curPF = calcProfitFactor(current), prvPF = calcProfitFactor(previous);
    const pfDiff = (isFinite(curPF) ? curPF : 0) - (isFinite(prvPF) ? prvPF : 0);

    const curExp = calcExpectancy(current), prvExp = calcExpectancy(previous);
    const expDiff = curExp - prvExp;

    const curDD = calcMaxDrawdown(current), prvDD = calcMaxDrawdown(previous);
    const ddDiff = curDD - prvDD; // lower is better

    const curDur = avgDurationMinutes(current);
    const prvDur = avgDurationMinutes(previous);
    const durDiff = curDur != null && prvDur != null ? curDur - prvDur : null;

    return {
      total: { text: fmtPct(totalDiff), tone: tone(totalDiff) },
      winRate: { text: `${wrDiff > 0 ? '+' : ''}${wrDiff.toFixed(1)}%`, tone: tone(wrDiff) },
      totalPl: { text: fmtMoney(plDiff), tone: tone(plDiff) },
      profitFactor: { text: fmtNum(pfDiff), tone: tone(pfDiff) },
      expectancy: { text: fmtMoney(expDiff), tone: tone(expDiff) },
      maxDD: { text: fmtMoney(ddDiff), tone: tone(ddDiff, true) },
      avgDur: durDiff == null ? null : { text: fmtDurationDelta(durDiff), tone: 'flat' as const },
    };
  }, [current, previous, hasPrev]);

  const wins = validTrades.filter((t) => t.result === 'Win').length;
  const losses = validTrades.filter((t) => t.result === 'Loss').length;
  const streaks = useMemo(() => calcStreaks(validTrades), [validTrades]);

  const summaryRows: { label: string; value: string; tone?: 'up' | 'down' | 'gold'; Icon: typeof CheckCircle2 }[] = [
    { label: 'Wins', value: String(wins), tone: 'up', Icon: CheckCircle2 },
    { label: 'Losses', value: String(losses), tone: 'down', Icon: XCircle },
    { label: 'Win Rate', value: formatPercent(metrics.winRate), tone: metrics.winRate >= 50 ? 'up' : 'down', Icon: LineChart },
    { label: 'Avg R:R', value: metrics.avgRR ? metrics.avgRR.toFixed(2) : '—', Icon: Crosshair },
    { label: 'Profit Factor', value: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2), tone: metrics.profitFactor >= 1.5 ? 'up' : 'down', Icon: Coins },
    { label: 'Best Streak', value: streaks.bestWin > 0 ? `${streaks.bestWin}W` : '—', tone: 'gold', Icon: Trophy },
    { label: 'Worst Streak', value: streaks.worstLoss > 0 ? `${streaks.worstLoss}L` : '—', tone: 'down', Icon: AlertTriangle },
  ];

  return (
    <div className="px-3 sm:px-4 py-3 w-full">
      <PageHeader title="Master Dashboard" subtitle="Trading operating system overview" />

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <MetricCard label="Total Trades" value={metrics.total} icon={BarChart3} tooltip="Total number of trades you have logged in the journal"
          delta={hasPrev ? deltas.total!.text : null} deltaTone={hasPrev ? deltas.total!.tone : undefined} />
        <MetricCard label="Win Rate" value={formatPercent(metrics.winRate)} icon={Target} trend={metrics.winRate >= 50 ? 'up' : 'down'}
          emphasis={metrics.winRate >= 60 ? 'gold' : undefined} tooltip="Percentage of trades that ended in profit (wins ÷ total trades)"
          delta={hasPrev ? deltas.winRate!.text : null} deltaTone={hasPrev ? deltas.winRate!.tone : undefined} />
        <MetricCard label="Total P/L" value={formatCurrency(metrics.totalProfit)} icon={metrics.totalProfit >= 0 ? TrendingUp : TrendingDown}
          trend={metrics.totalProfit >= 0 ? 'up' : 'down'} tooltip="Sum of all profits and losses from your trades"
          delta={hasPrev ? deltas.totalPl!.text : null} deltaTone={hasPrev ? deltas.totalPl!.tone : undefined} />
        <MetricCard label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} icon={Activity}
          trend={metrics.profitFactor >= 1.5 ? 'up' : 'down'} emphasis={metrics.profitFactor >= 1.5 ? 'gold' : undefined}
          tooltip="Gross profit ÷ gross loss. Above 1.5 is strong, below 1.0 means losing money"
          delta={hasPrev ? deltas.profitFactor!.text : null} deltaTone={hasPrev ? deltas.profitFactor!.tone : undefined} />
        <MetricCard label="Expectancy" value={formatCurrency(metrics.expectancy)} trend={metrics.expectancy >= 0 ? 'up' : 'down'}
          tooltip="Average expected return per trade." />
        <MetricCard label="Max Drawdown" value={formatCurrency(metrics.maxDrawdown)} icon={ArrowDown} trend="down"
          tooltip="Largest decline from peak equity." />
        <MetricCard label="Avg Duration" value={fmtDuration(avgDurMins)} icon={Activity}
          tooltip="Average trade holding time." />
      </div>

      {/* Equity Curve (70%) + Performance Summary (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="lg:col-span-7 bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <ChartHeader title="Equity Curve" tooltip="Shows how your total account value has changed over time based on cumulative P/L" />
          <div className="h-[260px] sm:h-[340px]"><EquityCurveChart trades={trades} /></div>
        </div>
        <div className="lg:col-span-3 bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm overflow-hidden flex flex-col">
          <ChartHeader title="Performance Summary" tooltip="Key performance metrics derived from your logged trades" />
          <div className="flex-1 flex flex-col justify-between divide-y divide-border/60 mt-2">
            {summaryRows.map(({ label, value, tone, Icon }) => (
              <div key={label} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={
                    tone === 'up' ? 'h-3.5 w-3.5 text-success shrink-0' :
                    tone === 'down' ? 'h-3.5 w-3.5 text-destructive shrink-0' :
                    tone === 'gold' ? 'h-3.5 w-3.5 text-gold shrink-0' :
                    'h-3.5 w-3.5 text-muted-foreground shrink-0'
                  } />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold truncate">{label}</span>
                </div>
                <span className={
                  'font-heading text-lg font-bold tabular-nums ' + (
                    tone === 'up' ? 'text-success' :
                    tone === 'down' ? 'text-destructive' :
                    tone === 'gold' ? 'text-gold' :
                    'text-foreground'
                  )
                }>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="mb-3 sm:mb-4"><DashboardCalendar trades={trades} /></div>

      {/* By Pair / Session / Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <ChartHeader title="By Pair" tooltip="P/L breakdown by each trading pair to see which instruments work best for you" />
          <div className="h-[200px] sm:h-[240px]"><PerformanceByPairChart trades={trades} /></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <ChartHeader title="By Session" tooltip="Performance grouped by trading session (London, NY, etc.)" />
          <div className="h-[200px] sm:h-[240px]"><SessionChart trades={trades} /></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <ChartHeader title="By Week" tooltip="Weekly P/L to track consistency across calendar weeks (matches calendar row layout)" />
          <div className="h-[200px] sm:h-[240px]"><WeeklyPerformanceChart trades={trades} month={new Date().getMonth()} year={new Date().getFullYear()} /></div>
        </div>
      </div>

      {/* By Grade + By Day */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <ChartHeader title="By Grade" tooltip="Performance grouped by the quality grade you assigned to each trade" />
          <PerformanceByGradeChart trades={trades} />
        </div>
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <ChartHeader title="By Day (P/L)" tooltip="P/L broken down by day of the week to find your best trading days" />
          <div className="h-[200px] sm:h-[240px]"><WeekdayChart trades={trades} /></div>
        </div>
      </div>

      {/* By Time (P/L) */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <ChartHeader title="By Time (P/L)" tooltip="Net P/L grouped by trade entry hour. Gold highlights your most profitable hour." />
          <div className="h-[200px] sm:h-[240px]"><HourChart trades={trades} /></div>
        </div>
      </div>

      {/* By Month (P/L) */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm overflow-hidden">
          <ChartHeader title="By Month (P/L)" tooltip="P/L aggregated by calendar month across the selected trades." />
          <div className="h-[200px] sm:h-[240px]"><MonthlyChart trades={trades} /></div>
        </div>
      </div>

      {/* AI Insights — page bottom (universal) */}
      <div className="mt-4"><AIInsightsPanel page="Dashboard" payload={adaptTrades(trades)} /></div>
    </div>
  );
}
