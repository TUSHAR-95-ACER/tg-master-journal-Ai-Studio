import { useState, useMemo } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import {
  calcWinRate, calcProfitFactor, calcAvgRR, calcMaxDrawdown,
  calcEdgeScore, calcExpectancy, formatPercent, getDayOfWeek,
  calcSetupScore, getSetupGrade,
} from '@/lib/calculations';
import { AIInsightsPanel } from '@/components/shared/AIInsightsPanel';
import { adaptTrades } from '@/lib/aiInsightAdapters';
import { Trade, ALL_ASSETS, SETUPS } from '@/types/trading';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line, Area, AreaChart, PieChart, Pie, Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, BarChart3, Target, Award, AlertTriangle,
  Filter, X, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { format, parseISO } from 'date-fns';

// ─── Tooltip ────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card ───────────────────────────────────────────────────────
function KPI({ label, value, sub, trend, color, tooltip }: {
  label: string; value: string; sub?: string;
  trend?: 'up' | 'down' | 'neutral'; color?: string; tooltip?: string;
}) {
  const isGold = color === 'text-gold';
  return (
    <div className={cn(
      "bg-card border rounded-lg p-4 flex flex-col gap-1 hover:shadow-elevated transition-shadow",
      isGold ? 'border-gold/45 bg-[linear-gradient(135deg,hsl(var(--gold)/0.1),hsl(var(--card))_58%)] shadow-[0_0_0_1px_hsl(var(--gold)/0.1)_inset]' : 'border-border'
    )}>
      <div className="flex items-center gap-1">
        <span className={cn("text-[11px] uppercase tracking-wider font-medium", isGold ? 'text-gold' : 'text-muted-foreground')}>{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className="flex items-end gap-2">
        <span className={cn("font-mono text-xl font-bold", color)}>{value}</span>
        {trend && trend !== 'neutral' && (
          trend === 'up'
            ? <TrendingUp className="h-4 w-4 text-success mb-0.5" />
            : <TrendingDown className="h-4 w-4 text-destructive mb-0.5" />
        )}
      </div>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── Filter Pill ────────────────────────────────────────────────────
function FilterPill({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-medium border border-primary/20">
      {label}: {value}
      <button onClick={onClear} className="hover:bg-primary/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
    </span>
  );
}

// ─── Trade Quality ──────────────────────────────────────────────────
function getTradeGrade(t: Trade): string {
  let score = 0;
  if (t.confluences?.length >= 2) score += 2;
  else if (t.confluences?.length === 1) score += 1;
  if (t.management?.length >= 1) score += 1;
  if (t.psychology?.checklist) {
    const c = t.psychology.checklist;
    const checks = [c.followPlan, c.noFomo, c.noRevenge, c.waitedConfirmation, c.riskRespected].filter(Boolean).length;
    score += checks >= 4 ? 2 : checks >= 2 ? 1 : 0;
  }
  if ((t.actualRR || 0) >= 2) score += 2;
  else if ((t.actualRR || 0) >= 1) score += 1;
  if (score >= 7) return 'A+';
  if (score >= 5) return 'A';
  if (score >= 3) return 'B';
  return 'C';
}

// ─── Main Component ─────────────────────────────────────────────────
export default function Analytics() {
  const { trades, sessions: ctxSessions, conditions: ctxConditions, customSetups: ctxSetups, gradesList } = useTrading();

  // Filters
  const [filterPair, setFilterPair] = useState<string>('');
  const [filterSetup, setFilterSetup] = useState<string>('');
  const [filterSession, setFilterSession] = useState<string>('');
  const [filterDirection, setFilterDirection] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // Drill-down
  const [drillTrades, setDrillTrades] = useState<Trade[] | null>(null);
  const [drillLabel, setDrillLabel] = useState('');

  const valid = useMemo(() => {
    let v = trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
    if (filterPair) v = v.filter(t => t.asset === filterPair);
    if (filterSetup) v = v.filter(t => t.setup === filterSetup);
    if (filterSession) v = v.filter(t => t.session === filterSession);
    if (filterDirection) v = v.filter(t => t.direction === filterDirection);
    if (filterDateFrom) v = v.filter(t => t.date >= filterDateFrom);
    if (filterDateTo) v = v.filter(t => t.date <= filterDateTo);
    return v;
  }, [trades, filterPair, filterSetup, filterSession, filterDirection, filterDateFrom, filterDateTo]);

  const hasFilters = !!(filterPair || filterSetup || filterSession || filterDirection || filterDateFrom || filterDateTo);

  // ─── KPI data ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const wr = calcWinRate(valid);
    const netPL = valid.reduce((s, t) => s + t.profitLoss, 0);
    const avgRR = calcAvgRR(valid);
    const pairMap = new Map<string, number>();
    valid.forEach(t => pairMap.set(t.asset, (pairMap.get(t.asset) || 0) + t.profitLoss));
    let best = '-', worst = '-';
    if (pairMap.size > 0) {
      best = [...pairMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
      worst = [...pairMap.entries()].sort((a, b) => a[1] - b[1])[0][0];
    }
    return { total: valid.length, wr, netPL, avgRR, best, worst };
  }, [valid]);

  // ─── Equity Curve ─────────────────────────────────────────────────
  const equityData = useMemo(() => {
    const sorted = [...valid].sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    return sorted.map(t => { cum += t.profitLoss; return { date: t.date, equity: Math.round(cum * 100) / 100 }; });
  }, [valid]);

  // ─── Pair Performance ─────────────────────────────────────────────
  const pairData = useMemo(() => {
    const map = new Map<string, Trade[]>();
    valid.forEach(t => { const a = map.get(t.asset) || []; a.push(t); map.set(t.asset, a); });
    return [...map.entries()].map(([name, ts]) => ({
      name, trades: ts.length, winRate: calcWinRate(ts),
      totalRR: ts.reduce((s, t) => s + (t.actualRR || 0), 0),
      pl: ts.reduce((s, t) => s + t.profitLoss, 0),
    })).sort((a, b) => b.pl - a.pl);
  }, [valid]);

  // ─── Win/Loss Donut ───────────────────────────────────────────────
  const winLossData = useMemo(() => {
    const w = valid.filter(t => t.result === 'Win').length;
    const l = valid.filter(t => t.result === 'Loss').length;
    const b = valid.filter(t => t.result === 'Breakeven').length;
    const m = trades.filter(t => t.result === 'Untriggered Setup').length;
    const c = trades.filter(t => t.result === 'Cancelled').length;
    return [
      { name: 'Wins', value: w, color: 'hsl(142,71%,45%)' },
      { name: 'Losses', value: l, color: 'hsl(0,84%,60%)' },
      { name: 'Breakeven', value: b, color: 'hsl(215,20%,65%)' },
      { name: 'Untriggered Setup', value: m, color: 'hsl(210,100%,50%)' },
      { name: 'Cancelled', value: c, color: 'hsl(48,96%,53%)' },
    ].filter(d => d.value > 0);
  }, [valid, trades]);

  // ─── RR Distribution ─────────────────────────────────────────────
  const rrDistData = useMemo(() => {
    const buckets: Record<string, number> = { '<-2': 0, '-2 to -1': 0, '-1 to 0': 0, '0 to 1': 0, '1 to 2': 0, '2 to 3': 0, '3+': 0 };
    valid.forEach(t => {
      const rr = t.actualRR || 0;
      if (rr < -2) buckets['<-2']++;
      else if (rr < -1) buckets['-2 to -1']++;
      else if (rr < 0) buckets['-1 to 0']++;
      else if (rr < 1) buckets['0 to 1']++;
      else if (rr < 2) buckets['1 to 2']++;
      else if (rr < 3) buckets['2 to 3']++;
      else buckets['3+']++;
    });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [valid]);

  // ─── Session Performance ──────────────────────────────────────────
  const sessionData = useMemo(() => {
    const allSessions = [...new Set([...ctxSessions, ...valid.map(t => t.session)])];
    return allSessions.map(s => {
      const st = valid.filter(t => t.session === s);
      return { name: s.length > 15 ? s.slice(0, 12) + '…' : s, fullName: s, trades: st.length, winRate: calcWinRate(st), pl: st.reduce((a, t) => a + t.profitLoss, 0) };
    }).filter(d => d.trades > 0);
  }, [valid, ctxSessions]);

  // ─── Setup Performance ────────────────────────────────────────────
  const setupData = useMemo(() => {
    const map = new Map<string, Trade[]>();
    valid.forEach(t => { const a = map.get(t.setup) || []; a.push(t); map.set(t.setup, a); });
    return [...map.entries()].map(([name, st]) => {
      const wr = calcWinRate(st); const rr = calcAvgRR(st); const dd = calcMaxDrawdown(st);
      const pf = calcProfitFactor(st);
      const score = calcSetupScore({ winRate: wr, avgRR: rr, profitFactor: pf, maxDD: dd, tradeCount: st.length });
      return {
        name, trades: st.length, winRate: wr, avgRR: rr, profitFactor: pf,
        maxDrawdown: dd, totalPL: st.reduce((s, t) => s + t.profitLoss, 0),
        setupRating: score, setupScore: score, grade: getSetupGrade(score),
      };
    }).sort((a, b) => b.setupScore - a.setupScore);
  }, [valid]);

  // ─── Behavior: Overtrading ────────────────────────────────────────
  const overtradingData = useMemo(() => {
    const dayMap = new Map<string, number>();
    valid.forEach(t => dayMap.set(t.date, (dayMap.get(t.date) || 0) + 1));
    return [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30).map(([date, count]) => ({ date: date.slice(5), count }));
  }, [valid]);

  // ─── Behavior: Mistakes ───────────────────────────────────────────
  const mistakeData = useMemo(() => {
    const map = new Map<string, number>();
    valid.forEach(t => t.mistakes?.forEach(m => map.set(m, (map.get(m) || 0) + 1)));
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [valid]);

  // ─── Behavior: Time of day ────────────────────────────────────────
  const timeOfDayData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0, pl: 0 }));
    valid.forEach(t => {
      if (t.entryTime) {
        const h = parseInt(t.entryTime.split(':')[0]);
        if (!isNaN(h) && h >= 0 && h < 24) { hours[h].count++; hours[h].pl += t.profitLoss; }
      }
    });
    return hours.filter(h => h.count > 0);
  }, [valid]);

  // ─── Trade Quality ────────────────────────────────────────────────
  const qualityData = useMemo(() => {
    const gradeMap = new Map<string, Trade[]>();
    // Include ALL trades (including Untriggered/Cancelled) for grade analytics
    trades.forEach(t => {
      const g = t.grade || 'Ungraded';
      const a = gradeMap.get(g) || []; a.push(t); gradeMap.set(g, a);
    });
    const allGrades = [...new Set([...gradesList, ...gradeMap.keys()])];
    return allGrades.map(g => {
      const ts = gradeMap.get(g) || [];
      return { grade: g, count: ts.length, winRate: calcWinRate(ts), avgPL: ts.length ? ts.reduce((s, t) => s + t.profitLoss, 0) / ts.length : 0 };
    });
  }, [trades, gradesList]);

  // ─── Week of month / weekday / condition ──────────────────────────
  const conditionData = useMemo(() => {
    const allConds = [...new Set([...ctxConditions, ...valid.map(t => t.marketCondition)])];
    return allConds.map(c => {
      const ct = valid.filter(t => t.marketCondition === c);
      return { name: c, trades: ct.length, winRate: calcWinRate(ct), pl: ct.reduce((a, t) => a + t.profitLoss, 0) };
    }).filter(d => d.trades > 0);
  }, [valid, ctxConditions]);

  const weekOfMonthData = useMemo(() => {
    return [1, 2, 3, 4, 5].map(w => {
      const wt = valid.filter(t => {
        const day = new Date(`${t.date}T00:00:00`).getDate();
        return Math.ceil(day / 7) === w;
      });
      return { name: `Week ${w}`, trades: wt.length, pl: wt.reduce((a, t) => a + t.profitLoss, 0), winRate: calcWinRate(wt) };
    }).filter(w => w.trades > 0);
  }, [valid]);

  // Available filter options
  const pairs = useMemo(() => [...new Set(trades.map(t => t.asset))].sort(), [trades]);
  const setups = useMemo(() => [...new Set([...ctxSetups, ...trades.map(t => t.setup)])].sort(), [trades, ctxSetups]);
  const filterSessions = useMemo(() => [...new Set([...ctxSessions, ...trades.map(t => t.session)])].sort(), [trades, ctxSessions]);

  function handleDrill(label: string, filterFn: (t: Trade) => boolean) {
    setDrillTrades(valid.filter(filterFn));
    setDrillLabel(label);
  }

  return (
    <div className="p-4 lg:p-6 w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold">Analytics Intelligence</h1>
          <p className="text-xs text-muted-foreground">Power BI–style performance analytics</p>
        </div>
      </div>

      {/* ─── Global Filters ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filters</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filterPair} onChange={e => setFilterPair(e.target.value)}
            className="bg-secondary text-foreground border border-border rounded-md px-2 py-1 text-xs">
            <option value="">All Pairs</option>
            {pairs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterSetup} onChange={e => setFilterSetup(e.target.value)}
            className="bg-secondary text-foreground border border-border rounded-md px-2 py-1 text-xs">
            <option value="">All Setups</option>
            {setups.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSession} onChange={e => setFilterSession(e.target.value)}
            className="bg-secondary text-foreground border border-border rounded-md px-2 py-1 text-xs">
            <option value="">All Sessions</option>
            {filterSessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)}
            className="bg-secondary text-foreground border border-border rounded-md px-2 py-1 text-xs">
            <option value="">All Directions</option>
            <option value="Long">Long</option>
            <option value="Short">Short</option>
          </select>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            className="bg-secondary text-foreground border border-border rounded-md px-2 py-1 text-xs" placeholder="From" />
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            className="bg-secondary text-foreground border border-border rounded-md px-2 py-1 text-xs" placeholder="To" />
          {hasFilters && (
            <button onClick={() => { setFilterPair(''); setFilterSetup(''); setFilterSession(''); setFilterDirection(''); setFilterDateFrom(''); setFilterDateTo(''); }}
              className="text-xs text-destructive hover:underline ml-1">Clear All</button>
          )}
        </div>
        {hasFilters && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {filterPair && <FilterPill label="Pair" value={filterPair} onClear={() => setFilterPair('')} />}
            {filterSetup && <FilterPill label="Setup" value={filterSetup} onClear={() => setFilterSetup('')} />}
            {filterSession && <FilterPill label="Session" value={filterSession} onClear={() => setFilterSession('')} />}
            {filterDirection && <FilterPill label="Direction" value={filterDirection} onClear={() => setFilterDirection('')} />}
            {filterDateFrom && <FilterPill label="From" value={filterDateFrom} onClear={() => setFilterDateFrom('')} />}
            {filterDateTo && <FilterPill label="To" value={filterDateTo} onClear={() => setFilterDateTo('')} />}
          </div>
        )}
      </div>

      {/* ─── KPI Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Total Trades" value={String(kpis.total)} trend={kpis.total > 0 ? 'up' : 'neutral'} tooltip="Total filtered trades matching current filter criteria" />
        <KPI label="Win Rate" value={formatPercent(kpis.wr)} trend={kpis.wr >= 50 ? 'up' : 'down'} color={kpis.wr >= 50 ? 'text-success' : 'text-destructive'} tooltip="Percentage of winning trades out of all filtered trades" />
        <KPI label="Net P/L" value={kpis.netPL.toFixed(2)} trend={kpis.netPL >= 0 ? 'up' : 'down'} color={kpis.netPL >= 0 ? 'text-success' : 'text-destructive'} tooltip="Total profit minus total losses across filtered trades" />
        <KPI label="Avg RR" value={kpis.avgRR.toFixed(2)} trend={kpis.avgRR >= 1 ? 'up' : 'down'} tooltip="Average risk-reward ratio achieved on filtered trades" />
        <KPI label="Best Pair" value={kpis.best} sub="Highest P/L" color="text-gold" tooltip="The trading pair with the highest total profit" />
        <KPI label="Worst Pair" value={kpis.worst} sub="Lowest P/L" color="text-destructive" tooltip="The trading pair with the lowest total profit" />
      </div>

      {/* ─── Row 1: Equity + Win/Loss ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Equity Curve</h3><InfoTooltip text="Cumulative profit/loss over time showing your account growth trajectory" /></div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={equityData}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(210,100%,50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(210,100%,50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(215,20%,65%)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="equity" stroke="hsl(210,100%,50%)" fill="url(#eqGrad)" strokeWidth={2} baseValue="dataMin" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Win / Loss Distribution</h3><InfoTooltip text="Breakdown of wins, losses, breakeven, untriggered and cancelled trades" /></div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={winLossData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                {winLossData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Row 2: Pair + RR Distribution ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pair Performance (P/L)</h3><InfoTooltip text="Total P/L for each trading pair — click a bar to drill down" /></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pairData} onClick={(e: any) => { if (e?.activeLabel) handleDrill(`Pair: ${e.activeLabel}`, t => t.asset === e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,20%,65%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="pl" name="P/L" radius={[4, 4, 0, 0]}>
                {pairData.map((d, i) => <Cell key={i} fill={d.pl >= 0 ? 'hsl(142,71%,45%)' : 'hsl(0,84%,60%)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">RR Distribution</h3><InfoTooltip text="How your actual risk-reward ratios are distributed across buckets" /></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rrDistData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,20%,65%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Trades" fill="hsl(210,100%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Row 3: Session + Setup ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Session Performance</h3><InfoTooltip text="Win rate and P/L grouped by trading session — click to drill down" /></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sessionData} onClick={(e: any) => { if (e?.activeLabel) { const sd = sessionData.find(s => s.name === e.activeLabel); handleDrill(`Session: ${sd?.fullName || e.activeLabel}`, t => t.session === (sd?.fullName || e.activeLabel)); } }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,20%,65%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="winRate" name="Win %" fill="hsl(210,100%,50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pl" name="P/L" radius={[4, 4, 0, 0]}>
                {sessionData.map((d: any, i: number) => <Cell key={i} fill={d.pl >= 0 ? 'hsl(142,71%,45%)' : 'hsl(0,84%,60%)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Setup Performance</h3><InfoTooltip text="How each trade setup performs — click to see individual trades" /></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={setupData.slice(0, 8)} onClick={(e: any) => { if (e?.activeLabel) handleDrill(`Setup: ${e.activeLabel}`, t => t.setup === e.activeLabel); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215,20%,65%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="setupRating" name="Setup Rating" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Row 4: Market Condition + Week of Month ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Condition</h3><InfoTooltip text="P/L performance under different market conditions (trending, ranging, etc.)" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={conditionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="pl" name="P/L" radius={[4, 4, 0, 0]}>
                {conditionData.map((d, i) => <Cell key={i} fill={d.pl >= 0 ? 'hsl(142,71%,45%)' : 'hsl(0,84%,60%)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Week of Month</h3><InfoTooltip text="P/L by week of month to find patterns in monthly cycles" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekOfMonthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="pl" name="P/L" fill="hsl(210,100%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Behavior Intelligence Section ───────────────────────── */}
      <div className="space-y-1">
        <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-muted-foreground px-1">Trader Behavior Intelligence</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mistake Frequency</h3><InfoTooltip text="How often each type of mistake occurs" /></div>
          {mistakeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mistakeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,20%,65%)' }} width={80} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Count" fill="hsl(0,84%,60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">No mistakes logged</div>}
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overtrading Detection</h3><InfoTooltip text="Days with more than 3 trades highlighted in red — potential overtrading" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={overtradingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'hsl(215,20%,65%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Trades/Day" radius={[4, 4, 0, 0]}>
                {overtradingData.map((d, i) => <Cell key={i} fill={d.count > 3 ? 'hsl(0,84%,60%)' : 'hsl(210,100%,50%)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time-of-Day Performance</h3><InfoTooltip text="P/L performance by hour of day to find your best trading times" /></div>
          {timeOfDayData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeOfDayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: 'hsl(215,20%,65%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="pl" name="P/L" radius={[4, 4, 0, 0]}>
                  {timeOfDayData.map((d, i) => <Cell key={i} fill={d.pl >= 0 ? 'hsl(142,71%,45%)' : 'hsl(0,84%,60%)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">No time data</div>}
        </div>
      </div>

      {/* ─── Trade Quality Scoring ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trade Quality Distribution</h3><InfoTooltip text="How your trades are distributed across quality grades" /></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={qualityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,19%,27%)" opacity={0.3} />
              <XAxis dataKey="grade" tick={{ fontSize: 11, fill: 'hsl(215,20%,65%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,65%)' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Trades" fill="hsl(210,100%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Performance by Grade</h3><InfoTooltip text="Win rate and average P/L for each quality grade" /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-left">Grade</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right font-mono">Trades</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right font-mono">Win %</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right font-mono">Avg P/L</th>
                </tr>
              </thead>
              <tbody>
                {qualityData.map(q => (
                  <tr key={q.grade} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="px-3 py-2 font-bold text-primary">{q.grade}</td>
                    <td className="px-3 py-2 font-mono text-xs text-right">{q.count}</td>
                    <td className="px-3 py-2 font-mono text-xs text-right">{formatPercent(q.winRate)}</td>
                    <td className={cn("px-3 py-2 font-mono text-xs text-right", q.avgPL >= 0 ? 'text-success' : 'text-destructive')}>{q.avgPL.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Setup Lab Table ─────────────────────────────────────── */}
      {setupData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 mb-3"><h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Setup Performance Lab</h3><InfoTooltip text="Detailed table comparing all setups by win rate, RR, profit factor and more" /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Setup', 'Trades', 'Win %', 'Avg RR', 'PF', 'Max DD', 'Score', 'Grade'].map(h => (
                    <th key={h} className="px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {setupData.map(s => (
                  <tr key={s.name} className="border-b border-border/50 hover:bg-accent/30 cursor-pointer" onClick={() => handleDrill(`Setup: ${s.name}`, t => t.setup === s.name)}>
                    <td className="px-3 py-1.5 text-xs font-medium">{s.name}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{s.trades}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{formatPercent(s.winRate)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{s.avgRR.toFixed(2)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{s.profitFactor.toFixed(2)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-destructive">{s.maxDrawdown.toFixed(2)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs font-bold text-primary">★ {s.setupScore}/100</td>
                    <td className="px-3 py-1.5 font-mono text-xs">
                      <span className={cn(
                        'inline-flex items-center justify-center w-9 h-6 rounded-md font-bold text-[11px]',
                        s.grade === 'A+' && 'bg-gold/20 text-gold border border-gold/35',
                        s.grade === 'A' && 'bg-success/20 text-success',
                        s.grade.startsWith('B') && 'bg-primary/15 text-primary',
                        s.grade.startsWith('C') && 'bg-warning/15 text-warning',
                        s.grade === 'D' && 'bg-destructive/15 text-destructive',
                      )}>{s.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Drill-Down Panel ────────────────────────────────────── */}
      {drillTrades && (
        <div className="bg-card border-2 border-primary/30 rounded-lg p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-heading font-bold text-primary">{drillLabel} — {drillTrades.length} trades</h3>
            <button onClick={() => setDrillTrades(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-hide">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  {['Date', 'Pair', 'Direction', 'Setup', 'Entry', 'Exit', 'RR', 'P/L', 'Result'].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drillTrades.map(t => (
                  <tr key={t.id} className="border-b border-border/30 hover:bg-accent/20">
                    <td className="px-2 py-1 font-mono">{t.date}</td>
                    <td className="px-2 py-1 font-medium">{t.asset}</td>
                    <td className={cn("px-2 py-1", t.direction === 'Long' ? 'text-success' : 'text-destructive')}>{t.direction}</td>
                    <td className="px-2 py-1">{t.setup}</td>
                    <td className="px-2 py-1 font-mono">{t.entryPrice}</td>
                    <td className="px-2 py-1 font-mono">{t.exitPrice || '-'}</td>
                    <td className="px-2 py-1 font-mono">{t.actualRR?.toFixed(2) || '-'}</td>
                    <td className={cn("px-2 py-1 font-mono font-bold", t.profitLoss >= 0 ? 'text-success' : 'text-destructive')}>{t.profitLoss.toFixed(2)}</td>
                    <td className="px-2 py-1">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                        t.result === 'Win' ? 'bg-success/20 text-success' : t.result === 'Loss' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                      )}>{t.result}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Insights — page bottom (universal) */}
      <AIInsightsPanel page="Analytics" payload={adaptTrades(valid)} />
    </div>
  );
}
