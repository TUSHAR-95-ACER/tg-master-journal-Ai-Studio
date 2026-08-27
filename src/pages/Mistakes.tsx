import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrading } from '@/contexts/TradingContext';
import { useAICoach } from '@/contexts/AICoachContext';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, ComposedChart, Area, Line, LabelList,
} from 'recharts';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { Mistake, Session, Trade } from '@/types/trading';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CalendarRange, Download, Brain, AlertOctagon, Clock, RotateCcw,
  TrendingUp, ArrowRight, Target, Lightbulb, ShieldCheck, Sparkles,
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const ALL_MISTAKES: Mistake[] = ['FOMO', 'Early Entry', 'Overtrading', 'Emotional', 'Ignored SL'];
const ALL_SESSIONS: Session[] = ['Asia', 'London', 'New York', 'New York Kill Zone', 'London Close'];

/* shared palette — same tokens as the Psychology dashboard */
const C = {
  green: '#22C55E',
  purple: '#8B5CF6',
  blue: '#3B82F6',
  orange: '#F59E0B',
  red: '#EF4444',
  yellow: '#FACC15',
  muted: '#9CA3AF',
  border: '#262626',
  card: 'rgba(0,0,0,0.8)',
  grid: '#232323',
};

const cardBase = 'rounded-[9px] border border-[#262626] bg-black/80';

const MISTAKE_COLOR: Record<string, string> = {
  'FOMO': C.red,
  'Emotional': C.orange,
  'Ignored SL': C.purple,
  'Early Entry': C.blue,
  'Overtrading': C.green,
};
const fallbackColor = (i: number) => [C.red, C.orange, C.purple, C.blue, C.green][i % 5];

const SEVERITY: Record<string, { level: string; color: string }> = {
  'FOMO': { level: 'Critical', color: C.red },
  'Ignored SL': { level: 'Critical', color: C.red },
  'Early Entry': { level: 'Medium', color: C.yellow },
  'Emotional': { level: 'High', color: C.orange },
  'Overtrading': { level: 'Low', color: C.green },
};

const toISO = (d: Date) => d.toISOString().slice(0, 10);
const fmtDay = (d?: Date) =>
  d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

/* ------------------------------------------------------------------ */
/* Presentational primitives (Psychology design language)              */
/* ------------------------------------------------------------------ */

function SectionCard({
  title, tooltip, right, children, className, bodyClass,
}: {
  title: string; tooltip?: string; right?: React.ReactNode;
  children: React.ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={cn(cardBase, 'flex min-w-0 flex-col p-4', className)}>
      <header className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate font-sans text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-white">
            {title}
          </h2>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        {right}
      </header>
      <div className={cn('flex min-h-0 flex-1 flex-col', bodyClass)}>{children}</div>
    </section>
  );
}

function KpiCard({
  label, value, valueColor, sub, subColor, delta, deltaTone,
}: {
  label: string; value: string; valueColor?: string;
  sub?: string; subColor?: string;
  delta?: string; deltaTone?: 'up' | 'down' | 'flat';
}) {
  const deltaColor = deltaTone === 'up' ? C.green : deltaTone === 'down' ? C.red : C.muted;
  return (
    <div
      className="flex min-w-0 flex-col rounded-[7px] border transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-28px_rgba(255,255,255,0.35)]"
      style={{ padding: 'clamp(11px, 1.1vw, 16px)', borderColor: C.border, backgroundColor: C.card }}
    >
      <p
        className="truncate font-sans font-semibold uppercase"
        style={{ color: '#E2E8F0', fontSize: 'clamp(8.5px,0.7vw,11px)', letterSpacing: '0.08em' }}
      >
        {label}
      </p>
      <p
        className="mt-[clamp(5px,0.6vw,9px)] truncate font-heading font-bold leading-none tracking-tight"
        style={{
          color: valueColor ?? '#FFFFFF',
          fontSize: value.length > 9 ? 'clamp(14px,1.25vw,20px)' : value.length > 6 ? 'clamp(16px,1.5vw,24px)' : 'clamp(19px,1.9vw,30px)',
        }}
      >
        {value}
      </p>
      <div className="mt-auto">
        {sub && (
          <p className="mt-[clamp(5px,0.6vw,9px)] truncate font-sans" style={{ fontSize: 'clamp(8px,0.68vw,11px)', color: subColor ?? C.muted }}>
            {sub}
          </p>
        )}
        {delta && (
          <p className="mt-[3px] truncate font-sans tabular-nums" style={{ fontSize: 'clamp(8px,0.68vw,11px)', color: deltaColor }}>
            {deltaTone === 'up' ? '↑' : deltaTone === 'down' ? '↓' : '·'} {delta}
          </p>
        )}
      </div>
    </div>
  );
}

function InsightItem({ icon: Icon, tone, children }: { icon: any; tone: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border"
        style={{ borderColor: `${tone}55`, background: `${tone}18`, color: tone }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="min-w-0 font-sans text-[11px] leading-snug" style={{ color: '#E2E8F0' }}>{children}</p>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const size = 96, stroke = 9, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="mistakeGaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.red} />
            <stop offset="55%" stopColor={C.orange} />
            <stop offset="100%" stopColor={C.green} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#mistakeGaugeGrad)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-[22px] font-bold leading-none text-white">{score}</span>
        <span className="mt-1 font-sans text-[8px] uppercase tracking-[0.14em]" style={{ color: C.muted }}>Impact Score</span>
      </div>
    </div>
  );
}

function MiniRing({ pct }: { pct: number }) {
  const size = 18, stroke = 2.5, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const color = pct >= 50 ? C.green : pct >= 25 ? C.orange : C.muted;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct / 100))} />
    </svg>
  );
}

const Tip = ({ active, payload, label, money }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[8px] border px-2.5 py-2" style={{ background: C.card, borderColor: C.grid }}>
      <p className="mb-1 font-sans text-[11px]" style={{ color: C.muted }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-sans text-[12px] tabular-nums" style={{ color: p.color || p.payload?.fill }}>
          {p.name}: {money ? formatCurrency(Number(p.value)) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Mistakes() {
  const { trades } = useTrading();
  const { openDrawer } = useAICoach();

  const allValid = useMemo(
    () => trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'),
    [trades],
  );

  // ---- Date range (defaults to the full span of available trades) ----
  const bounds = useMemo(() => {
    const dates = allValid.map(t => t.date).filter(Boolean).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [allValid]);

  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const from = range?.from ? toISO(range.from) : bounds.min;
  const to = range?.to ? toISO(range.to) : bounds.max;

  const inRange = (t: Trade) => (!from || t.date >= from) && (!to || t.date <= to);
  const valid = useMemo(() => allValid.filter(inRange), [allValid, from, to]);

  // Previous comparable window
  const prev = useMemo(() => {
    if (!from || !to) return [] as Trade[];
    const f = new Date(from).getTime(), t2 = new Date(to).getTime();
    const span = Math.max(t2 - f, 86400_000);
    const pf = toISO(new Date(f - span - 86400_000));
    const pt = toISO(new Date(f - 86400_000));
    return allValid.filter(t => t.date >= pf && t.date <= pt);
  }, [allValid, from, to]);

  /* ---------------- Core analytics (unchanged math) ---------------- */

  const buildMistakeData = (rows: Trade[]) =>
    ALL_MISTAKES.map(m => {
      const mt = rows.filter(t => t.mistakes.includes(m));
      const totalLoss = mt.filter(t => t.profitLoss < 0).reduce((s, t) => s + t.profitLoss, 0);
      const avgLoss = mt.length > 0 ? totalLoss / mt.length : 0;
      return { name: m as string, frequency: mt.length, totalLoss, avgLoss };
    }).sort((a, b) => a.totalLoss - b.totalLoss);

  const mistakeData = useMemo(() => buildMistakeData(valid), [valid]);
  const prevData = useMemo(() => buildMistakeData(prev), [prev]);

  const totalMistakes = mistakeData.reduce((s, m) => s + m.frequency, 0);
  const prevTotalMistakes = prevData.reduce((s, m) => s + m.frequency, 0);
  const totalMistakeLoss = mistakeData.reduce((s, m) => s + m.totalLoss, 0);
  const prevMistakeLoss = prevData.reduce((s, m) => s + m.totalLoss, 0);
  const tradesWithMistakes = valid.filter(t => t.mistakes.length > 0);
  const prevWithMistakes = prev.filter(t => t.mistakes.length > 0);
  const distribution = mistakeData.filter(m => m.frequency > 0).map(m => ({ name: m.name, value: m.frequency }));

  const normalLosses = valid.filter(t => t.profitLoss < 0 && t.mistakes.length === 0);
  const mistakeLosses = valid.filter(t => t.profitLoss < 0 && t.mistakes.length > 0);
  const avgNormalLoss = normalLosses.length > 0 ? normalLosses.reduce((s, t) => s + t.profitLoss, 0) / normalLosses.length : 0;
  const avgMistakeLoss = mistakeLosses.length > 0 ? mistakeLosses.reduce((s, t) => s + t.profitLoss, 0) / mistakeLosses.length : 0;

  const calcRecovery = (rows: Trade[]) => {
    let recoveries = 0, attempts = 0;
    const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].mistakes.length > 0) {
        attempts++;
        if (sorted[i + 1].result === 'Win') recoveries++;
      }
    }
    return attempts > 0 ? Math.round((recoveries / attempts) * 100) : 0;
  };
  const recoveryRate = useMemo(() => calcRecovery(valid), [valid]);
  const prevRecoveryRate = useMemo(() => calcRecovery(prev), [prev]);

  const mistakeBySession = useMemo(
    () => ALL_SESSIONS
      .map(s => ({ name: s as string, count: valid.filter(t => t.session === s && t.mistakes.length > 0).length }))
      .filter(s => s.count > 0),
    [valid],
  );

  const mistakeBySetup = useMemo(() => {
    const setupMap = new Map<string, number>();
    valid.filter(t => t.mistakes.length > 0).forEach(t => {
      setupMap.set(t.setup, (setupMap.get(t.setup) || 0) + t.mistakes.length);
    });
    return Array.from(setupMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [valid]);

  const trendData = useMemo(() => {
    const weeks = new Map<string, { count: number; loss: number }>();
    valid.forEach(t => {
      if (t.mistakes.length === 0) return;
      const d = new Date(t.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      const cur = weeks.get(key) || { count: 0, loss: 0 };
      cur.count += t.mistakes.length;
      if (t.profitLoss < 0) cur.loss += t.profitLoss;
      weeks.set(key, cur);
    });
    return Array.from(weeks.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, v]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: v.count,
        loss: Math.round(v.loss * 100) / 100,
      }));
  }, [valid]);

  const impactScore = useMemo(() => {
    if (valid.length === 0) return 0;
    const totalLoss = valid.filter(t => t.profitLoss < 0).reduce((s, t) => s + Math.abs(t.profitLoss), 0);
    if (totalLoss === 0) return 0;
    return Math.min(100, Math.round((Math.abs(totalMistakeLoss) / totalLoss) * 100));
  }, [valid, totalMistakeLoss]);

  const topMistake = mistakeData.find(m => m.frequency > 0);
  const topMistakePct = topMistake && totalMistakeLoss !== 0
    ? Math.round((topMistake.totalLoss / totalMistakeLoss) * 100) : 0;
  const worstSession = mistakeBySession.length
    ? mistakeBySession.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  const topSetup = mistakeBySetup[0];
  const setupSharePct = topSetup && totalMistakes
    ? Math.round((topSetup.count / totalMistakes) * 100) : 0;
  const repeatDelta = prevTotalMistakes > 0
    ? Math.round(((prevTotalMistakes - totalMistakes) / prevTotalMistakes) * 100) : 0;

  const pctDelta = (cur: number, before: number) =>
    before === 0 ? null : Math.round(((cur - before) / Math.abs(before)) * 100);

  const mistakesDelta = totalMistakes - prevTotalMistakes;
  const lossDeltaPct = pctDelta(Math.abs(totalMistakeLoss), Math.abs(prevMistakeLoss));
  const rateNow = valid.length ? Math.round((tradesWithMistakes.length / valid.length) * 100) : 0;
  const ratePrev = prev.length ? Math.round((prevWithMistakes.length / prev.length) * 100) : 0;

  /* ---------------- Table state ---------------- */
  const [typeFilter, setTypeFilter] = useState('all');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'impact' | 'frequency' | 'loss'>('impact');

  const tableRows = useMemo(() => {
    const scoped = sessionFilter === 'all' ? valid : valid.filter(t => t.session === sessionFilter);
    const rows = buildMistakeData(scoped)
      .filter(m => typeFilter === 'all' || m.name === typeFilter)
      .map(m => {
        const impactPct = totalMistakeLoss !== 0 ? Math.round((m.totalLoss / totalMistakeLoss) * 100) : 0;
        const rows2 = scoped.filter(t => t.mistakes.includes(m.name as Mistake));
        const wins = rows2.filter(t => t.result === 'Win').length;
        const recovery = rows2.length ? Math.round((wins / rows2.length) * 100) : 0;
        return { ...m, impactPct, recovery };
      });
    if (sortBy === 'frequency') rows.sort((a, b) => b.frequency - a.frequency);
    else if (sortBy === 'loss') rows.sort((a, b) => a.totalLoss - b.totalLoss);
    else rows.sort((a, b) => b.impactPct - a.impactPct);
    return rows;
  }, [valid, typeFilter, sessionFilter, sortBy, totalMistakeLoss]);

  const handleExport = () => {
    const header = ['Mistake', 'Frequency', 'Total Loss', 'Avg Loss', 'Impact %', 'Severity', 'Recovery %'];
    const lines = tableRows.map(r => [
      r.name, r.frequency, r.totalLoss.toFixed(2), r.avgLoss.toFixed(2),
      r.impactPct, SEVERITY[r.name]?.level ?? '-', r.recovery,
    ].join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mistakes-analytics-${from ?? 'all'}_${to ?? 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabel = range?.from
    ? `${fmtDay(range.from)}${range.to ? ` – ${fmtDay(range.to)}` : ''}`
    : 'All time';

  const lossByType = mistakeData
    .map(m => ({ name: m.name, loss: Math.abs(Math.round(m.totalLoss * 100) / 100) }))
    .sort((a, b) => b.loss - a.loss);

  return (
    <div className="w-full space-y-2 p-3">
      {/* ══ PHASE 1 — HEADER ══════════════════════════════════════ */}
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="font-heading text-[28px] font-bold uppercase leading-[1.05] tracking-[0.02em] text-white sm:text-[34px] xl:text-[38px]">
            Mistakes Analytics
          </h1>
          <p className="mt-1.5 font-sans text-[12px] sm:text-[13px]" style={{ color: C.muted }}>
            Advanced behavioral analytics &amp; mistake intelligence
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openDrawer}
            className="flex h-9 items-center gap-2 rounded-[9px] border border-white/[0.12] bg-[#121212] px-4 font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-white transition-colors hover:border-white/25 hover:bg-white/5"
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: C.green }} />
            AI Coach
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-9 items-center gap-2.5 rounded-[9px] border border-white/[0.12] bg-[#121212] px-4 font-sans text-[12px] font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/5">
                <span className="tabular-nums">{rangeLabel}</span>
                <CalendarRange className="h-3.5 w-3.5" style={{ color: C.muted }} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} className="pointer-events-auto" />
              <div className="flex justify-end border-t border-border p-2">
                <button className="rounded-md px-3 py-1.5 text-[11px] text-muted-foreground hover:text-white" onClick={() => setRange(undefined)}>
                  Reset to all time
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <button
            onClick={handleExport}
            className="flex h-9 items-center gap-2 rounded-[9px] border border-white/[0.12] bg-[#121212] px-4 font-sans text-[12px] font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/5"
          >
            <Download className="h-3.5 w-3.5" style={{ color: C.muted }} /> Export
          </button>
        </div>
      </div>

      {/* ══ PHASE 1 — SIX KPI CARDS (one row) ═════════════════════ */}
      <div className="grid grid-cols-2 items-stretch gap-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total Mistakes" value={String(totalMistakes)} valueColor={C.red}
          delta={prevTotalMistakes ? `${mistakesDelta > 0 ? '+' : ''}${mistakesDelta} vs last period` : undefined}
          deltaTone={mistakesDelta > 0 ? 'down' : mistakesDelta < 0 ? 'up' : 'flat'}
        />
        <KpiCard
          label="Loss from Mistakes" value={formatCurrency(totalMistakeLoss)} valueColor={C.red}
          delta={lossDeltaPct !== null ? `${lossDeltaPct > 0 ? '+' : ''}${lossDeltaPct}% vs last period` : undefined}
          deltaTone={lossDeltaPct !== null && lossDeltaPct > 0 ? 'down' : 'up'}
        />
        <KpiCard
          label="Trades w/ Mistakes" value={`${tradesWithMistakes.length} / ${valid.length}`}
          sub={`${rateNow}% of executed trades`}
          delta={prev.length ? `${rateNow - ratePrev > 0 ? '+' : ''}${rateNow - ratePrev}% vs last period` : undefined}
          deltaTone={rateNow > ratePrev ? 'down' : rateNow < ratePrev ? 'up' : 'flat'}
        />
        <KpiCard
          label="Impact Score" value={`${impactScore}/100`}
          valueColor={impactScore >= 60 ? C.red : impactScore >= 30 ? C.orange : C.green}
          sub={impactScore >= 60 ? 'Severe — mistakes drive most losses' : impactScore >= 30 ? 'Moderate impact' : 'Excellent control'}
          subColor={impactScore >= 60 ? C.red : impactScore >= 30 ? C.orange : C.green}
        />
        <KpiCard
          label="Recovery Rate" value={`${recoveryRate}%`}
          valueColor={recoveryRate >= 50 ? C.green : C.yellow}
          sub="Win on the next trade"
          delta={prevRecoveryRate ? `${recoveryRate - prevRecoveryRate > 0 ? '+' : ''}${recoveryRate - prevRecoveryRate}% vs last period` : undefined}
          deltaTone={recoveryRate >= prevRecoveryRate ? 'up' : 'down'}
        />
        <KpiCard
          label="Most Common" value={topMistake?.name ?? '—'} valueColor={C.red}
          sub={topMistake ? `${topMistakePct}% of mistake losses` : 'No mistakes logged'}
        />
      </div>

      {/* ══ PHASE 1 — SMART INSIGHTS (one row) ════════════════════ */}
      <section className={cn(cardBase, 'px-4 py-3')}>
        <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[168px_minmax(0,1fr)]">
          <div className="flex items-center gap-2.5 lg:border-r lg:border-[#262626] lg:pr-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border" style={{ borderColor: `${C.green}55`, background: `${C.green}18`, color: C.green }}>
              <Brain className="h-4 w-4" />
            </span>
            <span className="font-sans text-[11px] font-semibold uppercase leading-tight tracking-[0.12em]" style={{ color: C.green }}>
              Smart<br />Insights
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2 lg:grid-cols-4">
            <InsightItem icon={AlertOctagon} tone={C.red}>
              {topMistake
                ? <><span className="font-semibold" style={{ color: C.red }}>{topMistake.name}</span> causes {topMistakePct}% of your mistake losses</>
                : 'No mistake losses recorded in this period'}
            </InsightItem>
            <InsightItem icon={Clock} tone={C.orange}>
              {worstSession
                ? <>Most mistakes happen in <span className="font-semibold" style={{ color: C.orange }}>{worstSession.name}</span></>
                : 'No session concentration detected'}
            </InsightItem>
            <InsightItem icon={RotateCcw} tone={C.green}>
              Recovery rate after mistakes: <span className="font-semibold" style={{ color: C.green }}>{recoveryRate}%</span>
            </InsightItem>
            <InsightItem icon={TrendingUp} tone={C.blue}>
              {repeatDelta > 0
                ? <>You are <span className="font-semibold" style={{ color: C.green }}>{repeatDelta}% better</span> at avoiding repeat mistakes</>
                : repeatDelta < 0
                  ? <>Repeat mistakes are up <span className="font-semibold" style={{ color: C.red }}>{Math.abs(repeatDelta)}%</span> vs last period</>
                  : <>Avg mistake loss {formatCurrency(avgMistakeLoss)} vs normal {formatCurrency(avgNormalLoss)}</>}
            </InsightItem>
          </div>
        </div>
      </section>

      {/* ══ PHASE 2 — ROW 1: three equal cards ════════════════════ */}
      <div className="grid grid-cols-1 items-stretch gap-2 lg:grid-cols-3">
        {/* Mistakes by Type — donut + legend */}
        <SectionCard title="Mistakes by Type" tooltip="Share of each mistake type across the selected period">
          {distribution.length > 0 ? (
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center gap-2">
              <div className="relative h-[168px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={46} outerRadius={70} paddingAngle={2} strokeWidth={0} animationDuration={700}>
                      {distribution.map((d, i) => (
                        <Cell key={d.name} fill={MISTAKE_COLOR[d.name] ?? fallbackColor(i)} />
                      ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-heading text-[20px] font-bold leading-none text-white">{totalMistakes}</span>
                  <span className="mt-1 font-sans text-[8px] uppercase tracking-[0.16em]" style={{ color: C.muted }}>Total</span>
                </div>
              </div>
              <ul className="space-y-1.5">
                {mistakeData.slice().sort((a, b) => b.frequency - a.frequency).map((m, i) => (
                  <li key={m.name} className="flex items-center gap-2 font-sans text-[10px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MISTAKE_COLOR[m.name] ?? fallbackColor(i) }} />
                    <span className="truncate text-white">{m.name}</span>
                    <span className="ml-auto tabular-nums" style={{ color: C.muted }}>
                      {m.frequency} ({totalMistakes ? Math.round((m.frequency / totalMistakes) * 100) : 0}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="grid h-[168px] shrink-0 place-items-center font-sans text-[11px]" style={{ color: C.muted }}>No mistakes logged</div>
          )}
          <div className="mt-auto flex items-center gap-2 border-t border-[#262626] pt-2.5">
            <Target className="h-3.5 w-3.5 shrink-0" style={{ color: C.red }} />
            <p className="truncate font-sans text-[10px]" style={{ color: C.red }}>
              {topMistake ? <><span className="font-semibold">{topMistake.name}</span> is your most expensive mistake</> : 'No mistake concentration detected'}
            </p>
          </div>
        </SectionCard>

        {/* Loss by Mistake Type */}
        <SectionCard
          title="Loss by Mistake Type"
          tooltip="Total realised loss attributable to each mistake"
          right={<span className="shrink-0 font-sans text-[9px] uppercase tracking-[0.12em]" style={{ color: C.muted }}>Total Loss</span>}
        >
          <div className="h-[168px] shrink-0">
            {lossByType.some(l => l.loss > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lossByType} layout="vertical" margin={{ top: 4, right: 62, left: 0, bottom: 2 }} barSize={8}>
                  <CartesianGrid horizontal={false} stroke={C.grid} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: C.muted }} tickFormatter={(v) => `$${v}`} axisLine={{ stroke: C.grid }} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={78} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#FFFFFF' }} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<Tip money />} />
                  <Bar dataKey="loss" name="Loss" radius={[0, 0, 0, 0]} animationDuration={700}>
                    {lossByType.map((d, i) => (
                      <Cell key={d.name} fill={MISTAKE_COLOR[d.name] ?? fallbackColor(i)} />
                    ))}
                    <LabelList dataKey="loss" position="right" offset={8}
                      formatter={(v: number) => (v ? `-${formatCurrency(v)}` : formatCurrency(0))}
                      style={{ fill: C.red, fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center font-sans text-[11px]" style={{ color: C.muted }}>No losses from mistakes</div>
            )}
          </div>
          <div className="mt-auto flex items-center gap-2 border-t border-[#262626] pt-2.5">
            <AlertOctagon className="h-3.5 w-3.5 shrink-0" style={{ color: C.orange }} />
            <p className="truncate font-sans text-[10px]" style={{ color: C.muted }}>
              Total mistake loss <span className="font-semibold" style={{ color: C.red }}>{formatCurrency(totalMistakeLoss)}</span>
            </p>
          </div>
        </SectionCard>

        {/* Mistakes by Session */}
        <SectionCard title="Mistakes by Session" tooltip="Which trading session produces the most mistakes">
          <div className="h-[168px] shrink-0">
            {mistakeBySession.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mistakeBySession} margin={{ top: 18, right: 8, left: -18, bottom: 2 }} barSize={30}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.muted }} axisLine={{ stroke: C.grid }} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: C.muted }} axisLine={{ stroke: C.grid }} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<Tip />} />
                  <Bar dataKey="count" name="Mistakes" fill={C.orange} radius={[0, 0, 0, 0]} animationDuration={700}>
                    <LabelList dataKey="count" position="top" style={{ fill: C.orange, fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center font-sans text-[11px]" style={{ color: C.muted }}>No data</div>
            )}
          </div>
          <div className="mt-auto flex items-center gap-2 border-t border-[#262626] pt-2.5">
            <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: C.orange }} />
            <p className="truncate font-sans text-[10px]" style={{ color: C.muted }}>
              {worstSession
                ? <>Most mistakes during <span className="font-semibold" style={{ color: C.red }}>{worstSession.name}</span></>
                : 'No session data available'}
            </p>
          </div>
        </SectionCard>
      </div>

      {/* ══ PHASE 2 — ROW 2: 65 / 35 ══════════════════════════════ */}
      <div className="grid grid-cols-1 items-stretch gap-2 lg:[grid-template-columns:65fr_35fr]">
        <SectionCard title="Mistakes Trend (Weekly)" tooltip="Weekly mistake count and the loss attached to those weeks">
          <div className="h-[clamp(168px,17vw,214px)] w-full shrink-0">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 20, right: 16, left: -18, bottom: 2 }}>
                  <defs>
                    <linearGradient id="mistakesTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.orange} stopOpacity={0.34} />
                      <stop offset="55%" stopColor={C.orange} stopOpacity={0.13} />
                      <stop offset="100%" stopColor={C.orange} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: C.muted }} axisLine={{ stroke: C.grid }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: C.muted }} axisLine={{ stroke: C.grid }} tickLine={false} />
                  <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.18)' }}
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-[8px] border px-2.5 py-2" style={{ background: C.card, borderColor: C.grid }}>
                          <p className="mb-1 font-sans text-[11px]" style={{ color: C.muted }}>Week of {label}</p>
                          <p className="font-sans text-[12px]" style={{ color: C.orange }}>Mistakes: {d.count}</p>
                          <p className="font-sans text-[12px]" style={{ color: C.red }}>Loss: {formatCurrency(d.loss)}</p>
                        </div>
                      );
                    }} />
                  <Area type="linear" dataKey="count" stroke="none" fill="url(#mistakesTrendFill)"
                    baseValue={0} isAnimationActive={false} activeDot={false} legendType="none" />
                  <Line type="linear" dataKey="count" name="Mistakes" stroke={C.orange} strokeWidth={1.6}
                    dot={{ r: 2.6, fill: C.orange, strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: C.red }} animationDuration={800}>
                    <LabelList dataKey="count" position="top" offset={9} style={{ fill: C.orange, fontSize: 10 }} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center font-sans text-[11px]" style={{ color: C.muted }}>No trend data</div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Mistakes by Setup / Strategy" tooltip="Which setups your mistakes cluster around">
          <div className="h-[clamp(140px,14.5vw,186px)] shrink-0">
            {mistakeBySetup.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mistakeBySetup.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 30, left: 0, bottom: 2 }} barSize={14}>
                  <CartesianGrid horizontal={false} stroke={C.grid} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9, fill: C.muted }} axisLine={{ stroke: C.grid }} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={84} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#FFFFFF' }} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<Tip />} />
                  <Bar dataKey="count" name="Mistakes" fill={C.green} radius={[0, 0, 0, 0]} animationDuration={700}>
                    <LabelList dataKey="count" position="right" offset={7} style={{ fill: C.muted, fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center font-sans text-[11px]" style={{ color: C.muted }}>No data</div>
            )}
          </div>
          <div className="mt-auto flex items-center gap-2 border-t border-[#262626] pt-2.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: C.green }} />
            <p className="truncate font-sans text-[10px]" style={{ color: C.muted }}>
              {topSetup
                ? <><span className="font-semibold text-white">{topSetup.name}</span> setups lead to <span className="font-semibold" style={{ color: C.green }}>{setupSharePct}%</span> of your mistakes</>
                : 'No setup concentration detected'}
            </p>
          </div>
        </SectionCard>
      </div>

      {/* ══ PHASE 3 — 75 / 25 ═════════════════════════════════════ */}
      <div className="grid grid-cols-1 items-start gap-2 xl:[grid-template-columns:75fr_25fr]">
        <SectionCard
          title="Mistakes Breakdown"
          tooltip="Full detail per mistake type with impact, severity and recovery"
          className="overflow-hidden"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-7 w-[108px] rounded-[7px] border-[#262626] bg-black/60 text-[11px]"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ALL_MISTAKES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="h-7 w-[138px] rounded-[7px] border-[#262626] bg-black/60 text-[11px]"><SelectValue placeholder="All Sessions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {ALL_SESSIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-7 w-[132px] rounded-[7px] border-[#262626] bg-black/60 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="impact">Sort: Impact</SelectItem>
                  <SelectItem value="frequency">Sort: Frequency</SelectItem>
                  <SelectItem value="loss">Sort: Loss</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        >
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full font-sans">
              <thead>
                <tr className="border-y border-[#262626] text-left">
                  {['Mistake Type', 'Frequency', 'Total Loss', 'Avg Loss', 'Impact', 'Severity', 'Recovery Rate', 'Action'].map(h => (
                    <th key={h} className="whitespace-nowrap px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((m, i) => {
                  const sev = SEVERITY[m.name];
                  const color = MISTAKE_COLOR[m.name] ?? fallbackColor(i);
                  return (
                    <tr key={m.name} className="border-b border-[#1C1C1C] transition-colors last:border-0 hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-2.5 py-2 text-[11px] font-semibold" style={{ color }}>{m.name}</td>
                      <td className="px-2.5 py-2 text-[11px] tabular-nums text-white">{m.frequency}</td>
                      <td className="px-2.5 py-2 text-[11px] tabular-nums" style={{ color: C.red }}>{formatCurrency(m.totalLoss)}</td>
                      <td className="px-2.5 py-2 text-[11px] tabular-nums" style={{ color: C.red }}>{formatCurrency(m.avgLoss)}</td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.07]">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.abs(m.impactPct))}%`, background: color }} />
                          </div>
                          <span className="text-[10px] tabular-nums" style={{ color: C.muted }}>{Math.abs(m.impactPct)}%</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2">
                        <span
                          className="rounded-[5px] border px-2 py-0.5 text-[9px] font-semibold"
                          style={{ color: sev?.color, borderColor: `${sev?.color}55`, background: `${sev?.color}14` }}
                        >
                          {sev?.level ?? '—'}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <MiniRing pct={m.recovery} />
                          <span className="text-[10px] tabular-nums" style={{ color: C.muted }}>{m.recovery}%</span>
                        </div>
                      </td>
                      <td className="px-2.5 py-2">
                        <button
                          onClick={() => setTypeFilter(m.name)}
                          className="flex items-center gap-1 rounded-[6px] border border-[#262626] px-2 py-1 text-[10px] font-medium text-white transition-colors hover:border-white/25 hover:bg-white/5"
                        >
                          Review <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center font-sans text-[11px]" style={{ color: C.muted }}>No mistakes match these filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Overall Summary" tooltip="Aggregate mistake impact for the selected range">
          <div className="my-2 flex justify-center"><ScoreGauge score={impactScore} /></div>
          <dl className="mt-1 space-y-1.5 font-sans text-[10.5px]">
            {[
              ['Total Mistakes', String(totalMistakes), '#FFFFFF'],
              ['Total Loss', formatCurrency(totalMistakeLoss), C.red],
              ['Avg Mistake Loss', formatCurrency(avgMistakeLoss), C.red],
              ['Best Improvement', repeatDelta > 0 ? `↑ Fewer repeats (${repeatDelta}%)` : repeatDelta < 0 ? `↓ More repeats (${Math.abs(repeatDelta)}%)` : '—', repeatDelta > 0 ? C.green : repeatDelta < 0 ? C.red : '#FFFFFF'],
              ['Focus Area', topMistake ? `${topMistake.name} control` : '—', C.yellow],
            ].map(([k, v, c]) => (
              <div key={k} className="flex items-center justify-between gap-2 border-b border-[#1C1C1C] pb-1.5 last:border-0">
                <dt style={{ color: C.muted }}>{k}</dt>
                <dd className="truncate text-right tabular-nums font-semibold" style={{ color: c }}>{v}</dd>
              </div>
            ))}
          </dl>
          <button
            onClick={openDrawer}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[7px] border px-4 py-2 font-sans text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-white/[0.05]"
            style={{ borderColor: `${C.yellow}55`, color: C.yellow }}
          >
            View AI Action Plan <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </SectionCard>
      </div>

      {/* ══ COACH TIP — full width strip ══════════════════════════ */}
      <section className={cn(cardBase, 'flex flex-col items-start gap-3 px-5 py-3.5 lg:flex-row lg:items-center')}>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${C.yellow}14`, color: C.yellow }}>
            <Lightbulb className="h-4 w-4" />
          </span>
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-white">Coach Tip</span>
        </div>
        <p className="min-w-0 flex-1 font-sans text-[12px] leading-snug" style={{ color: C.muted }}>
          {topMistake
            ? <>Focus on <span className="font-semibold text-white">{topMistake.name}</span> control and wait for confirmation before entries.
              {worstSession && <> Review your <span className="font-semibold text-white">{worstSession.name}</span> trades carefully.</>}
              {' '}Cutting it in half would recover roughly {formatCurrency(Math.abs(topMistake.totalLoss) / 2)}.</>
            : 'No mistakes logged in this period — keep protecting your process and journal every deviation.'}
        </p>
        <Link
          to="/ai-insights"
          className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5"
          style={{ background: C.green }}
        >
          View Full Analysis <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}
