import { useState, useMemo } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import { PageHeader } from '@/components/shared/MetricCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalendarDays, LayoutGrid, List, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Trade } from '@/types/trading';

type CalFilter = 'pl' | 'rr' | 'trades';
type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function CalendarPage() {
  const { trades } = useTrading();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [filter, setFilter] = useState<CalFilter>('pl');
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const validTrades = useMemo(() => trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'), [trades]);

  // Monthly calendar data
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const data: { day: number; pl: number; rr: number; count: number; dateStr: string }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTrades = validTrades.filter(t => t.date === dateStr);
      data.push({
        day: d,
        pl: dayTrades.reduce((s, t) => s + t.profitLoss, 0),
        rr: dayTrades.reduce((s, t) => s + (t.actualRR || 0), 0),
        count: dayTrades.length,
        dateStr,
      });
    }
    return { days: data, offset: firstDay };
  }, [validTrades, year, month]);

  // Weekly data (current week around selectedDate)
  const weekData = useMemo(() => {
    const sel = new Date(selectedDate);
    const dayOfWeek = sel.getDay();
    const start = new Date(sel);
    start.setDate(sel.getDate() - dayOfWeek);

    const days: { date: Date; dateStr: string; dayName: string; pl: number; rr: number; count: number; trades: Trade[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTrades = validTrades.filter(t => t.date === dateStr);
      days.push({
        date: d,
        dateStr,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
        pl: dayTrades.reduce((s, t) => s + t.profitLoss, 0),
        rr: dayTrades.reduce((s, t) => s + (t.actualRR || 0), 0),
        count: dayTrades.length,
        trades: dayTrades,
      });
    }
    return days;
  }, [validTrades, selectedDate]);

  // Daily data
  const dailyTrades = useMemo(() => {
    return validTrades.filter(t => t.date === selectedDate);
  }, [validTrades, selectedDate]);

  // Heatmap (year view)
  const heatmapData = useMemo(() => {
    const data: { date: string; pl: number; rr: number; count: number }[] = [];
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayTrades = validTrades.filter(t => t.date === dateStr);
      data.push({
        date: dateStr,
        pl: dayTrades.reduce((s, t) => s + t.profitLoss, 0),
        rr: dayTrades.reduce((s, t) => s + (t.actualRR || 0), 0),
        count: dayTrades.length,
      });
    }
    return data;
  }, [validTrades, year]);

  // Weekly summaries
  const weeklySummaries = useMemo(() => {
    const weeks: { week: number; pl: number; days: number }[] = [];
    const daysInMonth = calendarData.days.length;
    for (let w = 0; w < 5; w++) {
      const start = w * 7;
      const end = Math.min(start + 7, daysInMonth);
      const weekDays = calendarData.days.slice(start, end);
      weeks.push({
        week: w + 1,
        pl: weekDays.reduce((s, d) => s + d.pl, 0),
        days: weekDays.filter(d => d.count > 0).length,
      });
    }
    return weeks.filter(w => w.days > 0 || w.pl !== 0);
  }, [calendarData]);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getCellValue = (d: { pl: number; rr: number; count: number }) => {
    if (filter === 'pl') return d.pl !== 0 ? `${d.pl > 0 ? '+' : ''}${d.pl.toFixed(0)}` : '';
    if (filter === 'rr') return d.rr !== 0 ? d.rr.toFixed(1) : '';
    return d.count > 0 ? String(d.count) : '';
  };

  const getCellColor = (d: { pl: number; count: number }) => {
    if (d.count === 0) return 'bg-muted/30';
    if (d.pl > 0) return 'bg-profit border-success/20';
    if (d.pl < 0) return 'bg-loss border-destructive/20';
    return 'bg-muted/50';
  };

  const getHeatColor = (d: { pl: number; count: number }) => {
    if (d.count === 0) return 'bg-muted/20';
    const maxPl = Math.max(...heatmapData.map(x => Math.abs(x.pl)), 1);
    const intensity = Math.min(Math.abs(d.pl) / maxPl, 1);
    if (d.pl > 0) return intensity > 0.5 ? 'bg-success/40' : 'bg-success/20';
    if (d.pl < 0) return intensity > 0.5 ? 'bg-destructive/40' : 'bg-destructive/20';
    return 'bg-muted/30';
  };

  const navigateWeek = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir * 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const navigateDay = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatShortDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const viewModes: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
    { value: 'daily', label: 'Day', icon: <CalendarIcon className="w-3.5 h-3.5" /> },
    { value: 'weekly', label: 'Week', icon: <List className="w-3.5 h-3.5" /> },
    { value: 'monthly', label: 'Month', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { value: 'yearly', label: 'Year', icon: <CalendarDays className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="p-6 w-full">
      <PageHeader title="Calendar" subtitle="Trading activity overview">
      </PageHeader>

      {/* View Mode Tabs + Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* View toggle */}
        <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border">
          {viewModes.map(vm => (
            <button
              key={vm.value}
              onClick={() => setViewMode(vm.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                viewMode === vm.value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {vm.icon}
              {vm.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        {/* Context controls */}
        {(viewMode === 'monthly' || viewMode === 'yearly') && (
          <>
            <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
              <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </>
        )}

        {(viewMode === 'daily' || viewMode === 'weekly') && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewMode === 'weekly' ? navigateWeek(-1) : navigateDay(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[160px] text-center">
              {viewMode === 'daily'
                ? formatDate(selectedDate)
                : `${formatShortDate(weekData[0].date)} – ${formatShortDate(weekData[6].date)}`
              }
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewMode === 'weekly' ? navigateWeek(1) : navigateDay(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs ml-1" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
              Today
            </Button>
          </div>
        )}

        <Select value={filter} onValueChange={v => setFilter(v as CalFilter)}>
          <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pl">P/L</SelectItem>
            <SelectItem value="rr">RR</SelectItem>
            <SelectItem value="trades">Trades</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Daily View ── */}
      {viewMode === 'daily' && (
        <div className="space-y-4">
          {/* Day summary card */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">{formatDate(selectedDate)}</h3>
              <span className={cn(
                'font-mono text-lg font-bold',
                dailyTrades.reduce((s, t) => s + t.profitLoss, 0) >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {dailyTrades.length > 0
                  ? `${dailyTrades.reduce((s, t) => s + t.profitLoss, 0) >= 0 ? '+' : ''}${dailyTrades.reduce((s, t) => s + t.profitLoss, 0).toFixed(2)}`
                  : '—'
                }
              </span>
            </div>

            {/* Day stats */}
            {dailyTrades.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-5">
                <div className="bg-muted/30 rounded-md p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trades</p>
                  <p className="font-mono text-lg font-bold">{dailyTrades.length}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Rate</p>
                  <p className="font-mono text-lg font-bold">
                    {((dailyTrades.filter(t => t.result === 'Win').length / dailyTrades.length) * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="bg-muted/30 rounded-md p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg RR</p>
                  <p className="font-mono text-lg font-bold">
                    {(dailyTrades.reduce((s, t) => s + (t.actualRR || 0), 0) / dailyTrades.length).toFixed(2)}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-md p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Trade</p>
                  <p className="font-mono text-lg font-bold text-success">
                    +{Math.max(...dailyTrades.map(t => t.profitLoss), 0).toFixed(0)}
                  </p>
                </div>
              </div>
            )}

            {/* Trade list */}
            {dailyTrades.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No trades on this day</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dailyTrades.map(trade => (
                  <div key={trade.id} className={cn(
                    'flex items-center justify-between p-3 rounded-md border transition-colors hover:border-primary/30',
                    trade.profitLoss >= 0 ? 'bg-profit border-success/10' : 'bg-loss border-destructive/10'
                  )}>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                        trade.direction === 'Long' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                      )}>
                        {trade.direction}
                      </span>
                      <span className="text-sm font-medium">{trade.asset}</span>
                      <span className="text-xs text-muted-foreground">{trade.session}</span>
                      <span className="text-xs text-muted-foreground">{trade.setup}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-muted-foreground">RR: {trade.actualRR?.toFixed(2) ?? '—'}</span>
                      <span className={cn(
                        'font-mono text-sm font-bold',
                        trade.profitLoss >= 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {trade.profitLoss >= 0 ? '+' : ''}{trade.profitLoss.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Weekly View ── */}
      {viewMode === 'weekly' && (
        <div className="space-y-4">
          {/* Week summary bar */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground">Week Summary</h3>
              <span className={cn(
                'font-mono text-lg font-bold',
                weekData.reduce((s, d) => s + d.pl, 0) >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {weekData.reduce((s, d) => s + d.pl, 0) >= 0 ? '+' : ''}
                {weekData.reduce((s, d) => s + d.pl, 0).toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/30 rounded-md p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Trades</p>
                <p className="font-mono text-base font-bold">{weekData.reduce((s, d) => s + d.count, 0)}</p>
              </div>
              <div className="bg-muted/30 rounded-md p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trading Days</p>
                <p className="font-mono text-base font-bold">{weekData.filter(d => d.count > 0).length}</p>
              </div>
              <div className="bg-muted/30 rounded-md p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg RR</p>
                <p className="font-mono text-base font-bold">
                  {weekData.reduce((s, d) => s + d.count, 0) > 0
                    ? (weekData.reduce((s, d) => s + d.rr, 0) / weekData.reduce((s, d) => s + d.count, 0)).toFixed(2)
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Day-by-day breakdown */}
          <div className="grid grid-cols-7 gap-2">
            {weekData.map(day => {
              const isToday = day.dateStr === new Date().toISOString().split('T')[0];
              const isSelected = day.dateStr === selectedDate;
              return (
                <div
                  key={day.dateStr}
                  onClick={() => { setSelectedDate(day.dateStr); setViewMode('daily'); }}
                  className={cn(
                    'bg-card border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30',
                    isToday && 'ring-1 ring-primary/40',
                    isSelected && 'border-primary/50',
                    day.count === 0 && 'opacity-60'
                  )}
                >
                  <div className="text-center">
                    <p className={cn('text-xs font-medium', isToday ? 'text-primary' : 'text-muted-foreground')}>
                      {day.dayName}
                    </p>
                    <p className="text-lg font-bold mt-0.5">{day.date.getDate()}</p>
                    <p className="text-[10px] text-muted-foreground">{formatShortDate(day.date).split(' ')[0]}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border">
                    {day.count > 0 ? (
                      <>
                        <p className={cn(
                          'font-mono text-sm font-bold text-center',
                          day.pl >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {day.pl >= 0 ? '+' : ''}{day.pl.toFixed(0)}
                        </p>
                        <p className="text-[10px] text-muted-foreground text-center mt-0.5">
                          {day.count} trade{day.count !== 1 ? 's' : ''}
                        </p>
                        <div className="flex gap-0.5 mt-2">
                          {day.trades.slice(0, 5).map(t => (
                            <div
                              key={t.id}
                              className={cn(
                                'flex-1 h-1 rounded-full',
                                t.result === 'Win' ? 'bg-success' : t.result === 'Loss' ? 'bg-destructive' : 'bg-muted'
                              )}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground text-center">No trades</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Monthly View ── */}
      {viewMode === 'monthly' && (
        <>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{months[month]} {year}</h3>
            <div className="grid grid-cols-7 gap-1">
              {weekdays.map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
              ))}
              {Array(calendarData.offset).fill(null).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {calendarData.days.map(d => (
                <div
                  key={d.day}
                  onClick={() => { setSelectedDate(d.dateStr); setViewMode('daily'); }}
                  className={cn(
                    'aspect-square rounded-md border border-transparent p-1 flex flex-col items-center justify-center cursor-pointer transition-colors hover:border-primary/30',
                    getCellColor(d),
                    d.dateStr === selectedDate && 'ring-1 ring-primary/50'
                  )}
                >
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                  <span className={cn(
                    'font-mono text-[10px] font-medium',
                    d.pl > 0 ? 'text-success' : d.pl < 0 ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {getCellValue(d)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Summary */}
          {weeklySummaries.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Weekly Summary</h3>
              <div className="grid grid-cols-5 gap-2">
                {weeklySummaries.map(w => (
                  <div key={w.week} className="text-center p-2 rounded-md bg-muted/30">
                    <p className="text-xs text-muted-foreground">Week {w.week}</p>
                    <p className={cn('font-mono text-sm font-medium', w.pl >= 0 ? 'text-success' : 'text-destructive')}>
                      {w.pl >= 0 ? '+' : ''}{w.pl.toFixed(0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{w.days} day{w.days !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Yearly View ── */}
      {viewMode === 'yearly' && (
        <div className="space-y-6">
          {/* Year Heatmap */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{year} Heatmap</h3>
            <div className="flex flex-wrap gap-[2px]">
              {heatmapData.map(d => (
                <div
                  key={d.date}
                  onClick={() => { setSelectedDate(d.date); setViewMode('daily'); }}
                  className={cn('w-3 h-3 rounded-sm cursor-pointer transition-colors hover:ring-1 hover:ring-primary/50', getHeatColor(d))}
                  title={`${d.date}: P/L ${d.pl.toFixed(1)}, ${d.count} trades, RR ${d.rr.toFixed(1)}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted/20" /> No trade</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-destructive/20" /> Loss</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-destructive/40" /> Big Loss</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-success/20" /> Profit</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-success/40" /> Big Profit</span>
            </div>
          </div>

          {/* Monthly breakdown cards */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Monthly Breakdown</h3>
            <div className="grid grid-cols-4 gap-3">
              {months.map((m, i) => {
                const monthTrades = validTrades.filter(t => {
                  const d = new Date(t.date);
                  return d.getFullYear() === year && d.getMonth() === i;
                });
                const pl = monthTrades.reduce((s, t) => s + t.profitLoss, 0);
                return (
                  <div
                    key={m}
                    onClick={() => { setMonth(i); setViewMode('monthly'); }}
                    className={cn(
                      'p-3 rounded-md border cursor-pointer transition-all hover:border-primary/30',
                      monthTrades.length === 0 ? 'bg-muted/20 border-transparent' : 'bg-muted/30 border-border'
                    )}
                  >
                    <p className="text-xs text-muted-foreground">{m.slice(0, 3)}</p>
                    <p className={cn(
                      'font-mono text-sm font-bold mt-1',
                      pl > 0 ? 'text-success' : pl < 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}>
                      {monthTrades.length > 0 ? `${pl >= 0 ? '+' : ''}${pl.toFixed(0)}` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{monthTrades.length} trades</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
