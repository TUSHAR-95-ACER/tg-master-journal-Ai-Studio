import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrading } from '@/contexts/TradingContext';
import { HeaderActions } from '@/components/layout/HeaderActions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAICoach } from '@/contexts/AICoachContext';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Legend, LabelList, ReferenceLine,
} from 'recharts';

import { cn } from '@/lib/utils';
import { generateInsights } from '@/lib/insightEngine';
import { adaptPsychology } from '@/lib/aiInsightAdapters';
import {
  Brain, Target, Eye, HeartPulse, AlertTriangle, Smile, Download, CalendarRange,
  Lightbulb, ArrowRight, TrendingUp, TrendingDown, Activity, Sparkles, ShieldCheck,
} from 'lucide-react';

/* ── tokens (spec: COLOR CODE REFERENCE) ────────────────────────────── */
const C = {
  green: '#22C55E',   // Psychology
  purple: '#8B5CF6',  // Discipline
  blue: '#3B82F6',    // Focus
  orange: '#F59E0B',  // Emotional (Yellow/Amber)
  red: '#EF4444',     // Mistakes
  track: '#26283D',   // Dark Gray remaining track
  emerald: '#10B981',
  yellow: '#FACC15',
  muted: '#9CA3AF',   // Gray (Subtitle)
};

const cardBase =
  'rounded-[9px] border border-[#262626] bg-black/80 p-6 transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-28px_rgba(255,255,255,0.35)]';

/* ── small building blocks ──────────────────────────────────────────── */
function Ring({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={5} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
      <text
        x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="font-mono" fill={color} fontSize={size * 0.24} fontWeight={700}
      >
        {Math.round(pct)}
      </text>
    </svg>
  );
}

/**
 * HALF PROGRESS RING — far right of the KPI card, vertically centered.
 * 180° arc (≈2 o'clock → ≈8 o'clock), 6px thickness, rounded caps, #26283D track.
 */
function HalfRing({ value, color }: { value: number; color: string }) {
  const BOX = 80;
  const stroke = 7;
  const r = BOX / 2 - stroke / 2 - 1;
  const cx = BOX / 2;
  const cy = BOX / 2;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const START = 0;
  const SWEEP = 180;
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  // Crop the viewBox to the right half so the semicircle hugs the card's right edge.
  return (
    <svg
      viewBox={`${cx - stroke / 2 - 1} 0 ${BOX / 2 + stroke / 2 + 1} ${BOX}`}
      className="shrink-0 self-center"
      style={{
        width: 'clamp(26px, 2.6vw, 40px)',
        height: 'clamp(52px, 5.2vw, 80px)',
      }}
      aria-hidden
    >
      <path d={arc(START, START + SWEEP)} stroke={C.track} strokeWidth={stroke} strokeLinecap="round" fill="none" />
      {pct > 0 && (
        <path
          d={arc(START, START + SWEEP * pct)}
          stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none"
          style={{ transition: 'd 500ms ease' }}
        />
      )}
    </svg>
  );
}

/**
 * KPI CARD — layout per reference spec:
 *   [icon] TITLE                         (ring, far right, vertically centered)
 *   42px SCORE  / 100
 *   STATUS (card color)
 *   CHANGE (same color as status)
 */
function KpiCard({
  label, value, suffix, status, change, changeColor, ringValue, color, icon: Icon, tooltip, valueColor,
}: {
  label: string;
  value: string;
  suffix?: string;
  status?: string;
  change: string;
  /** override change text color; defaults to the status/card color */
  changeColor?: string;
  ringValue?: number;
  color: string;
  icon: any;
  tooltip: string;
  valueColor?: string;
}) {
  return (
    <div
      className="relative flex items-start gap-[clamp(6px,0.7vw,10px)] overflow-hidden rounded-[7px] border transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-28px_rgba(255,255,255,0.35)]"
      style={{ padding: 'clamp(12px, 1.2vw, 18px)', borderColor: '#262626', backgroundColor: 'rgba(0,0,0,0.8)' }}
    >
      {/* LEFT — icon in its own column */}
      <span style={{ color }} className="shrink-0 leading-none pt-[2px]">
        <InfoTooltip text={tooltip}>
          <Icon style={{ width: 'clamp(22px, 2.02vw, 30px)', height: 'clamp(22px, 2.02vw, 30px)' }} strokeWidth={1.9} />
        </InfoTooltip>
      </span>

      {/* TEXT COLUMN — title, score, status, change all aligned left */}
      <div className="min-w-0 flex-1">
        <p
          className="overflow-hidden font-semibold uppercase"
          style={{
            color: '#E2E8F0',
            fontSize: 'clamp(8.5px, 0.74vw, 13px)',
            letterSpacing: '0.05em',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            minHeight: 'calc(2 * 1.25em)',
            overflowWrap: 'normal',
            wordBreak: 'keep-all',
            hyphens: 'none',
          }}
        >
          {label}
        </p>




        {/* score */}
        <p className="mt-[clamp(5px,0.6vw,9px)] flex items-baseline gap-[0.2em] whitespace-nowrap leading-none">
          <span
            className="font-heading font-bold tracking-tight"
            style={{
              color: valueColor ?? '#FFFFFF',
              fontSize: value.length > 9 ? 'clamp(14px, 1.2vw, 20px)' : value.length > 6 ? 'clamp(16px, 1.5vw, 24px)' : 'clamp(22px, 2.4vw, 42px)',
            }}
          >
            {value}
          </span>
          {suffix && (
            <span className="font-medium" style={{ color: '#94A3B8', fontSize: 'clamp(9px, 0.85vw, 18px)' }}>
              {suffix}
            </span>
          )}
        </p>

        {/* status */}
        <p
          className="mt-[clamp(4px,0.5vw,8px)] truncate font-semibold"
          style={{ fontSize: 'clamp(9.5px, 0.85vw, 16px)', color, minHeight: '1.2em' }}
        >
          {status ?? '\u00A0'}
        </p>

        {/* change */}
        <p
          className="mt-[3px] overflow-hidden font-normal"
          style={{
            fontSize: 'clamp(8px, 0.7vw, 13px)',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflowWrap: 'normal',
            wordBreak: 'keep-all',
            hyphens: 'none',
            color: changeColor ?? color,
          }}
        >
          {change}
        </p>
      </div>

      {/* RIGHT — half ring, vertically centered (first four cards only) */}
      {ringValue !== undefined && <HalfRing value={ringValue} color={color} />}
    </div>
  );
}




function SectionCard({
  title, subtitle, tooltip, children, className, action,
}: { title: string; subtitle?: string; tooltip?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={cn(cardBase, 'flex flex-col', className)}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] leading-tight text-white">{title}</h2>
            {tooltip && <InfoTooltip text={tooltip} />}
          </div>
          
        </div>
        {action}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A]/95 px-4 py-3 shadow-2xl backdrop-blur">
      <p className="mb-1 text-[11px] uppercase tracking-[0.16em]" style={{ color: C.muted }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono text-[13px] font-semibold" style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ══ PHASE 2 — SECOND ROW SPEC ══════════════════════════════════════ */
const P2 = {
  card: 'rgba(0,0,0,0.8)',
  border: '#262626',
  page: '#000000',
  inner: 'rgba(0,0,0,0.8)',
  grid: '#232323',
  zero: '#333333',

  rowBorder: '#1C1C1C',
  green: '#22C55E',
  blue: '#3B82F6',
  red: '#EF4444',
  yellow: '#FACC15',
  secondary: '#9CA3AF',
  mutedText: '#6B7280',
};


/** Spec card container: #141B2D, 1px rgba(255,255,255,0.08), radius 16px */
function P2Card({
  title, children, className, padding = '20px 24px',
}: { title: string; children: React.ReactNode; className?: string; padding?: string }) {
  return (
    <section
      className={cn('p2-inter flex flex-col rounded-[8px] border', className)}
      style={{ background: P2.card, borderColor: P2.border, padding }}
    >
      <h2
        className="font-sans uppercase"
        style={{ fontSize: 11, fontWeight: 600, color: '#FFFFFF', marginBottom: 10, letterSpacing: '0.12em' }}
      >
        {title}
      </h2>

      <div className="flex-1">{children}</div>
    </section>
  );
}

/** Spec tooltip: bg #0F1422, 1px #262B3D, radius 8px, padding 8px 10px, Inter 12px */
const P2Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-[8px] border"
      style={{ background: P2.inner, borderColor: P2.grid, padding: '8px 10px' }}
    >
      <p style={{ fontSize: 12, color: '#FFFFFF', marginBottom: 2 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: 12, color: p.color || p.stroke || p.fill }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(p.value % 1 === 0 ? 0 : 1) : p.value}
        </p>
      ))}
    </div>
  );
};

/**
 * Semicircular three-zone gauge. All zones (green → yellow → red) are ALWAYS
 * visible. Green opacity fades out as the score rises, yellow fades in, red is
 * constant. No needle / marker / progress arc.
 */
function HealthGauge({ value, size = 'default' }: { value: number; size?: 'default' | 'compact' }) {
  const isCompact = size === 'compact';
  const R = isCompact ? 58 : 66;
  const T = isCompact ? 12 : 13.5;
  const W = (R + T / 2) * 2;
  const H = R + T / 2 + 2;
  const cx = W / 2;
  const cy = R + T / 2;
  const pt = (deg: number) => {
    const rad = (Math.PI * (180 - deg)) / 180;
    return [cx + R * Math.cos(rad), cy - R * Math.sin(rad)] as const;
  };
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  };
  const v = Math.max(0, Math.min(100, value));
  const t = v / 100;
  // smooth interpolation with visibility floors
  const greenOpacity = 1 - 0.45 * t;    // 1.0 → 0.55 (brighter mid-range)
  const yellowOpacity = 0.25 + 0.55 * t; // 0.25 → 0.80 (stays below green mid-range)
  const redOpacity = 0.55;               // fixed
  const deg = (p: number) => (p / 100) * 180;
  const zones: Array<[number, number, string, number]> = [
    [0, 55, P2.green, greenOpacity],
    [55, 75, P2.yellow, yellowOpacity],
    [75, 100, P2.red, redOpacity],
  ];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
      {zones.map(([a, b, color, op]) => (
        <path
          key={color}
          d={arc(deg(a), deg(b))}
          stroke={color}
          strokeOpacity={op}
          strokeWidth={T}
          fill="none"
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}



/* ── page ───────────────────────────────────────────────────────────── */

export default function Psychology() {
  const { trades } = useTrading();
  const { openDrawer } = useAICoach();
  const [range, setRange] = useState<'30' | '90' | 'all'>('all');
  const [emotionFilter, setEmotionFilter] = useState<string>('all');

  const valid = useMemo(
    () => trades.filter(t => t.psychology && t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'),
    [trades],
  );



  const scoped = useMemo(() => {
    if (range === 'all') return valid;
    const days = range === '30' ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return valid.filter(t => new Date(t.date).getTime() >= cutoff);
  }, [valid, range]);

  /* ---- calculations (unchanged logic) ---- */
  const emotionData = useMemo(() => {
    const map = new Map<string, { pl: number; count: number; wins: number }>();
    scoped.forEach(t => {
      const em = t.psychology!.emotion;
      const m = map.get(em) || { pl: 0, count: 0, wins: 0 };
      m.pl += t.profitLoss;
      m.count++;
      if (t.result === 'Win') m.wins++;
      map.set(em, m);
    });
    return Array.from(map.entries()).map(([name, d]) => ({
      name, pl: Math.round(d.pl * 100) / 100, count: d.count,
      winRate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
    }));
  }, [scoped]);

  /* Emotion vs P/L chart series — always shows all six emotion categories */
  const emotionChartData = useMemo(() => {
    const ORDER = ['Confident', 'Calm', 'Neutral', 'Greedy', 'Fearful', 'Frustrated'];
    const byName = new Map(emotionData.map(e => [e.name, e]));
    const extras = emotionData.filter(e => !ORDER.includes(e.name)).map(e => e.name);
    return [...ORDER, ...extras].map(name => ({
      name,
      pl: byName.get(name)?.pl ?? 0,
      count: byName.get(name)?.count ?? 0,
      winRate: byName.get(name)?.winRate ?? 0,
    }));
  }, [emotionData]);

  /* Symmetric, human-readable Y domain + 5 ticks (e.g. 150/75/0/-75/-150) */
  const emotionAxis = useMemo(() => {
    const maxAbs = Math.max(...emotionChartData.map(d => Math.abs(d.pl)), 1);
    const target = maxAbs * 1.25;
    const steps = [25, 50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 5000];
    const half = steps.find(s => s * 2 >= target) ?? Math.ceil(target / 2);
    const top = half * 2;
    return { domain: [-top, top] as [number, number], ticks: [top, half, 0, -half, -top], maxAbs };
  }, [emotionChartData]);


  const trendData = useMemo(() => {
    const sorted = [...scoped].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted.map((t, i) => ({
      index: i + 1,
      date: t.date,
      discipline: t.psychology!.discipline,
      focus: t.psychology!.focus,
      pl: t.profitLoss,
    }));
  }, [scoped]);

  const checklistData = useMemo(() => {
    if (scoped.length === 0) return [];
    const keys = ['followPlan', 'riskRespected', 'waitedConfirmation', 'noRevenge', 'noFomo'];
    const labels: Record<string, string> = {
      followPlan: 'Follow Plan',
      riskRespected: 'Risk Respected',
      waitedConfirmation: 'Confirmation',
      noRevenge: 'No Revenge',
      noFomo: 'No FOMO',
    };
    return keys.map(key => {
      const trueCount = scoped.filter(t => t.psychology!.checklist[key as keyof typeof t.psychology.checklist]).length;
      return { subject: labels[key], value: Math.round((trueCount / scoped.length) * 100) };
    });
  }, [scoped]);

  const mistakeData = useMemo(() => {
    const map = new Map<string, number>();
    scoped.forEach(t => { t.mistakes.forEach(m => map.set(m, (map.get(m) || 0) + 1)); });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [scoped]);

  const stats = useMemo(() => {
    if (scoped.length === 0) return null;
    const avgDiscipline = scoped.reduce((s, t) => s + t.psychology!.discipline, 0) / scoped.length;
    const avgFocus = scoped.reduce((s, t) => s + t.psychology!.focus, 0) / scoped.length;
    const highDisciplineTrades = scoped.filter(t => t.psychology!.discipline >= 4);
    const highDiscWinRate = highDisciplineTrades.length > 0
      ? Math.round((highDisciplineTrades.filter(t => t.result === 'Win').length / highDisciplineTrades.length) * 100) : 0;
    const lowDisciplineTrades = scoped.filter(t => t.psychology!.discipline <= 2);
    const lowDiscWinRate = lowDisciplineTrades.length > 0
      ? Math.round((lowDisciplineTrades.filter(t => t.result === 'Win').length / lowDisciplineTrades.length) * 100) : 0;
    const topEmotion = [...emotionData].sort((a, b) => b.winRate - a.winRate)[0];

    // stability = 100 - normalised spread of discipline scores
    const mean = avgDiscipline;
    const variance = scoped.reduce((s, t) => s + Math.pow(t.psychology!.discipline - mean, 2), 0) / scoped.length;
    const stability = Math.max(0, Math.round(100 - (Math.sqrt(variance) / 2) * 100));
    const mistakesPerTrade = scoped.reduce((s, t) => s + t.mistakes.length, 0) / scoped.length;
    const psychScore = Math.max(0, Math.min(100, Math.round(
      (avgDiscipline / 5) * 40 + (avgFocus / 5) * 30 + (stability / 100) * 20 - mistakesPerTrade * 10 + 10,
    )));

    return {
      avgDiscipline: avgDiscipline.toFixed(1),
      avgFocus: avgFocus.toFixed(1),
      disciplinePct: Math.round((avgDiscipline / 5) * 100),
      focusPct: Math.round((avgFocus / 5) * 100),
      highDiscWinRate,
      lowDiscWinRate,
      totalMistakes: scoped.reduce((s, t) => s + t.mistakes.length, 0),
      mistakesPerTrade,
      stability,
      psychScore,
      topEmotion: topEmotion?.name ?? '—',
      topEmotionWinRate: topEmotion?.winRate ?? 0,
    };
  }, [scoped, emotionData]);

  /* period-over-period deltas (previous equal window) */
  const deltas = useMemo(() => {
    const half = Math.floor(scoped.length / 2);
    if (half < 2) return { disc: null as number | null, focus: null as number | null, score: null as number | null };
    const sorted = [...scoped].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const prev = sorted.slice(0, half), cur = sorted.slice(half);
    const avg = (arr: typeof sorted, k: 'discipline' | 'focus') =>
      arr.reduce((s, t) => s + t.psychology![k], 0) / arr.length;
    return {
      disc: avg(cur, 'discipline') - avg(prev, 'discipline'),
      focus: avg(cur, 'focus') - avg(prev, 'focus'),
      score: ((avg(cur, 'discipline') + avg(cur, 'focus')) - (avg(prev, 'discipline') + avg(prev, 'focus'))) * 10,
    };
  }, [scoped]);

  const fmtDelta = (v: number | null, suffix = '') =>
    v === null ? 'Not enough data' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}${suffix} vs previous period`;

  /* spec: STATUS = secondary information derived from the score band */
  const statusFor = (score: number) =>
    score >= 80 ? 'Strong' : score >= 65 ? 'Good' : score >= 50 ? 'Moderate' : 'At Risk';

  /* spec: CHANGE = "+12 vs last month" (green positive / red negative) */
  const periodLabel = range === '30' ? 'vs last month' : range === '90' ? 'vs last 90d' : 'vs prior';
  const changeText = (v: number | null, digits = 0) =>
    v === null ? 'Not enough data' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)} ${periodLabel}`;
  const changeTone = (v: number | null, invert = false): 'up' | 'down' | undefined =>
    v === null ? undefined : (v >= 0) !== invert ? 'up' : 'down';

  /* spec: header date-range label, e.g. "Jun 1 – Jul 1, 2026" */
  const rangeLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dates = scoped.map(t => new Date(t.date).getTime()).filter(n => Number.isFinite(n));
    const end = new Date();
    const start = range === 'all'
      ? new Date(dates.length ? Math.min(...dates) : end.getTime())
      : new Date(end.getTime() - Number(range) * 86400_000);
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  }, [scoped, range]);



  /* weekday heatmap */
  const heat = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map = new Map<string, { pl: number; count: number; disc: number }>();
    scoped.forEach(t => {
      const d = days[new Date(t.date).getDay()];
      const m = map.get(d) || { pl: 0, count: 0, disc: 0 };
      m.pl += t.profitLoss; m.count++; m.disc += t.psychology!.discipline;
      map.set(d, m);
    });
    const rows = days.slice(1, 6).map(d => {
      const m = map.get(d);
      return { day: d, pl: m ? Math.round(m.pl * 100) / 100 : 0, count: m?.count ?? 0, disc: m && m.count ? m.disc / m.count : 0 };
    });
    const withData = rows.filter(r => r.count > 0);
    const best = withData.length ? [...withData].sort((a, b) => b.pl - a.pl)[0] : null;
    const worst = withData.length ? [...withData].sort((a, b) => a.pl - b.pl)[0] : null;
    const consistent = withData.length ? [...withData].sort((a, b) => b.disc - a.disc)[0] : null;
    return { rows, best, worst, consistent };
  }, [scoped]);

  /* 6-week × Mon–Fri psychology heatmap matrix (avg discipline 0–5 per cell) */
  const heatMatrix = useMemo(() => {
    const startOfWeek = (d: Date) => {
      const x = new Date(d);
      const day = (x.getDay() + 6) % 7; // Monday = 0
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() - day);
      return x;
    };
    const thisWeek = startOfWeek(new Date());
    const weeks = [...Array(6)].map((_, i) => {
      const ws = new Date(thisWeek);
      ws.setDate(ws.getDate() - (5 - i) * 7);
      return { start: ws, label: i === 5 ? 'This Week' : `Week ${i + 1}` };
    });
    return weeks.map(w => ({
      label: w.label,
      cells: [...Array(5)].map((_, di) => {
        const day = new Date(w.start);
        day.setDate(day.getDate() + di);
        const key = day.toDateString();
        const list = scoped.filter(t => new Date(t.date).toDateString() === key);
        const score = list.length ? list.reduce((s, t) => s + t.psychology!.discipline, 0) / list.length : null;
        const pl = list.reduce((s, t) => s + t.profitLoss, 0);
        return { score, count: list.length, pl, date: day.toISOString().slice(0, 10) };
      }),
    }));
  }, [scoped]);

  const heatBands = [
    { label: 'Excellent (4–5)', color: C.emerald, min: 4 },
    { label: 'Good (3–4)', color: C.green, min: 3 },
    { label: 'Average (2–3)', color: C.yellow, min: 2 },
    { label: 'Poor (1–2)', color: C.orange, min: 1 },
    { label: 'Very Poor (0–1)', color: C.red, min: 0 },
  ];
  const heatColor = (score: number | null) =>
    score === null ? 'rgba(255,255,255,0.05)' : (heatBands.find(b => score >= b.min)?.color ?? C.red);

  /* Performance by emotion — always the six canonical emotions */
  const EMOTION_ORDER = ['Confident', 'Calm', 'Neutral', 'Greedy', 'Fearful', 'Frustrated'];
  const emotionColorMap: Record<string, string> = {
    Confident: C.emerald,
    Calm: C.blue,
    Neutral: C.purple,
    Greedy: C.yellow,
    Fearful: C.orange,
    Frustrated: C.red,
  };
  const emotionPerf = useMemo(() => {
    const byName = new Map(emotionData.map(e => [e.name, e]));
    const rows = EMOTION_ORDER.map(name => {
      const e = byName.get(name);
      return { name, pl: e?.pl ?? 0, count: e?.count ?? 0, winRate: e?.winRate ?? 0, color: emotionColorMap[name] };
    });
    const totalAbs = rows.reduce((s, r) => s + Math.abs(r.pl), 0) || 1;
    const maxAbs = Math.max(...rows.map(r => Math.abs(r.pl)), 1);
    const top = [...rows].filter(r => r.count > 0).sort((a, b) => b.pl - a.pl)[0] ?? null;
    return {
      rows: rows.map(r => ({ ...r, pct: Math.round((Math.abs(r.pl) / totalAbs) * 100), barPct: Math.round((Math.abs(r.pl) / maxAbs) * 100) })),
      top,
    };
  }, [emotionData]);
  const emotionDonut = useMemo(
    () => emotionPerf.rows.filter(r => Math.abs(r.pl) > 0).map(r => ({ name: r.name, value: Math.abs(r.pl), pl: r.pl, color: r.color })),
    [emotionPerf],
  );

  /* Top 5 mistakes — always the five canonical categories */
  const MISTAKE_ORDER = ['Emotional Trading', 'FOMO Entries', 'Early Exit', 'Ignored Stop Loss', 'Overtrading'];
  const topMistakes = useMemo(() => {
    const byName = new Map(mistakeData.map(m => [m.name.toLowerCase(), m.count]));
    const find = (label: string) => {
      const l = label.toLowerCase();
      for (const [k, v] of byName) if (k === l || k.includes(l.split(' ')[0])) return v;
      return 0;
    };
    const base = MISTAKE_ORDER.map(name => ({ name, count: find(name) }));
    const extras = mistakeData
      .filter(m => !MISTAKE_ORDER.some(n => n.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])))
      .map(m => ({ name: m.name, count: m.count }));
    return [...base, ...extras]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [mistakeData]);


  const insights = useMemo(() => generateInsights('Psychology', adaptPsychology(trades) as any), [trades]);

  const filteredEmotionRows = useMemo(
    () => (emotionFilter === 'all' ? emotionData : emotionData.filter(e => e.name === emotionFilter)),
    [emotionData, emotionFilter],
  );

  const exportCsv = () => {
    const rows = [
      ['Emotion', 'Trades', 'Win Rate %', 'Total P/L'],
      ...emotionData.map(e => [e.name, e.count, e.winRate, e.pl]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'psychology-emotions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- header (shared) — spec: title + subtitle left, AI COACH + date range right ---- */
  const Header = (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <h1 className="font-heading text-[32px] font-bold uppercase tracking-[0.02em] text-white sm:text-[40px] xl:text-[44px] leading-[1.05]">
          Psychology Dashboard
        </h1>
        <p className="mt-2 text-[13px] sm:text-[14px]" style={{ color: C.muted }}>
          Behavioral analysis • Emotional performance • Trading psychology insights
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={openDrawer}
          className="flex h-11 items-center gap-2 rounded-[12px] border border-white/[0.12] bg-[#121212] px-5 text-[13px] font-bold uppercase tracking-[0.06em] text-white transition-colors hover:border-white/25 hover:bg-white/5"
        >
          <Sparkles className="h-4 w-4" style={{ color: C.blue }} />
          AI Coach
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-11 items-center gap-3 rounded-[12px] border border-white/[0.12] bg-[#121212] px-5 text-[13px] font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/5">
              <span className="tabular-nums">{rangeLabel}</span>
              <CalendarRange className="h-4 w-4" style={{ color: C.muted }} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 border-white/10 bg-[#121212] p-2">
            {(['30', '90', 'all'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'flex w-full items-center rounded-md px-3 py-2 text-left text-[12px] font-semibold transition-colors',
                  range === r ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                )}
              >
                {r === 'all' ? 'All time' : `Last ${r} days`}
              </button>
            ))}
            <div className="my-1 h-px bg-white/10" />
            <button
              onClick={exportCsv}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );


  if (scoped.length === 0 || !stats) {
    return (
      <div className="w-full p-6">
        {Header}
        <div className={cn(cardBase, 'py-20 text-center')} style={{ color: C.muted }}>
          No psychology data in this range. Log trades with psychology fields to see insights.
        </div>
      </div>
    );
  }

  const gaugeValue = stats.psychScore;
  const gaugeAngle = 180 - (gaugeValue / 100) * 180;

  return (
    <div className="w-full space-y-2 p-3">
      {Header}

      {/* ── ROW 1 — 6 KPI CARDS (identical structure per spec) ── */}
      <div className="grid grid-cols-2 gap-[clamp(10px,1vw,16px)] md:grid-cols-3 lg:grid-cols-6">
        {/* 1. PSYCHOLOGY SCORE — Brain (Green), half ring green */}
        <KpiCard
          label="Psychology Score" value={`${stats.psychScore}`} suffix="/ 100" icon={Brain} color={C.green}
          status={statusFor(stats.psychScore)}
          change={changeText(deltas.score)}
          ringValue={stats.psychScore}
          tooltip="Composite score from discipline, focus, emotional stability and mistake rate."
        />
        {/* 2. DISCIPLINE SCORE — Target (Purple) */}
        <KpiCard
          label="Discipline Score" value={`${stats.disciplinePct}`} suffix="/ 100" icon={Target} color={C.purple}
          status={statusFor(stats.disciplinePct)}
          change={changeText(deltas.disc, 1)}
          ringValue={stats.disciplinePct}
          tooltip="Average self-rated discipline score per trade, scaled to 100."
        />
        {/* 3. FOCUS SCORE — Eye (Blue) */}
        <KpiCard
          label="Focus Score" value={`${stats.focusPct}`} suffix="/ 100" icon={Eye} color={C.blue}
          status={statusFor(stats.focusPct)}
          change={changeText(deltas.focus, 1)}
          ringValue={stats.focusPct}
          tooltip="Average self-rated focus score per trade, scaled to 100."
        />
        {/* 4. EMOTIONAL STABILITY — Heart (Amber/Yellow) */}
        <KpiCard
          label="Emotional Stability" value={`${stats.stability}`} suffix="/ 100" icon={HeartPulse} color={C.yellow}
          status={statusFor(stats.stability)}
          change={changeText(deltas.disc, 1)}
          ringValue={stats.stability}
          tooltip="Consistency of discipline scores across trades — higher means less emotional swing."
        />
        {/* 5. TOTAL MISTAKES — Warning Triangle (Red). Value red, no ring, no /100 */}
        <KpiCard
          label="Total Mistakes" value={`${stats.totalMistakes}`} icon={AlertTriangle} color={C.red}
          valueColor={C.red}
          change={`${stats.mistakesPerTrade.toFixed(2)} per trade`}
          changeColor={C.red}
          tooltip="Total number of trading mistakes logged in this range."
        />
        {/* 6. BEST EMOTION — Smiley (Green). Value green, gray subtitle, no ring, no /100 */}
        <KpiCard
          label="Best Emotion" value={stats.topEmotion} icon={Smile} color={C.green}
          valueColor={C.green}
          change="Your best state"
          changeColor={C.muted}
          tooltip="The emotional state that correlates with your best trading results."
        />

      </div>



      {/* ══ PHASE 2 — FIRST ROW (4 cards: 21.7 / 35 / 21.7 / 21.7) ══ */}
      <div
        className="grid grid-cols-1 gap-2 md:[grid-template-columns:21.7fr_35fr_21.7fr_21.7fr]"
        style={{ alignItems: 'stretch' }}
      >
        {/* 1. EMOTIONAL HEALTH SCORE — GAUGE CARD */}
        <P2Card title="Emotional Health Score" padding="10px 18px">
          <div className="flex h-full flex-col justify-end">
          <div className="flex flex-col items-center" style={{ marginTop: 4 }}>
            <HealthGauge value={gaugeValue} size="compact" />
            <p
              className="font-sans text-center"
              style={{ fontSize: 36, fontWeight: 700, color: '#FFFFFF', lineHeight: 1, marginTop: -34 }}
            >
              {gaugeValue}
            </p>
            <p
              className="text-center"
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginTop: 2,
                color: gaugeValue >= 75 ? P2.red : gaugeValue >= 55 ? P2.yellow : P2.green,
              }}
            >
              {gaugeValue >= 70 ? 'Good' : gaugeValue >= 50 ? 'Moderate' : 'At Risk'}
            </p>
            <p
              className="text-center"
              style={{ fontSize: 12, fontWeight: 500, marginTop: 2, color: (deltas.score ?? 0) >= 0 ? P2.green : P2.red }}
            >
              {fmtDelta(deltas.score)}
            </p>
          </div>
          {/* Insight box */}
          <div
            className="flex items-center justify-center rounded-[10px] border text-center"
            style={{ background: P2.inner, borderColor: P2.border, padding: '8px 12px', marginTop: 10, minHeight: 42 }}
          >
            <p style={{ fontSize: 11.5, fontWeight: 400, color: '#A1A1AA', lineHeight: 1.35 }}>
              {gaugeValue >= 70
                ? 'You’re managing emotions well. Keep building consistency.'
                : gaugeValue >= 50
                  ? 'Emotions are mostly stable. Tighten discipline on weak sessions.'
                  : 'Emotional control is slipping. Reduce size and follow your checklist.'}
            </p>
          </div>
          </div>
        </P2Card>





        {/* 2. EMOTION VS P/L — BAR CHART CARD */}
        <P2Card title="Emotion vs P/L" padding="14px 18px 10px 22px">
          <div className="h-full min-h-[139px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emotionChartData} margin={{ top: 20, right: 4, left: -6, bottom: 2 }} barCategoryGap="24%">
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: P2.secondary, fontFamily: 'Inter, sans-serif' }}
                  tickMargin={4}
                  axisLine={{ stroke: '#3A3A3A', strokeWidth: 1 }}
                  tickLine={{ stroke: '#3A3A3A', strokeWidth: 1 }}
                  tickSize={4}
                  interval={0}
                  height={24}
                  minTickGap={-80}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: P2.mutedText, fontFamily: 'Inter, sans-serif' }}
                  axisLine={{ stroke: '#3A3A3A', strokeWidth: 1 }}
                  tickLine={{ stroke: '#3A3A3A', strokeWidth: 1 }}
                  tickSize={4}
                  width={30}
                  domain={emotionAxis.domain}
                  ticks={emotionAxis.ticks}
                  tickFormatter={(v: number) => `${v}`}
                  allowDecimals={false}
                />
                <ReferenceLine y={0} stroke="#4A4A4A" strokeWidth={1.5} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<P2Tip />} />
                <Bar dataKey="pl" name="P/L" maxBarSize={22} animationDuration={700}>
                  {emotionChartData.map((e, i) => {
                    const color = e.pl >= 0
                      ? P2.green
                      : Math.abs(e.pl) / emotionAxis.maxAbs < 0.3 ? P2.yellow : P2.red;
                    return <Cell key={i} fill={color} radius={0 as any} />;
                  })}
                  <LabelList
                    dataKey="pl"
                    content={(props: any) => {
                      const { x, y, width, height, value } = props;
                      const v = Number(value);
                      if (!v) return null;
                      const up = v > 0;
                      const color = up
                        ? P2.green
                        : Math.abs(v) / emotionAxis.maxAbs < 0.3 ? P2.yellow : P2.red;
                      return (
                        <text
                          x={x + width / 2}
                          y={up ? Math.min(y, y + height) - 6 : Math.max(y, y + height) + 12}
                          textAnchor="middle"
                          fontFamily="Inter, sans-serif"
                          fontSize={10}
                          fontWeight={600}
                          fill={color}
                        >
                          {`${v > 0 ? '+' : ''}${v.toFixed(2)}`}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </P2Card>

        {/* 3. MISTAKE FREQUENCY — PROGRESS LIST */}
        <P2Card title="Mistake Frequency" padding="14px 20px">
          {mistakeData.length > 0 ? (
            <div className="flex h-full flex-col justify-between" style={{ minHeight: 139, gap: 6 }}>
              {mistakeData.slice(0, 4).map(m => {
                const pct = Math.round((m.count / scoped.length) * 100);
                return (
                  <div key={m.name} className="flex flex-1 flex-col justify-center">
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: '#FFFFFF', marginBottom: 5 }}>{m.name}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 overflow-hidden rounded-[2px]" style={{ height: 6, background: P2.grid }}>
                        <div
                          className="h-full rounded-[2px] transition-all duration-500"
                          style={{ width: `${pct}%`, background: P2.red }}
                        />
                      </div>
                      <span
                        className="flex shrink-0 items-center justify-center rounded-full"
                        style={{ width: 20, height: 20, background: P2.red, fontSize: 11.5, fontWeight: 600, color: '#FFFFFF' }}
                      >
                        {m.count}
                      </span>
                      <span
                        className="shrink-0 text-right tabular-nums"
                        style={{ width: 32, fontSize: 12.5, fontWeight: 500, color: P2.secondary }}
                      >
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[139px] items-center justify-center" style={{ fontSize: 13, color: P2.secondary }}>
              No mistakes recorded
            </div>
          )}
        </P2Card>

        {/* 4. CHECKLIST ADHERENCE — RADAR CHART */}
        <P2Card title="Checklist Adherence" padding="14px 8px 8px">
          <div className="h-full min-h-[139px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={checklistData} cx="50%" cy="54%" outerRadius="74%" margin={{ top: 8, right: 56, left: 56, bottom: 8 }}>
                <PolarGrid stroke={P2.grid} strokeWidth={1} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: P2.secondary, fontFamily: 'Inter, sans-serif' }} />



                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100] as any}
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    return (
                      <text
                        x={x}
                        y={y}
                        dx={6}
                        dy={3}
                        textAnchor="start"
                        transform=""
                        style={{ fontSize: 8.5, fill: P2.mutedText, fontFamily: 'Inter, sans-serif' }}
                      >
                        {payload.value}
                      </text>
                    );
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <Radar
                  name="Adherence %"
                  dataKey="value"
                  stroke={P2.blue}
                  strokeWidth={1.4}
                  fill="rgba(59,130,246,0.14)"
                  fillOpacity={1}
                  animationDuration={700}
                />
                <Tooltip content={<P2Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </P2Card>
      </div>

      {/* ══ PHASE 2 — CARDS 5 & 6 ══ */}
      <div className="grid grid-cols-1 gap-2 md:[grid-template-columns:63fr_45fr]">
        {/* 5. DISCIPLINE & FOCUS TREND — LINE CHART */}
        <P2Card title="Discipline &amp; Focus Trend" padding="14px 20px">
          <div className="h-[161px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: P2.secondary, fontFamily: 'Inter, sans-serif' }}
                  tickMargin={6}
                  axisLine={{ stroke: '#3A3A3A', strokeWidth: 1 }}
                  tickLine={{ stroke: '#3A3A3A', strokeWidth: 1 }}
                  tickSize={4}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 3, 5]}
                  tick={{ fontSize: 10, fill: P2.secondary, fontFamily: 'Inter, sans-serif' }}
                  axisLine={{ stroke: '#3A3A3A', strokeWidth: 1 }}
                  tickLine={{ stroke: '#3A3A3A', strokeWidth: 1 }}
                  tickSize={4}
                  width={34}
                />
                <Tooltip cursor={{ stroke: P2.grid, strokeWidth: 1 }} content={<P2Tip />} />
                <Legend
                  verticalAlign="top"
                  align="left"
                  height={28}
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ paddingLeft: 34, fontFamily: 'Inter, sans-serif' }}
                  formatter={(v: string) => (
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#FFFFFF', marginRight: 18, fontFamily: 'Inter, sans-serif' }}>{v}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="discipline"
                  name="Discipline"
                  stroke={P2.green}
                  strokeWidth={1.3}
                  dot={false}
                  activeDot={{ r: 4, fill: '#FFFFFF', stroke: P2.green, strokeWidth: 2 }}
                  animationDuration={900}
                />
                <Line
                  type="monotone"
                  dataKey="focus"
                  name="Focus"
                  stroke={P2.blue}
                  strokeWidth={1.3}
                  dot={false}
                  activeDot={{ r: 4, fill: '#FFFFFF', stroke: P2.blue, strokeWidth: 2 }}
                  animationDuration={900}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </P2Card>

        {/* 6. EMOTION PERFORMANCE BREAKDOWN — TABLE */}
        <P2Card title="Emotion Performance Breakdown" padding="14px 20px">
          <div className="h-[161px] overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${P2.grid}` }}>
                  <th style={{ width: '40%', textAlign: 'left', fontSize: 12, fontWeight: 500, color: P2.secondary, paddingBottom: 6 }}>Emotion</th>
                  <th style={{ width: '15%', textAlign: 'center', fontSize: 12, fontWeight: 500, color: P2.secondary, paddingBottom: 6 }}>Trades</th>
                  <th style={{ width: '20%', textAlign: 'center', fontSize: 12, fontWeight: 500, color: P2.secondary, paddingBottom: 6 }}>Win Rate</th>
                  <th style={{ width: '25%', textAlign: 'right', fontSize: 12, fontWeight: 500, color: P2.secondary, paddingBottom: 6 }}>Total P/L</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmotionRows.map(row => (
                  <tr key={row.name} style={{ height: 26, borderBottom: `1px solid ${P2.rowBorder}`, background: 'transparent' }}>
                    <td style={{ textAlign: 'left', fontSize: 12, fontWeight: 500, color: '#FFFFFF' }}>{row.name}</td>
                    <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#FFFFFF' }}>{row.count}</td>
                    <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: row.winRate >= 50 ? P2.green : P2.red }}>{row.winRate}%</td>
                    <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: row.pl >= 0 ? P2.green : P2.red }}>
                      {row.pl >= 0 ? '+' : ''}{row.pl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </P2Card>
      </div>


      {/* ── AI INSIGHTS ROW ── */}
      <section className={cn(cardBase, 'p-5')}>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${C.yellow}14`, color: C.yellow }}>
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-white">AI Insights</h2>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3].map(i => {
            const icons = [TrendingUp, ShieldCheck, Target, Brain];
            const colors = [C.green, C.purple, C.blue, C.orange];
            const Icon = icons[i];
            const text = insights[i];
            return (
              <div key={i} className="flex h-full items-start gap-2.5 rounded-[7px] border border-[#262626] bg-black/80 p-3.5 transition-all duration-[180ms] hover:-translate-y-0.5 hover:border-white/20">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${colors[i]}14`, color: colors[i] }}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-[12px] font-semibold text-white">
                    {['Strength', 'Discipline', 'Pattern', 'Warning'][i]}
                  </p>
                  <p className="mt-1 font-sans text-[11px] leading-snug" style={{ color: C.muted }}>
                    {text ?? 'Not enough data yet to generate this observation.'}
                  </p>
                </div>
              </div>
            );
          })}
          <Link
            to="/ai-insights"
            className="group flex h-full items-center justify-between gap-3 rounded-[7px] border border-[#262626] bg-black/80 p-3.5 transition-all duration-[180ms] hover:-translate-y-0.5 hover:border-emerald-500/40"
          >
            <span className="min-w-0">
              <span className="block font-sans text-[12px] font-semibold text-white">View Full AI Report</span>
              <span className="mt-1 block font-sans text-[11px] leading-snug" style={{ color: C.muted }}>
                Get personalized recommendations
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>


      </section>

      {/* ── BOTTOM GRID ── */}
      <div className="grid grid-cols-1 gap-2 lg:[grid-template-columns:1.08fr_1.02fr_1.02fr]">
        {/* Heatmap — 6 weeks × Mon–Fri matrix + legend + weekly summary */}
        <SectionCard title="Psychology Heatmap" tooltip="Weekly discipline heatmap (Monday–Friday) with weekly summary." className="min-w-0 p-4">
          <div className="grid min-h-0 flex-1 min-w-0 grid-cols-[minmax(0,1fr)_96px] gap-3">
            <div className="grid gap-x-1.5 gap-y-1" style={{ gridTemplateColumns: '48px repeat(5, minmax(0,1fr))' }}>
              <span />
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
                <span key={d} className="text-center font-sans text-[9px] font-medium text-muted-foreground">{d}</span>
              ))}
              {heatMatrix.map(week => (
                <Fragment key={week.label}>
                  <span className="flex items-center whitespace-nowrap font-sans text-[9px] font-medium text-muted-foreground">{week.label}</span>
                  {week.cells.map(cell => (
                    <div
                      key={cell.date}
                      title={cell.count ? `${cell.date} · ${cell.count} trades · ${cell.pl >= 0 ? '+' : ''}${cell.pl.toFixed(2)}` : `${cell.date} · no trades`}
                      className="h-5 rounded-[3px] border border-white/[0.05]"
                      style={{ background: cell.score === null ? 'rgba(255,255,255,0.16)' : heatColor(cell.score) }}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
            <div className="rounded-md border border-[#262626] p-2">
              <p className="mb-2 whitespace-nowrap font-sans text-[8px] font-semibold uppercase text-white">Heatmap Legend</p>
              <div className="space-y-1.5">
                {[...heatBands, { label: 'No Data', color: 'rgba(255,255,255,0.28)' }].map(b => (
                  <span key={b.label} className="flex items-center gap-1.5 whitespace-nowrap font-sans text-[8px] text-muted-foreground">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} />{b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-[#262626] pt-2">
            <p className="font-sans text-[10px] font-semibold text-white">Weekly Summary</p>
            <div className="mt-2 grid grid-cols-3 divide-x divide-[#262626]">
              {[
                { label: 'Best Day', v: heat.best, color: C.green },
                { label: 'Worst Day', v: heat.worst, color: C.red },
                { label: 'Most Consistent', v: heat.consistent, color: C.blue },
              ].map(row => (
                <div key={row.label} className="min-w-0 px-2 text-center first:pl-0 last:pr-0">
                  <p className="truncate font-sans text-[9px] text-muted-foreground">{row.label}</p>
                  <p className="mt-1 truncate font-sans text-[10px] font-semibold" style={{ color: row.color }}>{row.v?.day ?? '—'}</p>
                  <p className="font-sans text-[10px] font-semibold" style={{ color: row.color }}>
                    {row.v ? `${row.v.pl >= 0 ? '+' : ''}${row.v.pl.toFixed(2)}` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Performance by Emotion — donut + six rows + highlight */}
        <SectionCard title="Performance by Emotion" tooltip="Share of absolute P/L generated under each emotional state." className="min-w-0 p-4">
          <div className="mb-5 grid min-h-0 flex-1 grid-cols-[112px_minmax(0,1fr)] items-stretch gap-2">
            <div className="relative h-full min-h-[132px] w-[112px] self-center">
              {emotionDonut.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={emotionDonut} dataKey="value" nameKey="name" innerRadius={39} outerRadius={54} paddingAngle={0} stroke="none" animationDuration={800}>
                      {emotionDonut.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center font-sans text-[10px] text-muted-foreground">No P/L data</div>}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-sans text-[9px] text-muted-foreground">Total P/L</span>
                {(() => {
                  const totalPL = scoped.reduce((sum, trade) => sum + trade.profitLoss, 0);
                  return (
                    <span className="font-sans text-[13px] font-bold" style={{ color: totalPL >= 0 ? C.green : C.red }}>
                      {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="flex min-h-0 flex-col justify-between py-0.5">
            {emotionPerf.rows.map(r => (
              <div key={r.name} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="w-[54px] shrink-0 truncate font-sans text-[9px] text-white">{r.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <span className="block h-full rounded-full" style={{ width: `${r.barPct}%`, background: r.pl >= 0 ? r.color : C.red }} />
                </span>
                <span className="w-[48px] shrink-0 text-right font-sans text-[9px] font-semibold" style={{ color: r.pl >= 0 ? C.green : C.red }}>
                  {r.pl >= 0 ? '+' : ''}{r.pl.toFixed(2)}
                </span>
                <span className="w-[25px] shrink-0 text-right font-sans text-[9px]" style={{ color: C.muted }}>{r.pct}%</span>
              </div>
            ))}
            </div>
          </div>
          <div className="mt-3 border-t border-transparent pt-2">
            <div className="h-[10px]" aria-hidden="true" />
            <div className="mt-2 rounded-md border px-2.5 py-2 text-center font-sans text-[10px]" style={{ borderColor: `${C.green}33`, background: `${C.green}0D`, color: C.muted }}>
              Your top performing emotion is{' '}
              <span className="font-semibold" style={{ color: C.green }}>{emotionPerf.top?.name ?? '—'}</span>
            </div>
          </div>
        </SectionCard>

        {/* Top 5 Mistakes — always five ranked rows */}
        <SectionCard title="Top 5 Mistakes" tooltip="Ranked list of your most common logged mistakes." className="min-w-0 p-4">
          <div className="mb-3.5 grid min-h-0 flex-1 grid-rows-5 divide-y divide-[#262626] border-y border-[#262626]">
            {topMistakes.map((m, i) => {
              const pct = scoped.length ? Math.round((m.count / scoped.length) * 100) : 0;
              return (
                <div key={m.name} className="flex min-h-[29px] items-center gap-2.5 px-0.5">
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[#3A3A3A] font-sans text-[9px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-sans text-[10px] text-white">{m.name}</span>
                  <span className="font-sans text-[10px] font-semibold text-red-500">{m.count}</span>
                  <span className="w-[30px] text-right font-sans text-[9px] text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 border-t border-transparent pt-2">
            <div className="h-[10px]" aria-hidden="true" />
            <Link
              to="/mistakes"
              className="mt-2 flex items-center justify-center gap-2 rounded-md border px-4 py-2 font-sans text-[10px] font-semibold transition-colors hover:bg-white/[0.05]"
              style={{ borderColor: `${C.green}40`, color: C.green }}
            >
              View Mistake Analysis <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </SectionCard>

      </div>

      {/* ── COACH TIP FOOTER ── */}
      <section className="flex flex-col items-start gap-3 rounded-[9px] border border-[#262626] bg-black/80 px-5 py-3.5 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${C.yellow}14`, color: C.yellow }}>
            <Lightbulb className="h-4 w-4" />
          </span>
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-white">Coach Tip</span>
        </div>
        <p className="flex-1 font-sans text-[12px] leading-snug" style={{ color: C.muted }}>
          {insights[0] ??
            `Your discipline averages ${stats.avgDiscipline}/5. Trades rated 4+ win ${stats.highDiscWinRate}% of the time — protect that edge by skipping setups when focus drops below 4.`}
        </p>
        <Link
          to="/ai-insights"
          className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-black transition-transform hover:-translate-y-0.5"
          style={{ background: C.green }}
        >
          View Action Plan <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}
