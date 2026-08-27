import { useMemo } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle } from 'lucide-react';
import { useTrading } from '@/contexts/TradingContext';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';


function PanelCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-card border border-border rounded-xl p-5 shadow-sm', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: 'success' | 'destructive' | 'warning';
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold',
          color === 'success' && 'text-success',
          color === 'destructive' && 'text-destructive',
          color === 'warning' && 'text-yellow-500',
          !color && 'text-foreground'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function AlertCard({ message, type }: { message: string; type: 'warning' | 'danger' | 'info' }) {
  return (
    <div
      className={cn(
        'rounded-lg px-3 py-2.5 text-xs font-medium flex items-start gap-2',
        type === 'danger' && 'bg-destructive/10 text-destructive border border-destructive/20',
        type === 'warning' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
        type === 'info' && 'bg-primary/10 text-primary border border-primary/20'
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      {message}
    </div>
  );
}

export function DailyExecutionPanels() {
  const { trades, dailyPlans } = useTrading();

  const validTrades = useMemo(
    () => trades.filter((t) => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'),
    [trades]
  );

  const today = new Date().toISOString().split('T')[0];
  const thisWeekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    return d.toISOString().split('T')[0];
  }, []);


  const dailyStatus = useMemo(() => {
    const todayTrades = trades.filter((t) => t.date === today);
    const todayPlan = dailyPlans.find((p) => p.date === today);
    const checklistDone = todayTrades.some((t) => t.psychology?.checklist);

    return {
      tradesToday: todayTrades.length,
      pnlToday: todayTrades.reduce((sum, trade) => sum + trade.profitLoss, 0),
      hasPlan: !!todayPlan,
      checklistDone,
    };
  }, [trades, dailyPlans, today]);


  const checklistStats = useMemo(() => {
    const tradesByDay: Record<string, typeof trades> = {};

    validTrades.forEach((trade) => {
      if (!tradesByDay[trade.date]) tradesByDay[trade.date] = [];
      tradesByDay[trade.date].push(trade);
    });

    let daysWithChecklist = 0;
    let daysWithoutChecklist = 0;
    let plWithChecklist = 0;
    let plWithoutChecklist = 0;

    Object.values(tradesByDay).forEach((dayTrades) => {
      const hasChecklist = dayTrades.some(
        (trade) => trade.psychology?.checklist && Object.values(trade.psychology.checklist).some(Boolean)
      );
      const dayPl = dayTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);

      if (hasChecklist) {
        daysWithChecklist += 1;
        plWithChecklist += dayPl;
      } else {
        daysWithoutChecklist += 1;
        plWithoutChecklist += dayPl;
      }
    });

    const totalDays = daysWithChecklist + daysWithoutChecklist;

    return {
      daysWithChecklist,
      daysWithoutChecklist,
      completionRate: totalDays > 0 ? Math.round((daysWithChecklist / totalDays) * 100) : 0,
      plWithChecklist,
      plWithoutChecklist,
    };
  }, [trades, validTrades]);

  const getScoreColor = (score: number): 'success' | 'destructive' | 'warning' => {
    if (score >= 70) return 'success';
    if (score >= 40) return 'warning';
    return 'destructive';
  };


  const alerts = useMemo(() => {
    const messages: { message: string; type: 'warning' | 'danger' | 'info' }[] = [];
    const weekTrades = trades.filter((trade) => trade.date >= thisWeekStart);
    const tradeDays: Record<string, number> = {};

    weekTrades.forEach((trade) => {
      tradeDays[trade.date] = (tradeDays[trade.date] || 0) + 1;
    });

    const maxPerDay = Math.max(...Object.values(tradeDays), 0);
    if (maxPerDay > 5) {
      messages.push({ message: `You took ${maxPerDay} trades in one day this week — possible overtrading`, type: 'warning' });
    }

    const emotionalTrades = weekTrades.filter(
      (trade) => trade.psychology?.emotion === 'Fearful' || trade.psychology?.emotion === 'Greedy' || trade.psychology?.emotion === 'Anxious'
    );
    if (emotionalTrades.length > 2) {
      messages.push({ message: `${emotionalTrades.length} emotional trades this week — review your psychology`, type: 'danger' });
    }

    const ruleBreaks = weekTrades.reduce((sum, trade) => sum + trade.mistakes.length, 0);
    if (ruleBreaks > 3) {
      messages.push({ message: `${ruleBreaks} rule violations this week — tighten discipline`, type: 'danger' });
    }

    const sortedTrades = [...weekTrades].sort((a, b) => a.date.localeCompare(b.date));
    let maxConsecutiveLosses = 0;
    let currentLosses = 0;

    sortedTrades.forEach((trade) => {
      if (trade.result === 'Loss') {
        currentLosses += 1;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
      } else {
        currentLosses = 0;
      }
    });

    if (maxConsecutiveLosses >= 3) {
      messages.push({ message: `${maxConsecutiveLosses} consecutive losses — consider reducing position size`, type: 'warning' });
    }

    if (checklistStats.daysWithoutChecklist > 2) {
      messages.push({
        message: `Checklist skipped on ${checklistStats.daysWithoutChecklist} trading days — losses are ${formatCurrency(checklistStats.plWithoutChecklist)} without it`,
        type: 'info',
      });
    }

    if (messages.length === 0 && weekTrades.length > 0) {
      messages.push({ message: 'Clean week so far — keep it up!', type: 'info' });
    }

    return messages;
  }, [trades, thisWeekStart, checklistStats]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <PanelCard title="Today's Status" icon={CalendarDays}>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{dailyStatus.tradesToday}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Trades Today</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className={cn('text-2xl font-bold', dailyStatus.pnlToday >= 0 ? 'text-success' : 'text-destructive')}>
                {formatCurrency(dailyStatus.pnlToday)}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Today P/L</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className={cn('text-sm font-semibold', dailyStatus.hasPlan ? 'text-success' : 'text-destructive')}>
                {dailyStatus.hasPlan ? '✓ Done' : '✗ Pending'}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Daily Plan</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className={cn('text-sm font-semibold', dailyStatus.checklistDone ? 'text-success' : 'text-destructive')}>
                {dailyStatus.checklistDone ? '✓ Done' : '✗ Pending'}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Checklist</p>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Behavior Alerts" icon={AlertTriangle}>
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <AlertCard key={index} message={alert.message} type={alert.type} />
            ))}
          </div>
        </PanelCard>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6">
        <PanelCard title="Checklist Intelligence" icon={CheckCircle}>
          <StatRow label="Days Completed" value={checklistStats.daysWithChecklist} color="success" />
          <StatRow
            label="Days Skipped"
            value={checklistStats.daysWithoutChecklist}
            color={checklistStats.daysWithoutChecklist > 2 ? 'destructive' : 'warning'}
          />
          <StatRow label="Completion Rate" value={`${checklistStats.completionRate}%`} color={getScoreColor(checklistStats.completionRate)} />
          <StatRow
            label="P/L With Checklist"
            value={formatCurrency(checklistStats.plWithChecklist)}
            color={checklistStats.plWithChecklist >= 0 ? 'success' : 'destructive'}
          />
          <StatRow
            label="P/L Without Checklist"
            value={formatCurrency(checklistStats.plWithoutChecklist)}
            color={checklistStats.plWithoutChecklist >= 0 ? 'success' : 'destructive'}
          />
          {checklistStats.completionRate > 0 && (
            <div className="mt-2 bg-primary/5 rounded-lg p-2.5 text-[11px] text-primary">
              💡{' '}
              {checklistStats.plWithChecklist > checklistStats.plWithoutChecklist
                ? `Checklist days outperform by ${formatCurrency(checklistStats.plWithChecklist - checklistStats.plWithoutChecklist)}`
                : 'Complete your checklist consistently to see improvement'}
            </div>
          )}
        </PanelCard>
      </div>
    </>
  );
}
