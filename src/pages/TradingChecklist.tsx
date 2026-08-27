import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { format, addDays, subDays, startOfWeek, startOfMonth, differenceInCalendarDays } from 'date-fns';
import {
  ChevronDown, ChevronRight, Plus, Trash2, GripVertical, RotateCcw,
  CheckCircle2, Flame, ListChecks, LayoutGrid, Copy, Sparkles, Calendar as CalendarIcon,
  Settings2, ChevronLeft, ChevronRight as ChevronRightIcon, BookOpen, Sun, Search,
  ClipboardCheck, TrendingUp, Activity, Brain, GraduationCap, Wrench, ListTodo,
  Pencil, Heart, Moon, Target, Quote as QuoteIcon, CheckSquare, Hash, Star, Clock, StickyNote,
  Download, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ---------- Types ----------
type ChecklistItem = { id: string; label: string; done: boolean };
type ChecklistSection = {
  id: string; title: string; description: string; icon: string;
  color: string; items: ChecklistItem[];
};
type Template = {
  id: string; name: string; description?: string | null; sections: ChecklistSection[];
};

const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- Icons + palette ----------
const ICONS: Record<string, any> = {
  Sun, TrendingUp, Target, GraduationCap, Heart, Moon, Star, Brain, Activity, Wrench,
  ClipboardCheck, BookOpen, ListTodo, Sparkles,
};
const ICON_KEYS = Object.keys(ICONS);

// Per-section vivid tokens (matches reference gradient palette)
type Palette = { key: string; from: string; to: string; ring: string; dot: string; soft: string };
const PALETTES: Palette[] = [
  { key: 'violet',  from: '#8B5CF6', to: '#7C3AED', ring: 'stroke-[#8B5CF6]', dot: 'bg-[#8B5CF6]', soft: 'from-[#8B5CF6]/25 to-[#7C3AED]/5' },
  { key: 'blue',    from: '#3B82F6', to: '#2563EB', ring: 'stroke-[#3B82F6]', dot: 'bg-[#3B82F6]', soft: 'from-[#3B82F6]/25 to-[#2563EB]/5' },
  { key: 'emerald', from: '#10B981', to: '#059669', ring: 'stroke-[#10B981]', dot: 'bg-[#10B981]', soft: 'from-[#10B981]/25 to-[#059669]/5' },
  { key: 'amber',   from: '#F59E0B', to: '#D97706', ring: 'stroke-[#F59E0B]', dot: 'bg-[#F59E0B]', soft: 'from-[#F59E0B]/25 to-[#D97706]/5' },
  { key: 'rose',    from: '#EC4899', to: '#DB2777', ring: 'stroke-[#EC4899]', dot: 'bg-[#EC4899]', soft: 'from-[#EC4899]/25 to-[#DB2777]/5' },
  { key: 'indigo',  from: '#8B5CF6', to: '#6366F1', ring: 'stroke-[#8B5CF6]', dot: 'bg-[#8B5CF6]', soft: 'from-[#8B5CF6]/25 to-[#6366F1]/5' },
  { key: 'teal',    from: '#14B8A6', to: '#0D9488', ring: 'stroke-[#14B8A6]', dot: 'bg-[#14B8A6]', soft: 'from-[#14B8A6]/25 to-[#0D9488]/5' },
];
const paletteFor = (key: string) => PALETTES.find(p => p.key === key) ?? PALETTES[0];

const DEFAULT_SECTIONS: () => ChecklistSection[] = () => [
  { id: uid(), title: 'Morning Routine', description: 'Start your day with intention', icon: 'Sun', color: 'violet',
    items: ['Wake up before 6:00 AM','Drink 500ml water','Meditation','Read 10 pages','Exercise / Workout'].map(l => ({ id: uid(), label: l, done: false })) },
  { id: uid(), title: 'Market Preparation', description: 'Analyze the market. Plan ahead.', icon: 'TrendingUp', color: 'blue',
    items: ['Economic calendar checked','High impact news reviewed','Weekly bias reviewed','Daily bias confirmed','Watchlist updated','Alerts placed','Trading levels marked'].map(l => ({ id: uid(), label: l, done: false })) },
  { id: uid(), title: 'Daily Planning', description: 'Focus on what matters.', icon: 'Target', color: 'emerald',
    items: ['Top 3 goals written','Trading session selected','Daily objectives written','Break schedule planned'].map(l => ({ id: uid(), label: l, done: false })) },
  { id: uid(), title: 'Learning & Improvement', description: 'Never stop learning.', icon: 'GraduationCap', color: 'amber',
    items: ['Review previous trades','Study one trading concept','Reading trading book / article','Watch educational video','Update notebook if needed'].map(l => ({ id: uid(), label: l, done: false })) },
  { id: uid(), title: 'Health & Lifestyle', description: 'A healthy body. A sharp mind.', icon: 'Heart', color: 'rose',
    items: ['Drink 2L water','Exercise completed','Healthy meals','Stretching','7-8 hours sleep','No junk food','Vitamins / Supplements'].map(l => ({ id: uid(), label: l, done: false })) },
  { id: uid(), title: 'End of Day Review', description: 'Reflect. Learn. Improve.', icon: 'Moon', color: 'indigo',
    items: ['Journal completed','Screenshots uploaded','Tomorrow\'s watchlist prepared','Lessons learned written','Desk organized / Shutdown'].map(l => ({ id: uid(), label: l, done: false })) },
  { id: uid(), title: 'Personal Development', description: 'Become 1% better every day', icon: 'Star', color: 'teal',
    items: ['Read 10 pages','Practice gratitude','Family time','No unnecessary screen time','Sleep before 11 PM','Learn something new'].map(l => ({ id: uid(), label: l, done: false })) },
];

// ---------- Progress Ring (single clean arc, no decorative concentric guides) ----------
function ProgressRing({ value, size = 96, stroke = 8, gradientId = 'ringGrad', label, sublabel, gradient = ['#8B5CF6','#6366F1','#3B82F6'] }: {
  value: number; size?: number; stroke?: number; gradientId?: string; label?: string; sublabel?: string; gradient?: string[];
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible" shapeRendering="geometricPrecision">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {gradient.map((cc, i) => (
              <stop key={i} offset={`${(i / (gradient.length - 1)) * 100}%`} stopColor={cc} />
            ))}
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={Math.max(1.2, stroke * 0.32)} result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#FFFFFF" strokeOpacity={0.06} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke={`url(#${gradientId})`} strokeWidth={stroke} strokeLinecap="round" fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          filter={`url(#${gradientId}-glow)`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-bold text-white leading-none tracking-[-0.02em]" style={{ fontSize: size * 0.26 }}>
          {Math.round(pct)}%
        </span>
        {label && <span className="text-[9.5px] uppercase tracking-[0.14em] text-white/45 mt-1.5">{label}</span>}
        {sublabel && <span className="text-[9px] text-white/35">{sublabel}</span>}
      </div>
    </div>
  );
}

// ---------- Small ring for section header ----------
function MiniRing({ value, color, size = 40, stroke = 4 }: { value: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" shapeRendering="geometricPrecision">
        <circle cx={size/2} cy={size/2} r={r} stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none"
          strokeDasharray={`${dash} ${c - dash}`} style={{ transition: 'stroke-dasharray 500ms cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 0 3px ${color}66)` }} />
      </svg>
      <span className="absolute text-[9.5px] font-semibold text-white tabular-nums">{Math.round(pct)}%</span>
    </div>
  );
}

// ---------- Progress Overview: exactly two circular systems ----------
function MultiRingProgress({
  overallPct,
  rings,
  size = 160,
}: {
  overallPct: number;
  rings: { color: string; pct: number }[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerStroke = 17;
  const innerStroke = 17;
  const ringGap = 9;
  const outerR = size / 2 - outerStroke / 2 - 4;
  const innerR = outerR - outerStroke / 2 - ringGap - innerStroke / 2;
  const outerC = 2 * Math.PI * outerR;
  const innerC = 2 * Math.PI * innerR;
  const pct = Math.max(0, Math.min(100, overallPct));
  const outerDash = (pct / 100) * outerC;
  const segmentCount = Math.max(rings.length, 1);
  const segmentSpan = innerC / segmentCount;
  const segmentGap = 4;
  const segmentLength = Math.max(0, segmentSpan - segmentGap);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible" shapeRendering="geometricPrecision">
        <defs>
          <linearGradient id="mrp-outer" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="45%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <filter id="mrp-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Ring 1: overall progress only */}
        <circle cx={cx} cy={cy} r={outerR} stroke="#11141D" strokeOpacity={0.82} strokeWidth={outerStroke} fill="none" />
        <circle
          cx={cx} cy={cy} r={outerR}
          stroke="url(#mrp-outer)" strokeWidth={outerStroke} strokeLinecap="round" fill="none"
          strokeDasharray={`${outerDash} ${outerC - outerDash}`}
          filter="url(#mrp-glow)"
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />

        {/* Ring 2: one shared section ring, split into 7 colored progress segments */}
        <circle cx={cx} cy={cy} r={innerR} stroke="#11141D" strokeOpacity={0.82} strokeWidth={innerStroke} fill="none" />
        {rings.map((ring, i) => {
          const sectionPct = Math.max(0, Math.min(100, ring.pct));
          const d = (sectionPct / 100) * segmentLength;
          if (d <= 0) return null;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={innerR}
              stroke={ring.color}
              strokeWidth={innerStroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${d} ${innerC - d}`}
              strokeDashoffset={-(i * segmentSpan + segmentGap / 2)}
              style={{
                transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)',
                filter: `drop-shadow(0 0 3px ${ring.color}90)`,
              }}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-heading font-bold text-white leading-none tracking-[-0.03em]"
          style={{ fontSize: 29 }}
        >
          {Math.round(pct)}%
        </span>
        <span className="text-[9px] uppercase tracking-[0.16em] text-white/50 mt-1">Overall</span>
      </div>
    </div>
  );
}

// ---------- KPI Card (Phase 2 polish: shorter, softer, glass icons) ----------
function KpiCard({ icon: Icon, label, value, sub, tint, trend, ring }: {
  icon: any; label: string; value: string | number; sub?: string; tint: 'violet'|'blue'|'emerald'|'amber'; trend?: string;
  ring?: { pct: number; gradient?: string[] };
}) {
  const tintMap: Record<string,{wash:string; iconBg:string; accent:string; glow:string}> = {
    violet:  { wash:'radial-gradient(130% 130% at 100% 0%, rgba(139,92,246,0.22), transparent 60%)', iconBg:'linear-gradient(135deg,#9D6BFF,#6D28D9)', accent:'#A78BFA', glow:'hover:shadow-[0_22px_48px_-18px_rgba(139,92,246,0.45)]' },
    blue:    { wash:'radial-gradient(130% 130% at 100% 0%, rgba(59,130,246,0.22), transparent 60%)',  iconBg:'linear-gradient(135deg,#4C93FF,#1D4ED8)', accent:'#60A5FA', glow:'hover:shadow-[0_22px_48px_-18px_rgba(59,130,246,0.45)]' },
    emerald: { wash:'radial-gradient(130% 130% at 100% 0%, rgba(16,185,129,0.22), transparent 60%)',  iconBg:'linear-gradient(135deg,#22C58A,#047857)', accent:'#34D399', glow:'hover:shadow-[0_22px_48px_-18px_rgba(16,185,129,0.45)]' },
    amber:   { wash:'radial-gradient(130% 130% at 100% 0%, rgba(245,158,11,0.22), transparent 60%)',  iconBg:'linear-gradient(135deg,#FBB040,#B45309)', accent:'#FBBF24', glow:'hover:shadow-[0_22px_48px_-18px_rgba(245,158,11,0.45)]' },
  };
  const t = tintMap[tint];
  const valueStr = String(value);
  // Auto-shrink value so it never clips even in a narrow column
  const valueFontPx = valueStr.length > 10 ? 18 : valueStr.length > 7 ? 22 : valueStr.length > 4 ? 26 : 28;
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[16px] border border-white/[0.04] px-3 py-3.5',
        'shadow-[0_18px_44px_-20px_rgba(0,0,0,0.9)] transition-all duration-200 ease-out hover:-translate-y-[2px] hover:border-white/[0.08]',
        t.glow,
      )}
      style={{ minHeight: 128, background: '#121212' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: t.wash }} />
      <div className="absolute inset-x-0 top-0 h-[55%] pointer-events-none"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.035), transparent 60%)' }} />
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.accent}30, transparent)` }} />
      <div className="relative flex items-center gap-2.5 h-full">
        <div className="shrink-0">
          {ring ? (
            <ProgressRing
              value={ring.pct}
              size={54}
              stroke={6}
              gradientId={`kpi-${tint}`}
              gradient={ring.gradient ?? ['#8B5CF6', '#6366F1', '#3B82F6']}
            />
          ) : (
            <div
              className="h-[40px] w-[40px] rounded-[11px] flex items-center justify-center relative overflow-hidden"
              style={{
                background: t.iconBg,
                boxShadow: `0 8px 22px -6px ${t.accent}80, 0 0 0 1px rgba(255,255,255,0.06) inset, inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.22)`,
              }}
            >
              <span className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent)' }} />
              <Icon className="h-[18px] w-[18px] text-white relative" strokeWidth={2.3} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4)) drop-shadow(0 0 6px rgba(255,255,255,0.18))' }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#8A93A6] break-words leading-tight" title={label}>{label}</p>
          <p className="font-heading font-bold leading-none text-white tabular-nums tracking-[-0.02em] mt-1 break-words" style={{ fontSize: valueFontPx }} title={valueStr}>{value}</p>
          {sub && <p className="text-[10.5px] text-[#6B7385] mt-1 break-words leading-tight" title={sub}>{sub}</p>}
          {trend && (
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#34D399]">
              <span className="inline-block h-1 w-1 rounded-full bg-[#34D399] shadow-[0_0_6px_#34D399] shrink-0" />
              <span className="break-words">{trend}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}



// ---------- Helpers ----------
function computeSectionPct(s: ChecklistSection) {
  if (!s.items.length) return 0;
  return (s.items.filter(i => i.done).length / s.items.length) * 100;
}
function computeOverall(sections: ChecklistSection[]) {
  const total = sections.reduce((a, s) => a + s.items.length, 0);
  const done = sections.reduce((a, s) => a + s.items.filter(i => i.done).length, 0);
  return { total, done, pct: total ? (done / total) * 100 : 0, sectionsDone: sections.filter(s => s.items.length && s.items.every(i => i.done)).length };
}
const dateKey = (d: Date) => format(d, 'yyyy-MM-dd');

const QUOTES = [
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'The market rewards patience and punishes greed.', author: 'Trading Wisdom' },
  { text: 'Plan the trade. Trade the plan.', author: 'Anonymous' },
  { text: 'Amateurs think about how much they can make. Professionals think about how much they can lose.', author: 'Jack Schwager' },
];

// ---------- Page ----------
export default function TradingChecklist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [tab, setTab] = useState<'checklist'|'templates'|'analytics'|'history'>('checklist');
  const [saving, setSaving] = useState(false);
  const key = dateKey(date);

  const { data: row } = useQuery({
    queryKey: ['trading_checklists', user?.id, key],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('trading_checklists' as any)
        .select('*').eq('user_id', user!.id).eq('date', key).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['trading_checklists_history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('trading_checklists' as any)
        .select('date, sections').eq('user_id', user!.id)
        .order('date', { ascending: false }).limit(180);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['trading_checklist_templates', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('trading_checklist_templates' as any)
        .select('*').eq('user_id', user!.id).order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const hydratedKeyRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const inflightRef = useRef(false);

  // Reset hydration marker whenever the target date changes.
  useEffect(() => {
    hydratedKeyRef.current = null;
    dirtyRef.current = false;
    setHydrated(false);
  }, [key, user?.id]);

  // Hydrate local state from the server exactly once per date, and never
  // clobber a pending local edit with a stale realtime refetch.
  useEffect(() => {
    if (!user) return;
    if (hydratedKeyRef.current === key) return; // already hydrated for this date
    if (row === undefined) return; // query still loading
    if (dirtyRef.current || inflightRef.current) return; // don't overwrite unsaved edits
    setSections(row?.sections ? (row.sections as ChecklistSection[]) : DEFAULT_SECTIONS());
    hydratedKeyRef.current = key;
    const t = setTimeout(() => setHydrated(true), 50);
    return () => clearTimeout(t);
  }, [row, user, key]);

  const persist = useCallback(async (next: ChecklistSection[]) => {
    if (!user) return;
    inflightRef.current = true;
    setSaving(true);
    try {
      const { error } = await supabase.from('trading_checklists' as any).upsert({
        user_id: user.id, date: key, sections: next as any,
      }, { onConflict: 'user_id,date' });
      if (error) throw error;
      dirtyRef.current = false;
      qc.invalidateQueries({ queryKey: ['trading_checklists_history', user.id] });
    } catch (e: any) {
      toast.error('Save failed', { description: e?.message ?? String(e) });
    } finally {
      inflightRef.current = false;
      setSaving(false);
    }
  }, [user, key, qc]);

  useEffect(() => {
    if (!user || !hydrated) return;
    dirtyRef.current = true;
    const t = setTimeout(() => persist(sections), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, hydrated]);

  useEffect(() => {
    const handler = (e: any) => {
      const d = e?.detail; if (!d) return;
      if (d.table === 'trading_checklists') {
        qc.invalidateQueries({ queryKey: ['trading_checklists', user?.id, key] });
        qc.invalidateQueries({ queryKey: ['trading_checklists_history', user?.id] });
      }
      if (d.table === 'trading_checklist_templates') {
        qc.invalidateQueries({ queryKey: ['trading_checklist_templates', user?.id] });
      }
    };
    window.addEventListener('mj:realtime', handler);
    return () => window.removeEventListener('mj:realtime', handler);
  }, [qc, user, key]);

  const overall = useMemo(() => computeOverall(sections), [sections]);

  const streak = useMemo(() => {
    let d = new Date();
    let count = 0;
    const map = new Map<string, any[]>();
    history.forEach((h) => map.set(h.date, h.sections || []));
    while (true) {
      const k = dateKey(d);
      const secs = map.get(k) as ChecklistSection[] | undefined;
      if (!secs || !secs.length) break;
      const { pct } = computeOverall(secs);
      if (pct < 100) break;
      count++;
      d = subDays(d, 1);
    }
    return count;
  }, [history]);

  const longestStreak = useMemo(() => {
    if (!history.length) return 0;
    const days = new Set(history.filter(h => computeOverall(h.sections || []).pct === 100).map(h => h.date));
    if (!days.size) return 0;
    const sorted = Array.from(days).sort();
    let best = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = differenceInCalendarDays(new Date(sorted[i]), new Date(sorted[i - 1]));
      if (diff === 1) { cur++; best = Math.max(best, cur); } else cur = 1;
    }
    return best;
  }, [history]);

  const weekPct = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const entries = history.filter(h => new Date(h.date) >= start);
    if (!entries.length) return 0;
    return entries.reduce((a, h) => a + computeOverall(h.sections || []).pct, 0) / entries.length;
  }, [history]);

  const monthPct = useMemo(() => {
    const start = startOfMonth(new Date());
    const entries = history.filter(h => new Date(h.date) >= start);
    if (!entries.length) return 0;
    return entries.reduce((a, h) => a + computeOverall(h.sections || []).pct, 0) / entries.length;
  }, [history]);

  // Yesterday's overall for trend
  const yesterdayPct = useMemo(() => {
    const yk = dateKey(subDays(new Date(), 1));
    const y = history.find(h => h.date === yk);
    return y ? computeOverall(y.sections || []).pct : 0;
  }, [history]);
  const trendVsY = Math.round(overall.pct - yesterdayPct);

  // ---- Mutations ----
  const toggleItem = (sid: string, iid: string) => {
    setSections(prev => prev.map(s => s.id !== sid ? s : {
      ...s, items: s.items.map(i => i.id === iid ? { ...i, done: !i.done } : i),
    }));
  };
  const addItem = (sid: string, label: string) => {
    const l = label.trim(); if (!l) return;
    setSections(prev => prev.map(s => s.id !== sid ? s : { ...s, items: [...s.items, { id: uid(), label: l, done: false }] }));
  };
  const removeItem = (sid: string, iid: string) => {
    setSections(prev => prev.map(s => s.id !== sid ? s : { ...s, items: s.items.filter(i => i.id !== iid) }));
  };
  const renameItem = (sid: string, iid: string, label: string) => {
    setSections(prev => prev.map(s => s.id !== sid ? s : { ...s, items: s.items.map(i => i.id === iid ? { ...i, label } : i) }));
  };
  const addSection = () => {
    const nextColor = PALETTES[(sections.length) % PALETTES.length].key;
    setSections(prev => [...prev, { id: uid(), title: 'New Section', description: '', icon: 'ListTodo', color: nextColor, items: [] }]);
  };
  const removeSection = (sid: string) => setSections(prev => prev.filter(s => s.id !== sid));
  const renameSection = (sid: string, title: string) => setSections(prev => prev.map(s => s.id === sid ? { ...s, title } : s));
  const setSectionDesc = (sid: string, description: string) => setSections(prev => prev.map(s => s.id === sid ? { ...s, description } : s));
  const setSectionIcon = (sid: string, icon: string) => setSections(prev => prev.map(s => s.id === sid ? { ...s, icon } : s));
  const setSectionColor = (sid: string, color: string) => setSections(prev => prev.map(s => s.id === sid ? { ...s, color } : s));
  const moveSection = (sid: string, dir: -1 | 1) => {
    setSections(prev => {
      const i = prev.findIndex(s => s.id === sid); if (i < 0) return prev;
      const j = i + dir; if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice(); [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  };

  const resetToday = () => setSections(prev => prev.map(s => ({ ...s, items: s.items.map(i => ({ ...i, done: false })) })));
  const completeAll = () => setSections(prev => prev.map(s => ({ ...s, items: s.items.map(i => ({ ...i, done: true })) })));

  const applyTemplate = (t: Template) => {
    const cloned: ChecklistSection[] = t.sections.map(s => ({
      ...s, id: uid(),
      items: s.items.map(i => ({ id: uid(), label: i.label, done: false })),
    }));
    setSections(cloned);
    toast.success(`Applied "${t.name}"`);
    setTemplatesOpen(false);
  };
  const saveAsTemplate = async (name: string) => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from('trading_checklist_templates' as any).insert({
      user_id: user.id, name: name.trim(), sections: sections as any,
    });
    if (error) return toast.error('Failed to save template', { description: error.message });
    toast.success('Template saved');
    qc.invalidateQueries({ queryKey: ['trading_checklist_templates', user.id] });
  };
  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('trading_checklist_templates' as any).delete().eq('id', id);
    if (error) return toast.error('Failed to delete', { description: error.message });
    qc.invalidateQueries({ queryKey: ['trading_checklist_templates', user!.id] });
  };
  const duplicateTemplate = async (t: any) => {
    if (!user) return;
    const { error } = await supabase.from('trading_checklist_templates' as any).insert({
      user_id: user.id, name: `${t.name} Copy`, sections: t.sections,
    });
    if (error) return toast.error('Failed to duplicate', { description: error.message });
    qc.invalidateQueries({ queryKey: ['trading_checklist_templates', user.id] });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(sections, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `checklist-${key}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  return (
    <div className="relative min-h-full bg-black [&_h1]:!normal-case [&_h2]:!normal-case [&_h3]:!normal-case [&_h4]:!normal-case">
      <div className="relative px-10 pt-10 pb-10 max-w-[1440px] mx-auto">

      {/* ============ HEADER ============ */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-7">
        <div className="flex items-start gap-3">
          <div
            className="h-[38px] w-[38px] rounded-[11px] flex items-center justify-center shrink-0 mt-[3px] relative"
            style={{
              background: 'linear-gradient(135deg, #A855F7, #6366F1)',
              boxShadow: '0 4px 14px -2px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
            }}
          >
            <CheckSquare className="h-[19px] w-[19px] text-white" strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="font-heading font-semibold text-white" style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.025em' }}>
              Daily Checklist
            </h1>
            <p className="mt-1 text-[12.5px] font-normal text-[#5C6472]" style={{ lineHeight: 1.4 }}>
              Build habits. Stay consistent. Master your routine.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded-[9px] border border-white/[0.05] bg-[#080808] px-2" style={{ height: 36 }}>
            <CalendarIcon className="h-[14px] w-[14px] text-[#5C6472] ml-1" />
            <Popover>
              <PopoverTrigger asChild>
                <button className="px-1.5 text-[12.5px] font-medium text-white/95 hover:text-white transition">
                  {format(date, 'd MMMM yyyy')}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
            <button onClick={() => setDate(subDays(date, 1))} className="h-[26px] w-[26px] rounded-md flex items-center justify-center text-[#5C6472] hover:text-white hover:bg-white/[0.04] transition">
              <ChevronLeft className="h-[14px] w-[14px]" />
            </button>
            <button onClick={() => setDate(addDays(date, 1))} className="h-[26px] w-[26px] rounded-md flex items-center justify-center text-[#5C6472] hover:text-white hover:bg-white/[0.04] transition">
              <ChevronRightIcon className="h-[14px] w-[14px]" />
            </button>
          </div>
          <button
            onClick={() => setDate(new Date())}
            className="px-3.5 rounded-[9px] border border-white/[0.05] bg-[#080808] hover:bg-[#0F0F0F] hover:border-white/[0.1] text-white/95 text-[12.5px] font-medium transition-all"
            style={{ height: 36 }}
          >
            Today
          </button>
          <button
            onClick={() => setCustomizeOpen(true)}
            className="px-3.5 rounded-[9px] border border-white/[0.05] bg-[#080808] hover:bg-[#0F0F0F] hover:border-white/[0.1] text-white/95 text-[12.5px] font-medium flex items-center gap-1.5 transition-all"
            style={{ height: 36 }}
          >
            <Settings2 className="h-[14px] w-[14px]" /> Customize
          </button>
        </div>
      </div>

      {/* ============ MAIN GRID (tabs sit inside left col so sidebar aligns) ============ */}
      <div className="grid grid-cols-1 gap-6" style={{ gridTemplateColumns: 'minmax(0,1fr) 360px' }}>
        {/* -------- LEFT COLUMN -------- */}
        <div>
          {/* Tabs + New Section */}
          <div className="flex items-center justify-between border-b border-white/[0.05] mb-6">
            <div className="flex items-center gap-7">
              {(['checklist','templates','analytics','history'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'relative text-[13px] font-medium capitalize transition-colors flex items-center',
                    tab === t ? 'text-white' : 'text-[#5C6472] hover:text-white/80'
                  )}
                  style={{ height: 40 }}
                >
                  {t === 'checklist' ? 'My Checklist' : t}
                  {tab === t && (
                    <span
                      className="absolute left-0 right-0 -bottom-px h-[1.5px]"
                      style={{ background: '#8B5CF6', boxShadow: '0 0 8px rgba(139,92,246,0.5)' }}
                    />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={addSection}
              className="px-3.5 rounded-[9px] text-white text-[12.5px] font-medium flex items-center gap-1.5 transition-all hover:brightness-110"
              style={{
                height: 36,
                background: 'linear-gradient(135deg, #A855F7, #6366F1)',
                boxShadow: '0 4px 14px -2px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              <Plus className="h-[14px] w-[14px]" /> New Section
            </button>
          </div>

          {tab === 'checklist' && (<>
          {/* KPI grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
            <KpiCard
              icon={ListChecks}
              label="Overall Progress"
              value={`${overall.done} / ${overall.total}`}
              sub="Tasks Completed"
              tint="violet"
              trend={trendVsY > 0 ? `${trendVsY}% vs yesterday` : undefined}
              ring={{ pct: overall.pct, gradient: ['#8B5CF6', '#6366F1', '#3B82F6'] }}
            />
            <KpiCard icon={LayoutGrid} label="Sections" value={sections.length} sub="Active Sections" tint="blue" />
            <KpiCard icon={CheckCircle2} label="Completed" value={overall.done} sub="Tasks Done" tint="emerald" />
            <KpiCard icon={Flame} label="Current Streak" value={`${streak}`} sub={streak ? 'Days · Keep it up!' : 'Start today'} tint="amber" />
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {sections.map((s, idx) => {
              const pct = computeSectionPct(s);
              const isCollapsed = !!collapsed[s.id];
              const Icon = ICONS[s.icon] ?? ListTodo;
              const p = paletteFor(s.color);
              return (
                <div
                  key={s.id}
                  className={cn(
                    'group relative rounded-[16px] border border-white/[0.04] overflow-hidden',
                    'shadow-[0_16px_44px_-18px_rgba(0,0,0,0.75)] transition-all duration-200 ease-out',
                    'hover:-translate-y-[1px] hover:border-white/[0.07]'
                  )}
                  style={{ background: '#121212' }}

                >
                  {/* Ambient tint wash */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-60"
                    style={{ background: `radial-gradient(70% 100% at 0% 0%, ${p.from}14, transparent 55%)` }}
                  />
                  {/* Top hairline */}
                  <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${p.from}33, transparent)` }} />
                  {/* Left accent bar — glow concentrated in top 25-30%, fades to near-black */}
                  <div
                    className="pointer-events-none absolute top-2.5 bottom-2.5 left-2.5 w-[2.5px] rounded-full"
                    style={{ background: `linear-gradient(180deg, ${p.from} 0%, ${p.from}B3 15%, ${p.to}40 35%, ${p.to}0D 60%, rgba(0,0,0,0) 100%)` }}
                  />
                  {/* Accent glow — bloom only near icon area */}
                  <div
                    className="pointer-events-none absolute top-0 left-0 w-[26px] h-[80px] rounded-full blur-[14px] opacity-80"
                    style={{ background: `radial-gradient(55% 55% at 25% 18%, ${p.from}, transparent 72%)` }}
                  />

                  {/* header — tighter */}
                  <div className="relative flex items-center gap-3 px-5 pl-6 py-3.5">
                    <GripVertical className="h-3.5 w-3.5 text-white/15 shrink-0 cursor-grab" />
                    <div
                      className="h-[42px] w-[42px] rounded-[12px] flex items-center justify-center shrink-0 relative overflow-hidden"
                      style={{
                        background: `linear-gradient(160deg, ${p.from} 0%, ${p.from} 40%, ${p.to} 100%)`,
                        boxShadow: `0 10px 22px -8px ${p.from}90, 0 0 0 1px rgba(255,255,255,0.06) inset, inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.22)`,
                      }}
                    >
                      <span className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent)' }} />
                      <Icon className="h-[19px] w-[19px] text-white relative" strokeWidth={2.4} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.35)) drop-shadow(0 0 6px rgba(255,255,255,0.18))' }} />
                    </div>
                    <button onClick={() => setCollapsed(c => ({ ...c, [s.id]: !c[s.id] }))} className="min-w-0 flex-1 text-left">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-heading font-semibold text-[13px] text-white/30 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                        <h3 className="font-heading font-semibold text-[16px] text-white truncate tracking-[-0.015em] leading-tight">{s.title}</h3>
                      </div>
                      {s.description && <p className="text-[11.5px] text-[#6A7288] mt-0.5 truncate leading-tight">{s.description}</p>}
                    </button>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <MiniRing value={pct} color={p.from} size={38} stroke={4} />
                      <span className="text-[12px] text-white/65 font-mono tabular-nums w-10 text-right">
                        {s.items.filter(i => i.done).length}/{s.items.length}
                      </span>
                      <button
                        onClick={() => setCollapsed(c => ({ ...c, [s.id]: !c[s.id] }))}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-white/45 hover:text-white hover:bg-white/[0.04] transition"
                      >
                        {isCollapsed ? <ChevronRight className="h-[14px] w-[14px]" /> : <ChevronDown className="h-[14px] w-[14px]" />}
                      </button>
                      <button
                        onClick={() => setCustomizeOpen(true)}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-white/45 hover:text-white hover:bg-white/[0.04] transition"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* items */}
                  {!isCollapsed && (
                    <div className="relative px-5 pb-3.5 pl-6 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {s.items.map((i) => (
                          <div
                            key={i.id}
                            onClick={() => toggleItem(s.id, i.id)}
                            className={cn(
                              'group/item flex items-center gap-3 px-3 rounded-[9px] border transition-all cursor-pointer',
                              i.done
                                ? 'border-white/[0.03] bg-white/[0.015]'
                                : 'border-white/[0.04] bg-[#121212] hover:bg-[#171717] hover:border-white/[0.08]'
                            )}
                            style={{ height: 38 }}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleItem(s.id, i.id); }}
                              className={cn(
                                'h-[18px] w-[18px] rounded-[5px] border-2 flex items-center justify-center shrink-0 transition-all self-center',
                                i.done ? 'border-transparent' : 'border-white/25 hover:border-white/50'
                              )}
                              style={i.done
                                ? { background: `linear-gradient(135deg, ${p.from}, ${p.to})`, boxShadow: `0 0 8px ${p.from}55` }
                                : undefined}
                            >
                              {i.done && (
                                <svg viewBox="0 0 20 20" fill="none" className="h-[11px] w-[11px] text-white">
                                  <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                            <span className={cn('text-[12.5px] flex-1 truncate', i.done ? 'line-through text-white/30' : 'text-white/88')}>
                              {i.label}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeItem(s.id, i.id); }}
                              className="opacity-0 group-hover/item:opacity-100 text-white/30 hover:text-red-400 transition"
                              aria-label="Remove item"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <AddItemInline onAdd={(l) => addItem(s.id, l)} color={p.from} />
                    </div>
                  )}
                </div>
              );
            })}


            <button
              onClick={addSection}
              className="w-full flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#8B5CF6]/35 bg-transparent text-[13px] font-medium text-[#A78BFA] hover:text-white hover:bg-[#8B5CF6]/10 hover:border-[#8B5CF6]/55 transition"
              style={{ height: 42 }}
            >
              <Plus className="h-3.5 w-3.5" /> Add New Section
            </button>
          </div>
          </>)}
        </div>

        {/* -------- RIGHT SIDEBAR -------- */}
        {tab === 'checklist' && (
        <aside className="space-y-4">

          {/* Progress Overview */}
          <SidePanel title="Progress Overview">
            {saving && <span className="absolute right-4 top-4 text-[10px] text-white/40 animate-pulse">Saving…</span>}
            <div className="relative flex items-center justify-center py-1.5 rounded-[12px]" style={{ background: 'rgba(0,0,0,0.35)' }}>
              <MultiRingProgress
                overallPct={overall.pct}
                rings={sections.map(s => ({ color: paletteFor(s.color).from, pct: computeSectionPct(s) }))}
                size={160}
              />
            </div>
            <div
              className="mt-3 rounded-[10px] px-2.5 py-2 grid gap-y-1.5 items-center"
              style={{ background: 'rgba(0,0,0,0.30)', gridTemplateColumns: 'auto minmax(0,1fr) auto auto', columnGap: 10 }}
            >
              {sections.map((s) => {
                const pct = computeSectionPct(s);
                const p = paletteFor(s.color);
                const done = s.items.filter(i => i.done).length;
                return (
                  <div key={s.id} className="contents text-[12px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.from, boxShadow: `0 0 6px ${p.from}AA` }} />
                    <span className="truncate text-white/80">{s.title}</span>
                    <span className="text-white/60 font-mono tabular-nums text-right">{Math.round(pct)}%</span>
                    <span className="text-white/35 font-mono tabular-nums text-right tracking-tight">{done}/{s.items.length}</span>
                  </div>
                );
              })}
            </div>
          </SidePanel>


          {/* Streak Tracker */}
          <SidePanel title="Streak Tracker">
            <div className="space-y-0.5">
              <StreakRow icon={ClipboardCheck} label="Checklist Streak" value={`${streak} Days`} color="#F59E0B" />
              <StreakRow icon={BookOpen}       label="Journal Streak"   value={`${Math.max(streak, longestStreak - 4)} Days`} color="#10B981" />
              <StreakRow icon={TrendingUp}     label="Trading Plan Streak" value={`${Math.max(1, streak - 3)} Days`} color="#3B82F6" />
              <StreakRow icon={Activity}       label="Workout Streak"   value={`${Math.max(1, streak - 4)} Days`} color="#EC4899" />
              <StreakRow icon={BookOpen}       label="Reading Streak"   value={`${Math.max(1, streak - 5)} Days`} color="#8B5CF6" />
              <StreakRow icon={Brain}          label="Meditation Streak" value={`${Math.max(1, streak - 6)} Days`} color="#14B8A6" />
            </div>
          </SidePanel>

          {/* Today's Stats — 2x2 grid */}
          <SidePanel title="Today's Stats">
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat icon={CheckCircle2} label="Completed"  value={overall.done} tint="#10B981" />
              <MiniStat icon={ListTodo}     label="Remaining"  value={overall.total - overall.done} tint="#3B82F6" />
              <MiniStat icon={Clock}        label="Avg Time"   value="2h 15m" tint="#F59E0B" />
              <MiniStat icon={Flame}        label="Best Streak" value={`${longestStreak} Days`} tint="#EC4899" />
            </div>
          </SidePanel>

          {/* Quote Card */}
          <div className="relative overflow-hidden rounded-[16px] border border-white/[0.04] p-4 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.7)]" style={{ background: '#121212' }}>
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.10]"
              style={{ background: 'radial-gradient(120% 100% at 100% 0%, #8B5CF6 0%, transparent 45%), radial-gradient(120% 100% at 0% 100%, #EC4899 0%, transparent 45%)' }}
            />
            <QuoteIcon className="absolute right-3 bottom-3 h-8 w-8 text-white/[0.08]" strokeWidth={1.5} />
            <p className="relative text-[12.5px] italic text-white/88 leading-relaxed pr-6">"{quote.text}"</p>
            <p className="relative mt-2.5 text-[10.5px] text-white/45">— {quote.author}</p>
          </div>

          {/* Item Types */}
          <SidePanel title="Item Types">
            <div className="grid grid-cols-2 gap-2">
              <TypeChip icon={CheckSquare} label="Checkbox" color="#3B82F6" />
              <TypeChip icon={Hash} label="Number" color="#10B981" />
              <TypeChip icon={Star} label="Rating" color="#F59E0B" />
              <TypeChip icon={Heart} label="Mood" color="#EC4899" />
              <TypeChip icon={Clock} label="Time" color="#8B5CF6" />
              <TypeChip icon={StickyNote} label="Note" color="#14B8A6" />
            </div>
          </SidePanel>

          {/* Templates */}
          <SidePanel title="Templates" action={<button onClick={() => setTemplatesOpen(true)} className="text-[11px] text-[#A78BFA] hover:underline">View all</button>}>
            <div className="space-y-1.5">
              {(templates as any[]).slice(0,4).map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="w-full flex items-center gap-2.5 px-3 rounded-[9px] bg-[#121212] hover:bg-[#171717] border border-white/[0.03] hover:border-white/[0.07] transition text-left"
                  style={{ height: 34 }}
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#A78BFA] shrink-0" />
                  <span className="text-[12px] flex-1 truncate text-white/85">{t.name}</span>
                  <span className="text-[10.5px] text-[#A78BFA]">Use</span>
                </button>
              ))}
              {!templates.length && <p className="text-[11px] text-white/40 py-1">No templates yet.</p>}
            </div>
          </SidePanel>

          {/* Quick Actions */}
          <SidePanel title="Quick Actions">
            <div className="space-y-1.5">
              <ActionBtn icon={Upload} label="Import from Template" onClick={() => setTemplatesOpen(true)} />
              <ActionBtn icon={Download} label="Export Checklist" onClick={exportJson} />
              <ActionBtn icon={CheckCircle2} label="Complete All" onClick={completeAll} />
              <ActionBtn icon={RotateCcw} label="Reset Today's Progress" onClick={resetToday} />
            </div>
          </SidePanel>
        </aside>
        )}

      </div>



      {tab === 'templates' && (
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-sm">Templates</h3>
            <Button size="sm" onClick={() => setTemplatesOpen(true)}>Manage Templates</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(templates as any[]).map(t => (
              <div key={t.id} className="rounded-lg border border-border/60 bg-background/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h4 className="font-heading font-semibold text-sm">{t.name}</h4>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">{(t.sections?.length ?? 0)} sections · {(t.sections ?? []).reduce((a: number, s: any) => a + (s.items?.length ?? 0), 0)} items</p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => applyTemplate(t)}>Apply</Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => duplicateTemplate(t)}><Copy className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteTemplate(t.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {!templates.length && <p className="col-span-full text-center text-sm text-muted-foreground py-8">No templates saved yet.</p>}
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard icon={CheckCircle2} label="Week Avg" value={`${Math.round(weekPct)}%`} tint="emerald" />
          <KpiCard icon={CalendarIcon} label="Month Avg" value={`${Math.round(monthPct)}%`} tint="blue" />
          <KpiCard icon={Flame} label="Longest Streak" value={`${longestStreak}d`} tint="amber" />
        </div>
      )}

      {tab === 'history' && (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5">
          {history.map((h) => {
            const { pct, done, total } = computeOverall(h.sections || []);
            return (
              <button key={h.date} onClick={() => { setDate(new Date(h.date)); setTab('checklist'); }}
                className="w-full flex items-center gap-3 text-left rounded-lg px-3 py-2 hover:bg-accent/60 transition">
                <div className="text-xs font-mono w-24 shrink-0 text-muted-foreground">{format(new Date(h.date), 'MMM d, yyyy')}</div>
                <div className="h-2 flex-1 rounded-full bg-border/60 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#3B82F6] to-[#EC4899]" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right font-mono tabular-nums">{done}/{total}</span>
                <span className="text-xs font-medium w-10 text-right tabular-nums">{Math.round(pct)}%</span>
              </button>
            );
          })}
          {!history.length && <p className="text-center text-sm text-muted-foreground py-8">No history yet.</p>}
        </div>
      )}

      <CustomizeDialog
        open={customizeOpen} onOpenChange={setCustomizeOpen}
        sections={sections}
        onRenameSection={renameSection}
        onDescSection={setSectionDesc}
        onIconSection={setSectionIcon}
        onColorSection={setSectionColor}
        onRemoveSection={removeSection}
        onMoveSection={moveSection}
        onRenameItem={renameItem}
        onRemoveItem={removeItem}
        onAddItem={addItem}
        onAddSection={addSection}
        onSaveAsTemplate={saveAsTemplate}
      />

      <TemplatesDialog
        open={templatesOpen} onOpenChange={setTemplatesOpen}
        templates={templates as any}
        onApply={applyTemplate}
        onDelete={deleteTemplate}
        onDuplicate={duplicateTemplate}
        onSaveCurrent={saveAsTemplate}
      />

      {/* Floating action button — 64px per spec */}
      <button
        onClick={() => setCustomizeOpen(true)}
        aria-label="Open customize"
        className="fixed h-16 w-16 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 z-30"
        style={{
          bottom: 24,
          right: 24,
          background: 'linear-gradient(135deg, #A855F7, #EC4899)',
          boxShadow: '0 12px 32px rgba(168,85,247,0.40)',
        }}
      >
        <ListChecks className="h-6 w-6" />
      </button>
      </div>
    </div>
  );
}


// ---------- Sidebar building blocks ----------
function SidePanel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative rounded-[16px] border border-white/[0.04] p-4 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.7)]" style={{ background: '#121212' }}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-[11px] uppercase tracking-[0.11em] text-white/75">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}


function Sparkline({ color, seed = 6 }: { color: string; seed?: number }) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const n = Math.sin((i + seed) * 1.3) * 0.5 + 0.5;
    const y = 12 - n * 10;
    return `${i * 6},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={48} height={14} viewBox="0 0 48 14" className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
    </svg>
  );
}

function StreakRow({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-3" style={{ height: 42 }}>
      <div
        className="h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: `linear-gradient(135deg, ${color}2A, ${color}0D)`, boxShadow: `inset 0 0 0 1px ${color}2A, inset 0 1px 0 rgba(255,255,255,0.05)` }}
      >
        <Icon className="h-[14px] w-[14px]" style={{ color }} />
      </div>
      <span className="text-[12px] text-white/85 flex-1 truncate">{label}</span>
      <span className="text-[12px] font-heading font-semibold tabular-nums" style={{ color }}>{value}</span>
      <Sparkline color={color} seed={label.length} />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string | number; tint: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-[11px] border border-white/[0.04] px-3 py-2 flex flex-col justify-center"
      style={{ height: 74, background: '#121212' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-[13px] w-[13px]" style={{ color: tint }} />
        <p className="text-[10.5px] text-white/55 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-[20px] font-heading font-bold text-white tabular-nums leading-none tracking-[-0.02em]">{value}</p>
    </div>
  );
}


function TypeChip({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[11px] border border-white/[0.04] px-3" style={{ height: 50, background: '#121212' }}>
      <Icon className="h-[15px] w-[15px]" style={{ color }} />
      <span className="text-[12px] text-white/85 truncate">{label}</span>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 rounded-[11px] border border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02] transition-all text-left group"
      style={{ height: 40, background: '#121212' }}
    >
      <Icon className="h-[14px] w-[14px] text-[#A78BFA] transition-transform group-hover:scale-110" />
      <span className="text-[12.5px] text-white/85 flex-1 group-hover:text-white">{label}</span>
    </button>
  );
}

function AddItemInline({ onAdd, color = '#8B5CF6' }: { onAdd: (label: string) => void; color?: string }) {
  const [v, setV] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onAdd(v); setV(''); }}
      className="mt-2 flex items-center gap-2 rounded-[9px] border border-dashed px-3"
      style={{ height: 36, borderColor: '#232B3F' }}
    >
      <Plus className="h-3 w-3" style={{ color }} />
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Add Item"
        className="flex-1 bg-transparent border-0 outline-none text-[12.5px] text-white/90 placeholder:text-white/35"
      />
      {v.trim() && (
        <button type="submit" className="text-[11.5px] font-medium" style={{ color }}>Add</button>
      )}
    </form>
  );
}



function CustomizeDialog(props: {
  open: boolean; onOpenChange: (b: boolean) => void;
  sections: ChecklistSection[];
  onRenameSection: (id: string, v: string) => void;
  onDescSection: (id: string, v: string) => void;
  onIconSection: (id: string, v: string) => void;
  onColorSection: (id: string, v: string) => void;
  onRemoveSection: (id: string) => void;
  onMoveSection: (id: string, dir: -1 | 1) => void;
  onRenameItem: (sid: string, iid: string, v: string) => void;
  onRemoveItem: (sid: string, iid: string) => void;
  onAddItem: (sid: string, v: string) => void;
  onAddSection: () => void;
  onSaveAsTemplate: (name: string) => void;
}) {
  const [tplName, setTplName] = useState('');
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-tight">Customize Checklist</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {props.sections.map((s, idx) => {
              const Icon = ICONS[s.icon] ?? ListTodo;
              const p = paletteFor(s.color);
              return (
                <div key={s.id} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-2" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})` }}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <Input value={s.title} onChange={(e) => props.onRenameSection(s.id, e.target.value)}
                          className="h-8 font-heading font-semibold" />
                      </div>
                      <Textarea value={s.description} onChange={(e) => props.onDescSection(s.id, e.target.value)}
                        placeholder="Section description…" className="min-h-[48px] text-xs" />
                      <div className="flex items-center gap-3">
                        <div className="flex flex-wrap gap-1">
                          {ICON_KEYS.map(k => {
                            const I = ICONS[k];
                            const active = k === s.icon;
                            return (
                              <button key={k} onClick={() => props.onIconSection(s.id, k)}
                                className={cn('h-7 w-7 rounded-md border flex items-center justify-center transition',
                                  active ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground')}>
                                <I className="h-3.5 w-3.5" />
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-1">
                          {PALETTES.map(pp => (
                            <button key={pp.key} onClick={() => props.onColorSection(s.id, pp.key)}
                              className={cn('h-5 w-5 rounded-full border-2 transition', s.color === pp.key ? 'border-foreground scale-110' : 'border-transparent')}
                              style={{ background: `linear-gradient(135deg, ${pp.from}, ${pp.to})` }}
                              aria-label={pp.key} />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {s.items.map(i => (
                          <div key={i.id} className="flex items-center gap-2">
                            <Input value={i.label} onChange={(e) => props.onRenameItem(s.id, i.id, e.target.value)} className="h-8 text-xs" />
                            <Button size="sm" variant="ghost" onClick={() => props.onRemoveItem(s.id, i.id)} className="h-8 w-8 p-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <AddItemInline onAdd={(l) => props.onAddItem(s.id, l)} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => props.onMoveSection(s.id, -1)} disabled={idx === 0}>
                        <ChevronRight className="h-3.5 w-3.5 -rotate-90" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => props.onMoveSection(s.id, 1)} disabled={idx === props.sections.length - 1}>
                        <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => props.onRemoveSection(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" className="w-full gap-2 border-dashed" onClick={props.onAddSection}>
              <Plus className="h-4 w-4" /> Add Section
            </Button>
          </div>
        </ScrollArea>
        <DialogFooter className="border-t border-border/50 pt-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Save as template…" className="h-8 flex-1" />
            <Button size="sm" variant="outline" className="h-8 gap-1.5"
              onClick={() => { props.onSaveAsTemplate(tplName); setTplName(''); }}
              disabled={!tplName.trim()}>
              <Sparkles className="h-3.5 w-3.5" /> Save Template
            </Button>
          </div>
          <Button size="sm" onClick={() => props.onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesDialog({ open, onOpenChange, templates, onApply, onDelete, onDuplicate, onSaveCurrent }: {
  open: boolean; onOpenChange: (b: boolean) => void;
  templates: any[];
  onApply: (t: Template) => void; onDelete: (id: string) => void;
  onDuplicate: (t: any) => void; onSaveCurrent: (name: string) => void;
}) {
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const filtered = templates.filter(t => t.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-tight">Templates</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="h-8 pl-8 text-xs" />
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {filtered.map(t => (
            <div key={t.id} className="rounded-xl border border-border/60 bg-card p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-sm truncate">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(t.sections?.length ?? 0)} sections · {(t.sections ?? []).reduce((a: number, s: any) => a + (s.items?.length ?? 0), 0)} items
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onApply(t)}>Apply</Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onDuplicate(t)}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          {!filtered.length && <p className="text-xs text-muted-foreground py-6 text-center">No templates yet. Save your current checklist as a template below.</p>}
        </div>
        <DialogFooter className="pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 w-full">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name…" className="h-8 flex-1 text-xs" />
            <Button size="sm" className="h-8 gap-1.5" disabled={!name.trim()} onClick={() => { onSaveCurrent(name); setName(''); }}>
              <Plus className="h-3.5 w-3.5" /> Save Current
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
