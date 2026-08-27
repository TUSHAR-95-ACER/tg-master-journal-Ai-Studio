import { useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useTrading } from '@/contexts/TradingContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Trade } from '@/types/trading';

interface DashboardCalendarProps {
  trades: Trade[];
}

interface CalendarFilters {
  accountId: string;
  market: string;
  setup: string;
}

interface DayStats {
  dateStr: string;
  dayNumber: number;
  totalPl: number;
  tradeCount: number;
  averageRR: number | null;
  trades: Trade[];
  hasMissed: boolean;
  hasCancelled: boolean;
}

interface HeatCell {
  dateStr: string;
  inYear: boolean;
  totalPl: number;
  tradeCount: number;
}

interface HeatmapMonth {
  label: string;
  columns: HeatCell[][];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HEATMAP_WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const formatCompact = (value: number) => {
  const absValue = Math.abs(value);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';

  if (absValue >= 1000) {
    return `${sign}${(absValue / 1000).toFixed(absValue >= 10000 ? 0 : 1)}k`;
  }

  return `${sign}${absValue % 1 === 0 ? absValue.toFixed(0) : absValue.toFixed(1)}`;
};

const formatDisplayDate = (dateStr: string) => new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(`${dateStr}T00:00:00`));

const toDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTone = (day: DayStats, maxAbs: number, mode: 'calendar' | 'heatmap') => {
  const { tradeCount, totalPl, trades } = day;
  if (tradeCount === 0) {
    return mode === 'calendar'
      ? 'border-border/80 bg-background text-muted-foreground hover:bg-muted/30'
      : 'border-border/70 bg-muted/35';
  }

  // Check if ALL trades are missed or cancelled
  const allMissedOrCancelled = trades.every(t => t.result === 'Untriggered Setup' || t.result === 'Cancelled');
  const hasMissed = trades.some(t => t.result === 'Untriggered Setup');
  const hasCancelled = trades.some(t => t.result === 'Cancelled');

  if (allMissedOrCancelled) {
    if (hasCancelled && mode === 'calendar') return 'border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/15';
    if (hasMissed && mode === 'calendar') return 'border-blue-500/25 bg-blue-500/10 hover:bg-blue-500/15';
    if (mode === 'heatmap') return 'border-muted-foreground/30 bg-muted/50';
  }

  // P/L-based coloring for trades with actual results
  const plTrades = trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
  const plValue = plTrades.reduce((s, t) => s + t.profitLoss, 0);
  const intensity = Math.abs(plValue) / Math.max(maxAbs, 1);

  if (plValue >= 0) {
    if (mode === 'calendar') {
      if (intensity > 0.75) return 'border-success/35 bg-success/20 hover:bg-success/25';
      if (intensity > 0.4) return 'border-success/25 bg-success/15 hover:bg-success/20';
      return 'border-success/20 bg-success/10 hover:bg-success/15';
    }
    if (intensity > 0.75) return 'border-success/50 bg-success';
    if (intensity > 0.4) return 'border-success/35 bg-success/70';
    return 'border-success/25 bg-success/35';
  }

  if (mode === 'calendar') {
    if (intensity > 0.75) return 'border-destructive/35 bg-destructive/20 hover:bg-destructive/25';
    if (intensity > 0.4) return 'border-destructive/25 bg-destructive/15 hover:bg-destructive/20';
    return 'border-destructive/20 bg-destructive/10 hover:bg-destructive/15';
  }

  if (intensity > 0.75) return 'border-destructive/50 bg-destructive';
  if (intensity > 0.4) return 'border-destructive/35 bg-destructive/70';
  return 'border-destructive/25 bg-destructive/35';
};

export function DashboardCalendar({ trades }: DashboardCalendarProps) {
  const now = new Date();
  const { accounts, customSetups } = useTrading();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filters, setFilters] = useState<CalendarFilters>({ accountId: 'all', market: 'all', setup: 'all' });

  const filteredTrades = useMemo(() => trades.filter((trade) => {
    if (filters.market !== 'all' && trade.market !== filters.market) return false;
    if (filters.setup !== 'all' && trade.setup !== filters.setup) return false;
    if (filters.accountId !== 'all' && !trade.accounts.some((account) => account.accountId === filters.accountId)) return false;
    return true;
  }), [trades, filters]);

  const tradeMap = useMemo(() => filteredTrades.reduce((map, trade) => {
    const existing = map.get(trade.date);

    if (existing) {
      existing.totalPl += trade.profitLoss;
      existing.tradeCount += 1;
      existing.trades.push(trade);
      if (typeof trade.actualRR === 'number') {
        existing.rrTotal += trade.actualRR;
        existing.rrCount += 1;
      }
      return map;
    }

    map.set(trade.date, {
      totalPl: trade.profitLoss,
      tradeCount: 1,
      trades: [trade],
      rrTotal: typeof trade.actualRR === 'number' ? trade.actualRR : 0,
      rrCount: typeof trade.actualRR === 'number' ? 1 : 0,
    });
    return map;
  }, new Map<string, { totalPl: number; tradeCount: number; trades: Trade[]; rrTotal: number; rrCount: number }>()), [filteredTrades]);

  const monthData = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = Array.from({ length: firstDay }, (_, index) => ({ type: 'empty' as const, key: `leading-${index}` }));
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      const aggregate = tradeMap.get(dateStr);

      return {
        type: 'day' as const,
        key: dateStr,
        day: {
          dateStr,
          dayNumber,
          totalPl: aggregate?.totalPl ?? 0,
          tradeCount: aggregate?.tradeCount ?? 0,
          averageRR: aggregate && aggregate.rrCount > 0 ? aggregate.rrTotal / aggregate.rrCount : null,
          trades: aggregate?.trades ?? [],
          hasMissed: aggregate?.trades.some(t => t.result === 'Untriggered Setup') ?? false,
          hasCancelled: aggregate?.trades.some(t => t.result === 'Cancelled') ?? false,
        } satisfies DayStats,
      };
    });
    const trailingCount = Math.max(0, 42 - leading.length - days.length);
    const trailing = Array.from({ length: trailingCount }, (_, index) => ({ type: 'empty' as const, key: `trailing-${index}` }));
    const activeDays = days.map((cell) => cell.day).filter((day) => day.tradeCount > 0);

    // Weekly summaries — group by calendar row in the grid (chunks of 7 cells, Sun..Sat).
    const allCells = [...leading, ...days, ...trailing];
    const weeks: { weekNumber: number; tradeCount: number; totalPl: number }[] = [];
    for (let i = 0; i < allCells.length; i += 7) {
      const row = allCells.slice(i, i + 7);
      let tradeCount = 0;
      let totalPl = 0;
      for (const c of row) {
        if (c.type === 'day') {
          tradeCount += c.day.tradeCount;
          // Only count realized P/L (exclude untriggered/cancelled) — same as activeDays totals.
          const realized = c.day.trades
            .filter((t) => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled')
            .reduce((s, t) => s + t.profitLoss, 0);
          totalPl += realized;
        }
      }
      weeks.push({ weekNumber: weeks.length + 1, tradeCount, totalPl });
    }
    // Trim trailing empty weeks (no leading/trailing-only rows with no trades).
    while (weeks.length > 0 && weeks[weeks.length - 1].tradeCount === 0) weeks.pop();

    return {
      cells: allCells,
      weeks,
      summary: {
        totalTrades: activeDays.reduce((sum, day) => sum + day.tradeCount, 0),
        activeDays: activeDays.length,
        totalPl: activeDays.reduce((sum, day) => sum + day.totalPl, 0),
        averageRR: activeDays.filter((day) => typeof day.averageRR === 'number').length > 0
          ? activeDays.filter((day) => typeof day.averageRR === 'number').reduce((sum, day) => sum + (day.averageRR ?? 0), 0)
            / activeDays.filter((day) => typeof day.averageRR === 'number').length
          : null,
      },
      bestDay: [...activeDays].sort((a, b) => b.totalPl - a.totalPl)[0] ?? null,
      worstDay: [...activeDays].sort((a, b) => a.totalPl - b.totalPl)[0] ?? null,
      maxAbsPl: Math.max(...activeDays.map((day) => Math.abs(day.totalPl)), 1),
    };
  }, [month, tradeMap, year]);

  // Identify the best (most-profitable) week of the month — gold treatment.
  const bestWeekNumber = useMemo(() => {
    const profitable = monthData.weeks.filter((w) => w.tradeCount > 0 && w.totalPl > 0);
    if (profitable.length === 0) return null;
    return [...profitable].sort((a, b) => b.totalPl - a.totalPl)[0].weekNumber;
  }, [monthData.weeks]);

  const heatmapData = useMemo(() => {
    let maxAbsPl = 1;

    const months: HeatmapMonth[] = MONTHS.map((monthLabel, monthIndex) => {
      const firstDayOfMonth = new Date(year, monthIndex, 1);
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const leadingEmptyDays = firstDayOfMonth.getDay();
      const totalCells = leadingEmptyDays + daysInMonth;
      const totalColumns = Math.ceil(totalCells / 7);
      const columns = Array.from({ length: totalColumns }, () => Array<HeatCell>(7));

      for (let weekdayIndex = 0; weekdayIndex < 7; weekdayIndex += 1) {
        for (let columnIndex = 0; columnIndex < totalColumns; columnIndex += 1) {
          columns[columnIndex][weekdayIndex] = {
            dateStr: '',
            inYear: false,
            totalPl: 0,
            tradeCount: 0,
          };
        }
      }

      for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
        const date = new Date(year, monthIndex, dayNumber);
        const weekdayIndex = date.getDay();
        const offset = leadingEmptyDays + dayNumber - 1;
        const columnIndex = Math.floor(offset / 7);
        const dateStr = toDateString(date);
        const aggregate = tradeMap.get(dateStr);
        const totalPl = aggregate?.totalPl ?? 0;
        const tradeCount = aggregate?.tradeCount ?? 0;

        if (tradeCount > 0) maxAbsPl = Math.max(maxAbsPl, Math.abs(totalPl));

        columns[columnIndex][weekdayIndex] = {
          dateStr,
          inYear: true,
          totalPl,
          tradeCount,
        };
      }

      return {
        label: monthLabel.slice(0, 3).toUpperCase(),
        columns,
      };
    });

    return { months, maxAbsPl };
  }, [tradeMap, year]);

  const selectedTrades = useMemo(() => {
    if (!selectedDate) return [];
    return [...(tradeMap.get(selectedDate)?.trades ?? [])].sort((a, b) => (a.entryTime ?? '').localeCompare(b.entryTime ?? ''));
  }, [selectedDate, tradeMap]);

  const marketOptions = useMemo(() => Array.from(new Set(trades.map((trade) => trade.market))).sort(), [trades]);
  const setupOptions = useMemo(() => Array.from(new Set([...customSetups, ...trades.map((trade) => trade.setup)])).filter(Boolean).sort(), [customSetups, trades]);
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);


  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((current) => current - 1);
      return;
    }
    setMonth((current) => current - 1);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((current) => current + 1);
      return;
    }
    setMonth((current) => current + 1);
  };

  const totalSelectedPl = selectedTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
  const selectedRRValues = selectedTrades.filter((trade) => typeof trade.actualRR === 'number').map((trade) => trade.actualRR as number);
  const selectedAvgRR = selectedRRValues.length > 0
    ? selectedRRValues.reduce((sum, value) => sum + value, 0) / selectedRRValues.length
    : null;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        <section className="rounded-[28px] border border-border bg-card p-4 shadow-sm lg:p-5">
          <div className="flex flex-col gap-4 border-b border-border pb-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Trading Calendar</p>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground">{MONTHS[month]}</h3>
                    <select
                      value={year}
                      onChange={e => setYear(parseInt(e.target.value))}
                      className="bg-transparent font-heading text-2xl font-bold tracking-tight text-foreground border-none outline-none cursor-pointer appearance-none"
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                        <option key={y} value={y} className="bg-card text-foreground text-base">{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Trades</p>
                  <p className="mt-1 font-heading text-xl font-bold tracking-tight text-foreground">{monthData.summary.totalTrades}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Active Days</p>
                  <p className="mt-1 font-heading text-xl font-bold tracking-tight text-foreground">{monthData.summary.activeDays}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Net P/L</p>
                  <p className={cn('mt-1 font-heading text-xl font-bold tracking-tight', monthData.summary.totalPl >= 0 ? 'text-success' : 'text-destructive')}>
                    {formatCompact(monthData.summary.totalPl)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Avg RR</p>
                  <p className="mt-1 font-heading text-xl font-bold tracking-tight text-foreground">{monthData.summary.averageRR?.toFixed(2) ?? '—'}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> Filter performance view
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[640px] lg:max-w-[760px] lg:flex-1">
                <select value={filters.accountId} onChange={(e) => setFilters((current) => ({ ...current, accountId: e.target.value }))} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring">
                  <option value="all">All accounts</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <select value={filters.market} onChange={(e) => setFilters((current) => ({ ...current, market: e.target.value }))} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring">
                  <option value="all">All markets</option>
                  {marketOptions.map((market) => <option key={market} value={market}>{market}</option>)}
                </select>
                <select value={filters.setup} onChange={(e) => setFilters((current) => ({ ...current, setup: e.target.value }))} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring">
                  <option value="all">All setups</option>
                  {setupOptions.map((setup) => <option key={setup} value={setup}>{setup}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-2">
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="rounded-xl border border-border/70 bg-muted/30 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{weekday}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthData.cells.map((cell) => cell.type === 'empty' ? (
                  <div key={cell.key} />
                ) : (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => cell.day.tradeCount > 0 && setSelectedDate(cell.day.dateStr)}
                    className={cn(
                       'flex flex-col justify-between rounded-2xl border p-1 sm:p-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                       'h-[52px] sm:h-24 lg:h-28 min-w-0 overflow-hidden',
                      cell.day.tradeCount > 0 ? 'hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]' : 'cursor-default',
                      getTone(cell.day, monthData.maxAbsPl, 'calendar'),
                    )}
                  >
                    <div className="flex items-start justify-between gap-0.5 min-w-0">
                      <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">{cell.day.dayNumber}</span>
                      {cell.day.tradeCount > 0 && <span className="hidden sm:inline rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">{cell.day.tradeCount}T</span>}
                    </div>

                    {cell.day.tradeCount > 0 && (
                      <div className="min-w-0 overflow-hidden">
                        {/* Mobile: compact */}
                        <div className="sm:hidden flex items-center gap-0.5 min-w-0">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cell.day.totalPl >= 0 ? 'bg-success' : 'bg-destructive'}`} />
                          <span className="text-[8px] font-mono font-bold truncate">{formatCompact(cell.day.totalPl)}</span>
                        </div>
                        {/* Desktop: full info */}
                        <p className={cn('hidden sm:block truncate font-heading text-lg font-bold leading-none tracking-tight', cell.day.totalPl >= 0 ? 'text-success' : 'text-destructive')}>
                          {formatCompact(cell.day.totalPl)}
                        </p>
                        <p className="hidden sm:block truncate text-[11px] font-medium text-muted-foreground">
                          {cell.day.tradeCount} trade{cell.day.tradeCount > 1 ? 's' : ''}
                        </p>
                        {typeof cell.day.averageRR === 'number' && (
                          <p className="hidden sm:block text-[9px] uppercase tracking-[0.08em] text-muted-foreground truncate">
                            RR {cell.day.averageRR.toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Weekly Summary
              </div>
              {monthData.weeks.map((w) => {
                const isBest = bestWeekNumber === w.weekNumber;
                const isProfit = w.totalPl > 0;
                const isLoss = w.totalPl < 0;
                return (
                  <div
                    key={w.weekNumber}
                    className={cn(
                      'rounded-2xl border bg-background p-3 transition-colors',
                      isBest && 'border-gold/50 bg-[linear-gradient(135deg,hsl(var(--gold)/0.12),hsl(var(--background))_60%)] shadow-[0_0_0_1px_hsl(var(--gold)/0.18)_inset]',
                      !isBest && isProfit && 'border-success/30',
                      !isBest && isLoss && 'border-destructive/30',
                      !isBest && !isProfit && !isLoss && 'border-border',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className={cn('text-xs font-bold uppercase tracking-[0.14em]', isBest ? 'text-gold' : 'text-foreground')}>
                        Week {w.weekNumber}
                      </p>
                      {isBest && (
                        <span className="rounded-full border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-gold">
                          Best
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Trades: <span className="font-semibold text-foreground tabular-nums">{w.tradeCount}</span>
                    </p>
                    <p className={cn(
                      'mt-0.5 font-heading text-base font-bold tabular-nums',
                      isBest ? 'text-gold' : isProfit ? 'text-success' : isLoss ? 'text-destructive' : 'text-muted-foreground',
                    )}>
                      P/L: {w.totalPl > 0 ? '+' : ''}{formatCompact(w.totalPl)}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-4 shadow-sm lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <CalendarRange className="h-4 w-4" /> Yearly consistency view
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setYear(y => y - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-heading text-sm font-bold min-w-[48px] text-center">{year}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setYear(y => y + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-sm font-bold uppercase tracking-[0.14em] text-foreground">Trading Activity Heatmap</h3>
                <p className="text-xs text-muted-foreground">Daily performance intensity over the year</p>
              </div>

              <div className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:flex">
                <span>Less</span>
                <span className="h-3 w-3 rounded-[4px] border border-border/70 bg-muted/35" />
                <span className="h-3 w-3 rounded-[4px] border border-success/25 bg-success/35" />
                <span className="h-3 w-3 rounded-[4px] border border-success/35 bg-success/70" />
                <span className="h-3 w-3 rounded-[4px] border border-success/50 bg-success" />
                <span>More</span>
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="inline-flex min-w-max items-start gap-3">
                <div className="grid gap-1 pt-6 pr-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {HEATMAP_WEEKDAYS.map((label) => (
                    <div key={label} className="flex h-4 items-center justify-end whitespace-nowrap">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="inline-flex items-start gap-3">
                  {heatmapData.months.map((monthBlock) => (
                    <div key={monthBlock.label} className="flex flex-col gap-1">
                      <div className="h-4 pl-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {monthBlock.label}
                      </div>
                      <div className="inline-flex gap-1">
                        {monthBlock.columns.map((column, columnIndex) => (
                          <div key={`${monthBlock.label}-${columnIndex}`} className="grid gap-1">
                            {column.map((day, rowIndex) => (
                              <Tooltip key={day.dateStr || `${monthBlock.label}-${columnIndex}-${rowIndex}`}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => day.inYear && day.tradeCount > 0 && setSelectedDate(day.dateStr)}
                                    className={cn(
                                      'h-4 w-4 rounded-[4px] border transition-transform duration-200',
                                      day.inYear && day.tradeCount > 0 ? 'hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-95' : 'cursor-default',
                                      day.inYear
                                        ? getTone({ dateStr: day.dateStr, dayNumber: 0, totalPl: day.totalPl, tradeCount: day.tradeCount, averageRR: null, trades: tradeMap.get(day.dateStr)?.trades ?? [], hasMissed: false, hasCancelled: false }, heatmapData.maxAbsPl, 'heatmap')
                                        : 'border-transparent bg-transparent opacity-0',
                                    )}
                                  />
                                </TooltipTrigger>
                                {day.inYear && (
                                  <TooltipContent className="rounded-xl border-border bg-popover px-3 py-2 text-xs shadow-md">
                                    <div className="space-y-1">
                                      <p className="font-semibold text-foreground">{formatDisplayDate(day.dateStr)}</p>
                                      <p className="text-muted-foreground">Trades: {day.tradeCount}</p>
                                      <p className={cn('font-medium', day.totalPl >= 0 ? 'text-success' : 'text-destructive')}>
                                        P/L: {formatCompact(day.totalPl)}
                                      </p>
                                    </div>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <Sheet open={Boolean(selectedDate)} onOpenChange={(open) => !open && setSelectedDate(null)}>
          <SheetContent side="right" className="w-full overflow-y-auto border-l border-border bg-background p-0 sm:max-w-xl">
            <div className="space-y-6 p-6">
              <SheetHeader className="space-y-3 border-b border-border pb-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle className="font-heading text-xl font-bold tracking-tight">{selectedDate ? formatDisplayDate(selectedDate) : 'Trading Day'}</SheetTitle>
                    <SheetDescription>Detailed trade breakdown for the selected day.</SheetDescription>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.12em]">{selectedTrades.length} trade{selectedTrades.length === 1 ? '' : 's'}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Net P/L</p>
                    <p className={cn('mt-2 font-heading text-xl font-bold', totalSelectedPl >= 0 ? 'text-success' : 'text-destructive')}>
                      {totalSelectedPl >= 0 ? '+' : ''}{totalSelectedPl.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Trades</p>
                    <p className="mt-2 font-heading text-xl font-bold text-foreground">{selectedTrades.length}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Avg RR</p>
                    <p className="mt-2 font-heading text-xl font-bold text-foreground">{selectedAvgRR?.toFixed(2) ?? '—'}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-3">
                {selectedTrades.map((trade) => (
                  <div key={trade.id} className={cn('rounded-2xl border p-4 shadow-sm', trade.profitLoss >= 0 ? 'border-success/20 bg-success/5' : 'border-destructive/20 bg-destructive/5')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-heading text-lg font-bold tracking-tight text-foreground">{trade.asset}</h4>
                          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-[0.12em]">{trade.market}</Badge>
                          <Badge variant="secondary" className="rounded-full text-[10px] uppercase tracking-[0.12em]">{trade.setup}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{trade.direction}</span>
                          <span>•</span>
                          <span>{trade.session}</span>
                          {trade.entryTime && <><span>•</span><span>{trade.entryTime}</span></>}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={cn('font-heading text-2xl font-bold leading-none', trade.profitLoss >= 0 ? 'text-success' : 'text-destructive')}>
                          {trade.profitLoss >= 0 ? '+' : ''}{trade.profitLoss.toFixed(2)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">RR {trade.actualRR?.toFixed(2) ?? '—'}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {trade.accounts.map((account) => (
                        <Badge key={account.accountId} variant="outline" className="rounded-full text-[10px] uppercase tracking-[0.12em]">
                          {accountMap.get(account.accountId) ?? 'Account'} · {account.riskPercent}%
                        </Badge>
                      ))}
                    </div>

                    {trade.notes && <p className="mt-4 text-sm leading-6 text-muted-foreground">{trade.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
