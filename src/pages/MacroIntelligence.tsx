import { useEffect, useMemo, useState } from "react";
import { AIInsightsPanel } from "@/components/shared/AIInsightsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Activity, Brain, Sparkles, TrendingUp, TrendingDown, Minus,
  Plus, Trash2, Zap, Target, AlertTriangle, History, Coins, DollarSign, Compass,
  ChevronDown, ArrowRight, ArrowUpRight, ArrowDownRight, Layers, BookOpen, Archive, CheckCircle2, XCircle,
} from "lucide-react";

/* =========================================================================
   TYPES
   ========================================================================= */
type MacroCycle = {
  id: string;
  user_id: string;
  cycle_month: string; // YYYY-MM
  label: string | null;
  status: "active" | "archived";
  archived_at: string | null;
  created_at: string;
};

type MacroEvent = {
  id?: string;
  cycle_id?: string | null;
  release_date: string;
  event: string;
  category?: string | null;
  previous: number | null;
  forecast: number | null;
  actual: number | null;
  unit?: string | null;
  surprise?: string | null;
  trend?: string | null;
  impact?: string | null;
  notes?: string | null;
  outcome_status?: "worked" | "not_worked" | null;
};

type ForwardOutcome = { probability: number; outcomes: string[] };
type ForwardExpectation = { if_high: ForwardOutcome; if_low: ForwardOutcome };

type Analysis = {
  id?: string;
  cycle_id?: string | null;
  analysis_date: string;
  dominant_narrative?: string;
  narrative_drivers?: string[];
  macro_theme?: string;
  fed_cycle?: string;
  environment?: string;
  market_focus?: string;
  market_focus_explanation?: string;
  current_story?: string[];
  next_event?: string;
  forward_expectation?: ForwardExpectation;
  fed_bias?: string;
  usd_bias?: string;
  gold_bias?: string;
  fed_confidence?: number;
  usd_confidence?: number;
  gold_confidence?: number;
  hawkish_probability?: number;
  dovish_probability?: number;
  rate_cut_probability?: number;
  rate_hike_probability?: number;
  recession_risk?: number;
  inflation_pressure?: string;
  interpretation?: string;
  smart_money_view?: string;
  expectation_pricing?: string;
  positioning_risk?: string;
  coaching?: string[];
  narrative_shift?: string;
  historical_context?: string;
  conflict_signals?: any[];
  future_probabilities?: any[];
  trade_filter?: string;
  confidence_level?: string;
  outcome_status?: "worked" | "not_worked" | null;
  // legacy mirror
  narrative?: string;
};

type MacroPrediction = {
  id: string;
  user_id?: string;
  cycle_id?: string | null;
  source_event_id?: string | null;
  source_event: string;
  target_event: string;
  prediction_date: string;
  usd_outlook?: string | null;
  gold_outlook?: string | null;
  fed_outlook?: string | null;
  narrative?: string | null;
  status: "pending" | "worked" | "failed";
  reviewed_at?: string | null;
  created_at?: string;
};

/** Locked macro cycle: NFP → CPI → FOMC → NFP… */
const MACRO_CYCLE = ["NFP", "CPI", "FOMC"] as const;
type CycleEvent = typeof MACRO_CYCLE[number];

function classifyCycleEvent(name: string): CycleEvent | null {
  if (!name) return null;
  if (/\bNFP\b|Nonfarm/i.test(name)) return "NFP";
  if (/\bCPI\b/i.test(name)) return "CPI";
  if (/FOMC|Fed Tone|Statement Tone|Rate Decision|Federal Funds/i.test(name)) return "FOMC";
  return null;
}
function nextCycleEvent(src: CycleEvent): CycleEvent {
  const i = MACRO_CYCLE.indexOf(src);
  return MACRO_CYCLE[(i + 1) % MACRO_CYCLE.length];
}

/* =========================================================================
   DEFAULTS
   ========================================================================= */
const CATEGORIES = [
  "Inflation", "Labor", "Growth", "Manufacturing", "Fed",
] as const;
type Category = typeof CATEGORIES[number];

const DEFAULT_TEMPLATE: { event: string; category: Category }[] = [
  { event: "CPI YoY", category: "Inflation" },
  { event: "Core CPI YoY", category: "Inflation" },
  { event: "PCE YoY", category: "Inflation" },
  { event: "Core PCE YoY", category: "Inflation" },
  { event: "NFP", category: "Labor" },
  { event: "Unemployment Rate", category: "Labor" },
  { event: "Avg Hourly Earnings YoY", category: "Labor" },
  { event: "JOLTS", category: "Labor" },
  { event: "Retail Sales MoM", category: "Growth" },
  { event: "GDP QoQ", category: "Growth" },
  { event: "ISM Services", category: "Manufacturing" },
  { event: "ISM Manufacturing", category: "Manufacturing" },
  { event: "FOMC Tone", category: "Fed" },
];

/** Derive the dashboard read from raw event data only.
 *  surprise = Market Signal, trend = Economic Direction, impact = Importance level. */
function computeEventLabels(e: { event?: string; category?: string | null; previous: number | null; forecast: number | null; actual: number | null; }):
  { surprise: string | null; trend: string | null; impact: string | null } {
  const { previous, forecast, actual, category, event } = e;
  if (isToneEvent(e)) {
    const tone = getFedTone(e as MacroEvent);
    if (tone === "Hawkish") return { surprise: "Bullish USD", trend: "Tightening", impact: "High" };
    if (tone === "Dovish") return { surprise: "Bearish USD", trend: "Easing", impact: "High" };
    if (tone === "Neutral") return { surprise: "Neutral", trend: "Neutral", impact: "Medium" };
    return { surprise: null, trend: null, impact: null };
  }
  if (actual == null || (forecast == null && previous == null)) {
    return { surprise: null, trend: null, impact: null };
  }
  const base = forecast != null ? forecast : previous;
  if (base == null) return { surprise: null, trend: null, impact: null };
  const diff = actual - base;
  const absDiff = Math.abs(diff);
  const insignificant = absDiff / Math.max(0.001, Math.abs(base)) < 0.005;
  const name = event || "";
  const isInflation = category === "Inflation" || /CPI|PPI|PCE|Inflation/i.test(name);
  const isRate = /Federal Funds|Rate Decision|Interest Rate|Policy Rate|Funds Rate|Yield/i.test(name);
  const isUnemployment = /Unemployment/i.test(name);
  const surprise = insignificant ? "Neutral" : diff > 0
    ? (isUnemployment ? "Bearish USD" : "Bullish USD")
    : (isUnemployment ? "Bullish USD" : "Bearish USD");
  const trend = insignificant ? "Neutral" : isRate
    ? (diff > 0 ? "Tightening" : "Easing")
    : isInflation
      ? (diff > 0 ? "Higher Inflation" : "Lower Inflation")
      : isUnemployment
        ? (diff > 0 ? "Weaker Economy" : "Stronger Economy")
        : (diff > 0 ? "Stronger Economy" : "Weaker Economy");
  const impact = computeImpactLevel(name, category, absDiff, base);
  return { surprise, trend, impact };
}

const FED_TONE_OPTIONS = ['Hawkish', 'Neutral', 'Dovish'] as const;

function isToneEvent(e: { event?: string; category?: string | null }) {
  return /FOMC Tone|Fed Tone|Statement Tone/i.test(e.event || "") && !/Rate|Funds|Yield/i.test(e.event || "");
}

function getFedTone(e: MacroEvent): typeof FED_TONE_OPTIONS[number] | null {
  const raw = String(e.unit || e.surprise || "");
  return (FED_TONE_OPTIONS as readonly string[]).includes(raw) ? raw as typeof FED_TONE_OPTIONS[number] : null;
}

function computeImpactLevel(event: string, category: string | null | undefined, absDiff: number, base: number) {
  const relative = absDiff / Math.max(0.001, Math.abs(base));
  if (/Federal Funds|Rate Decision|Interest Rate|Policy Rate|Funds Rate|Yield/i.test(event)) {
    if (absDiff >= 0.25) return "High";
    if (absDiff >= 0.1) return "Medium";
    return "Low";
  }
  if (category === "Inflation" || /CPI|PPI|PCE|Inflation/i.test(event)) {
    if (absDiff >= 0.5 || relative >= 0.2) return "High";
    if (absDiff >= 0.2 || relative >= 0.05) return "Medium";
    return "Low";
  }
  if (/Unemployment/i.test(event)) {
    if (absDiff >= 0.3) return "High";
    if (absDiff >= 0.1) return "Medium";
    return "Low";
  }
  if (/NFP|Payroll|JOLTS|Jobs/i.test(event)) {
    if (absDiff >= 75 || relative >= 0.2) return "High";
    if (absDiff >= 25 || relative >= 0.05) return "Medium";
    return "Low";
  }
  if (relative >= 0.2) return "High";
  if (relative >= 0.05) return "Medium";
  return "Low";
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

function biasTone(bias?: string) {
  if (!bias) return "text-muted-foreground";
  if (/Bullish|Hawkish/i.test(bias)) return "text-emerald-400";
  if (/Bearish|Dovish/i.test(bias)) return "text-rose-400";
  return "text-amber-300";
}
function biasIcon(bias?: string) {
  if (/Bullish|Hawkish/i.test(bias || "")) return <TrendingUp className="h-4 w-4" />;
  if (/Bearish|Dovish/i.test(bias || "")) return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

/* =========================================================================
   ATOMS
   ========================================================================= */
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={`relative overflow-hidden border-border/60 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl shadow-[0_0_0_1px_hsl(var(--border)/0.3)] ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      {children}
    </Card>
  );
}

function SpectrumBar({ left, right, value, leftAccent = "emerald", rightAccent = "rose" }: {
  left: string; right: string; value: number; leftAccent?: "emerald" | "rose" | "primary"; rightAccent?: "emerald" | "rose" | "primary";
}) {
  const v = Math.max(0, Math.min(100, value));
  const accentMap: Record<string, string> = {
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    primary: "text-primary",
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider">
        <span className={accentMap[leftAccent]}>{left}</span>
        <span className={accentMap[rightAccent]}>{right}</span>
      </div>
      <div className="relative h-2 rounded-full bg-background/60 border border-border/50 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400/40 via-amber-400/40 to-rose-400/40"
          style={{ width: "100%" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-foreground shadow-md ring-2 ring-background"
          style={{ left: `${v}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground text-center tabular-nums">{Math.round(v)}% toward {v > 50 ? right : left}</div>
    </div>
  );
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, right }: { icon: React.ReactNode; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg border border-border/50 bg-background/40 flex items-center justify-center text-primary">{icon}</div>
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function BiasChip({ title, bias, icon, accent }: { title: string; bias?: string; icon: React.ReactNode; accent?: "gold" }) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className={accent === "gold" ? "text-amber-400" : "text-primary"}>{icon}</span>
        {title}
      </div>
      <div className={`mt-1 font-heading text-lg font-bold leading-tight flex items-center gap-1.5 ${biasTone(bias)}`}>
        {biasIcon(bias)} {bias || "—"}
      </div>
    </div>
  );
}

function MiniBlock({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <p className="mt-1 text-sm leading-snug">{value || <span className="text-muted-foreground italic">—</span>}</p>
    </div>
  );
}

function NumInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Input
      type="number" step="any" inputMode="decimal"
      value={value ?? ""}
      onChange={e => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      className="h-8 w-full min-w-[68px] bg-transparent border-border/40 text-sm px-2 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

function ToneSelect({ value, onChange, disabled }: { value?: string | null; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs bg-transparent border-border/40">
        <SelectValue placeholder="Tone" />
      </SelectTrigger>
      <SelectContent>
        {FED_TONE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function AutoReadout({ value, tone = "muted" }: { value?: string | null; tone?: "emerald" | "rose" | "amber" | "muted" }) {
  return (
    <div className="flex h-8 items-center rounded-md border border-border/40 bg-background/30 px-2 text-xs">
      <LabelPill value={value || null} tone={tone} />
    </div>
  );
}

function LabelPill({ value, tone }: { value?: string | null; tone: "emerald" | "rose" | "amber" | "muted" }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = {
    emerald: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
    rose: "border-rose-400/40 text-rose-300 bg-rose-400/10",
    amber: "border-amber-400/40 text-amber-300 bg-amber-400/10",
    muted: "border-border/50 text-foreground/70 bg-background/40",
  }[tone];
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{value}</span>;
}

function surpriseTone(s?: string | null): "emerald" | "rose" | "amber" | "muted" {
  if (!s) return "muted";
  if (/Bullish|Stronger|Lower Inflation|Easing|Dovish/i.test(s)) return "emerald";
  if (/Bearish|Weaker|Higher Inflation|Tightening|Hawkish/i.test(s)) return "rose";
  return "muted";
}

/* =========================================================================
   PAGE
   ========================================================================= */
export default function MacroIntelligence() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<MacroCycle[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [latest, setLatest] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [context, setContext] = useState("");
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [confirmNewCycleOpen, setConfirmNewCycleOpen] = useState(false);

  // ----- Cross-cycle prediction history (all events, all time) -----
  const [allEvents, setAllEvents] = useState<MacroEvent[]>([]);
  const [predictions, setPredictions] = useState<MacroPrediction[]>([]);
  type RangeKey = "all" | "month" | "90d" | "year";
  type StatusKey = "all" | "pending" | "worked" | "failed";
  const [historyRange, setHistoryRange] = useState<RangeKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");

  useEffect(() => { if (user) { bootstrap(); loadAllEvents(); loadPredictions(); } /* eslint-disable-next-line */ }, [user]);

  async function loadAllEvents() {
    if (!user) return;
    const { data } = await supabase
      .from("macro_events")
      .select("id, cycle_id, release_date, event, category, previous, forecast, actual, unit, surprise, trend, impact, notes, outcome_status")
      .eq("user_id", user.id)
      .order("release_date", { ascending: false })
      .limit(2000);
    setAllEvents((data as MacroEvent[]) || []);
  }

  async function loadPredictions() {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("macro_predictions")
      .select("*")
      .eq("user_id", user.id)
      .order("prediction_date", { ascending: false })
      .limit(500);
    setPredictions((data as MacroPrediction[]) || []);
  }

  /* ---------- bootstrap & cycle management ---------- */
  async function bootstrap() {
    if (!user) return;
    setLoading(true);
    const { data: cs } = await supabase
      .from("macro_cycles")
      .select("*")
      .eq("user_id", user.id)
      .order("cycle_month", { ascending: false });
    let list = (cs as MacroCycle[]) || [];

    if (list.length === 0) {
      // create initial cycle
      const key = monthKey(new Date());
      const { data: newC, error } = await supabase
        .from("macro_cycles")
        .insert({ user_id: user.id, cycle_month: key, label: monthLabel(key), status: "active" })
        .select()
        .single();
      if (!error && newC) list = [newC as MacroCycle];
    }
    setCycles(list);
    const active = list.find(c => c.status === "active") || list[0] || null;
    if (active) {
      setActiveCycleId(active.id);
      await loadCycle(active.id);
    } else {
      setLoading(false);
    }
  }

  async function loadCycle(cycleId: string) {
    if (!user) return;
    setLoading(true);
    const [{ data: ev }, { data: an }] = await Promise.all([
      supabase.from("macro_events").select("*").eq("user_id", user.id).eq("cycle_id", cycleId).order("release_date", { ascending: true }),
      supabase.from("macro_analyses").select("*").eq("user_id", user.id).eq("cycle_id", cycleId).order("analysis_date", { ascending: false }),
    ]);
    let evs = (ev as any[]) || [];
    if (evs.length === 0) {
      // seed with default template (in-memory; saved when user clicks Save Events)
      evs = DEFAULT_TEMPLATE.map((t, i) => ({
        release_date: todayISO(),
        event: t.event,
        category: t.category,
        previous: null, forecast: null, actual: null, unit: "",
      }));
    }
    setEvents(evs as MacroEvent[]);
    // Spread ai_enriched JSONB back onto each analysis so Market Story, Forward
    // Expectations, Fed engine etc survive refresh.
    const ans: Analysis[] = ((an as any[]) || []).map((row) => ({
      ...row,
      ...((row?.ai_enriched && typeof row.ai_enriched === 'object') ? row.ai_enriched : {}),
    }));
    setAnalyses(ans);
    setLatest(ans[0] || null);
    setLoading(false);
  }

  async function switchCycle(cycleId: string) {
    setActiveCycleId(cycleId);
    setShowDeepDive(false);
    await loadCycle(cycleId);
  }

  async function startNewCycle() {
    if (!user) return;
    const key = monthKey(new Date());
    // archive current active(s) for a different month, OR if same month create unique label
    const existing = cycles.find(c => c.cycle_month === key);
    if (existing) {
      // archive any other active
      await supabase.from("macro_cycles").update({ status: "archived", archived_at: new Date().toISOString() }).eq("user_id", user.id).neq("id", existing.id).eq("status", "active");
      await supabase.from("macro_cycles").update({ status: "active" }).eq("id", existing.id);
      toast.success(`Switched to ${monthLabel(key)} cycle`);
      await bootstrap();
      setConfirmNewCycleOpen(false);
      return;
    }
    // archive existing active
    await supabase.from("macro_cycles").update({ status: "archived", archived_at: new Date().toISOString() }).eq("user_id", user.id).eq("status", "active");
    const { data: newC, error } = await supabase
      .from("macro_cycles")
      .insert({ user_id: user.id, cycle_month: key, label: monthLabel(key), status: "active" })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`New cycle started: ${monthLabel(key)}`);
    setConfirmNewCycleOpen(false);
    setCycles(prev => [newC as MacroCycle, ...prev.map(c => ({ ...c, status: "archived" as const }))]);
    setActiveCycleId((newC as MacroCycle).id);
    await loadCycle((newC as MacroCycle).id);
  }

  /* ---------- event editing ---------- */
  const activeCycle = cycles.find(c => c.id === activeCycleId) || null;
  const isReadOnly = !!activeCycle && activeCycle.status === "archived";

  function updateEvent(idx: number, patch: Partial<MacroEvent>) {
    setEvents(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const merged = { ...e, ...patch };
      // Auto-derive Surprise / Trend / Impact whenever Previous / Forecast / Actual change.
      // Anything the AI later returns will overwrite these, but the row never stays blank.
      if (
        'previous' in patch || 'forecast' in patch || 'actual' in patch ||
        'event' in patch || 'category' in patch || 'unit' in patch
      ) {
        const auto = computeEventLabels(merged);
        merged.surprise = auto.surprise;
        merged.trend = auto.trend;
        merged.impact = auto.impact;
      }
      return merged;
    }));
  }
  function addEvent(category?: Category) {
    setEvents(prev => [...prev, { release_date: todayISO(), event: "", category: category || "Inflation", previous: null, forecast: null, actual: null, unit: "" }]);
  }
  function removeEvent(idx: number) {
    setEvents(prev => prev.filter((_, i) => i !== idx));
  }

  function buildEventRows(source: MacroEvent[]) {
    return source.filter(e => e.event?.trim()).map(e => {
      const auto = computeEventLabels(e);
      return ({
        user_id: user!.id,
        cycle_id: activeCycleId,
        release_date: e.release_date || todayISO(),
        event: e.event.trim(),
        category: e.category || null,
        previous: e.previous, forecast: e.forecast, actual: e.actual,
        unit: e.unit || null,
        surprise: auto.surprise,
        trend: auto.trend,
        impact: auto.impact,
        notes: e.notes || null,
      });
    });
  }

  async function saveEvents() {
    if (!user || !activeCycleId) return;
    if (isReadOnly) return toast.error("Archived cycle is read-only");
    const cleaned = events.filter(e => e.event?.trim());
    if (cleaned.length === 0) return toast.error("Add at least one event");
    // Replace cycle events
    await supabase.from("macro_events").delete().eq("user_id", user.id).eq("cycle_id", activeCycleId);
    const rows = buildEventRows(cleaned);
    const { error } = await supabase.from("macro_events").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("Events saved");
    loadAllEvents();
  }

  /* ---------- analysis ---------- */
  async function runAnalysis() {
    if (!user || !activeCycleId) return;
    if (isReadOnly) return toast.error("Archived cycle is read-only");
    const withAutomaticLabels = events.map(e => ({ ...e, ...computeEventLabels(e) }));
    const cleaned = withAutomaticLabels.filter(e => e.event?.trim() && (e.actual !== null && e.actual !== undefined || (isToneEvent(e) && getFedTone(e))));
    if (cleaned.length === 0) return toast.error("Enter actual values or a Fed tone for at least one event");
    setEvents(withAutomaticLabels);
    await supabase.from("macro_events").delete().eq("user_id", user.id).eq("cycle_id", activeCycleId);
    const eventRows = buildEventRows(cleaned);
    const { error: eventSaveError } = await supabase.from("macro_events").insert(eventRows);
    if (eventSaveError) return toast.error(eventSaveError.message);
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("macro-intelligence", {
        body: { events: cleaned, context, cycle_id: activeCycleId },
      });
      if (error) throw error;
      const a = (data as any)?.analysis;
      if (!a) throw new Error("No analysis returned");

      // Apply per-event AI labels back to local rows
      const updated = events.map(e => {
        const m = (a.per_event_analysis || []).find((p: any) => p.event?.toLowerCase() === e.event?.toLowerCase());
        const auto = computeEventLabels(e);
        return m ? { ...e, ...auto, notes: m.reasoning } : { ...e, ...auto };
      });
      setEvents(updated);

      // Upsert (by user_id + cycle_id + analysis_date) — prevents duplicates
      // All "extra" fields (Market Story, Forward Expectations, Fed engine narrative,
      // coaching, etc.) get persisted into the ai_enriched JSONB column so they
      // survive a page refresh — previously they were in-memory only and vanished.
      const enrichedPayload = {
        dominant_narrative: a.dominant_narrative,
        narrative_drivers: a.narrative_drivers,
        current_story: a.current_story,
        next_event: a.next_event,
        forward_expectation: a.forward_expectation,
        market_focus_explanation: a.market_focus_explanation,
        coaching: a.coaching,
        historical_context: a.historical_context,
      };
      const insertRow = {
        user_id: user.id,
        cycle_id: activeCycleId,
        analysis_date: todayISO(),
        macro_theme: a.macro_theme, fed_cycle: a.fed_cycle, environment: a.environment,
        narrative: a.dominant_narrative || a.narrative,
        narrative_shift: a.narrative_shift,
        interpretation: a.interpretation,
        fed_bias: a.fed_bias, usd_bias: a.usd_bias, gold_bias: a.gold_bias,
        fed_confidence: a.fed_confidence, usd_confidence: a.usd_confidence, gold_confidence: a.gold_confidence,
        hawkish_probability: a.hawkish_probability, dovish_probability: a.dovish_probability,
        rate_cut_probability: a.rate_cut_probability, rate_hike_probability: a.rate_hike_probability,
        recession_risk: a.recession_risk, inflation_pressure: a.inflation_pressure,
        market_focus: a.market_focus, smart_money_view: a.smart_money_view,
        expectation_pricing: a.expectation_pricing, positioning_risk: a.positioning_risk,
        conflict_signals: a.conflict_signals || [],
        future_probabilities: a.future_probabilities || [],
        trade_filter: a.trade_filter, confidence_level: a.confidence_level,
        predicted_outcome: (a.future_probabilities?.[0]?.outcome) || null,
        ai_enriched: enrichedPayload,
      };
      const { data: saved, error: saveErr } = await supabase
        .from("macro_analyses")
        .upsert(insertRow, { onConflict: "user_id,cycle_id,analysis_date" })
        .select()
        .maybeSingle();
      if (saveErr) throw saveErr;

      // Append timeline entry to cycle
      if (a.timeline_entry?.headline && activeCycle) {
        const cur = (activeCycle as any).timeline || [];
        const next = Array.isArray(cur) ? [...cur, a.timeline_entry] : [a.timeline_entry];
        await supabase.from("macro_cycles").update({ timeline: next }).eq("id", activeCycle.id);
        setCycles(prev => prev.map(c => c.id === activeCycle.id ? { ...c, ...(({ timeline: next } as any)) } : c));
      }

      // Persist enriched fields locally on the analysis (in-memory, since not all are DB-backed)
      const enriched: Analysis = {
        ...(saved as Analysis),
        dominant_narrative: a.dominant_narrative,
        narrative_drivers: a.narrative_drivers,
        current_story: a.current_story,
        next_event: a.next_event,
        forward_expectation: a.forward_expectation,
        market_focus_explanation: a.market_focus_explanation,
        coaching: a.coaching,
        historical_context: a.historical_context,
      };
      setLatest(enriched);
      // Replace today's analysis in the list (or prepend)
      setAnalyses(prev => {
        const without = prev.filter(x => x.analysis_date !== todayISO());
        return [enriched, ...without].slice(0, 30);
      });
      toast.success("Macro intelligence updated");
      loadAllEvents();

      // ----- Auto-create Prediction History entry for the locked NFP → CPI → FOMC cycle -----
      // Find the most recent cycle-trigger event the user just analyzed.
      const cycleHits = cleaned
        .map(ev => ({ ev, kind: classifyCycleEvent(ev.event || "") }))
        .filter(x => x.kind) as { ev: MacroEvent; kind: CycleEvent }[];
      if (cycleHits.length > 0) {
        cycleHits.sort((a, b) => (b.ev.release_date || "").localeCompare(a.ev.release_date || ""));
        const { ev: srcEv, kind: sourceKind } = cycleHits[0];
        const target = nextCycleEvent(sourceKind);
        // De-dupe: skip if a pending prediction already exists for the same source on the same date
        const dupe = predictions.find(
          p => p.source_event === sourceKind && p.prediction_date === todayISO() && p.status === "pending",
        );
        if (!dupe) {
          const payload = {
            user_id: user.id,
            cycle_id: activeCycleId,
            source_event_id: srcEv.id || null,
            source_event: sourceKind,
            target_event: target,
            prediction_date: todayISO(),
            usd_outlook: a.usd_bias || null,
            gold_outlook: a.gold_bias || null,
            fed_outlook: a.fed_bias || null,
            narrative: a.dominant_narrative || a.narrative || a.interpretation || null,
            status: "pending" as const,
          };
          const { data: newPred } = await (supabase as any)
            .from("macro_predictions")
            .insert(payload)
            .select()
            .maybeSingle();
          if (newPred) setPredictions(prev => [newPred as MacroPrediction, ...prev]);
          toast.success(`Prediction logged: ${sourceKind} → ${target}`);
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed");
    } finally {
      setRunning(false);
    }
  }

  async function setOutcome(id: string, status: "worked" | "not_worked") {
    const { error } = await supabase.from("macro_analyses").update({ outcome_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    setAnalyses(prev => prev.map(a => a.id === id ? { ...a, outcome_status: status } : a));
    toast.success("Outcome recorded");
  }

  async function setEventOutcome(id: string, status: "worked" | "not_worked") {
    const { error } = await supabase.from("macro_events").update({ outcome_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    setAllEvents(prev => prev.map(e => e.id === id ? { ...e, outcome_status: status } : e));
    setEvents(prev => prev.map(e => e.id === id ? { ...e, outcome_status: status } : e));
    toast.success("Outcome recorded");
  }

  async function setPredictionStatus(id: string, status: "worked" | "failed") {
    const { error } = await (supabase as any)
      .from("macro_predictions")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setPredictions(prev => prev.map(p => p.id === id ? { ...p, status, reviewed_at: new Date().toISOString() } : p));
    toast.success(`Marked ${status}`);
  }

  /* ---------- derived ---------- */
  // Aggregate (analysis-level) hit rate — kept for backwards compat
  const accuracyStats = useMemo(() => {
    const scored = analyses.filter(a => a.outcome_status === "worked" || a.outcome_status === "not_worked");
    const total = scored.length;
    const hits = scored.filter(a => a.outcome_status === "worked").length;
    return { total, hits, rate: total ? Math.round((hits / total) * 100) : 0 };
  }, [analyses]);

  // Forecast hit-rate stats from macro_predictions
  const predictionHitStats = useMemo(() => {
    const now = new Date();
    const ninetyAgo = new Date(now); ninetyAgo.setDate(ninetyAgo.getDate() - 90);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const score = (list: MacroPrediction[]) => {
      const scored = list.filter(p => p.status === "worked" || p.status === "failed");
      const hits = scored.filter(p => p.status === "worked").length;
      return { total: scored.length, hits, rate: scored.length ? Math.round((hits / scored.length) * 100) : 0 };
    };
    const inRange = (since: Date) => predictions.filter(p => new Date(p.prediction_date) >= since);
    return {
      overall: score(predictions),
      year: score(inRange(yearStart)),
      last90: score(inRange(ninetyAgo)),
    };
  }, [predictions]);

  const filteredPredictions = useMemo(() => {
    const now = new Date();
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const since: Date | null = (() => {
      switch (historyRange) {
        case "month": { const x = startOfDay(now); x.setMonth(x.getMonth() - 1); return x; }
        case "90d":   { const x = startOfDay(now); x.setDate(x.getDate() - 90); return x; }
        case "year":  return new Date(now.getFullYear(), 0, 1);
        case "all":   return null;
      }
    })();
    return predictions
      .filter(p => !since || new Date(p.prediction_date) >= since)
      .filter(p => statusFilter === "all" ? true : p.status === statusFilter);
  }, [predictions, historyRange, statusFilter]);

  // Pending predictions that still need review — surfaced at top of history.
  const pendingPredictions = useMemo(
    () => predictions.filter(p => p.status === "pending"),
    [predictions],
  );

  const eventsByCategory = useMemo(() => {
    const groups: Record<string, MacroEvent[]> = {};
    for (const cat of CATEGORIES) groups[cat] = [];
    for (const e of events) {
      const c = (e.category && (CATEGORIES as readonly string[]).includes(e.category)) ? e.category : "Inflation";
      groups[c].push(e);
    }
    return groups;
  }, [events]);

  const rawTimeline = (activeCycle as any)?.timeline || [];
  // Curated institutional timeline — only the single 2026-06-12 entry per user spec.
  // The full underlying timeline is preserved in the database (rawTimeline) for analytics.
  const cycleTimeline = (rawTimeline as any[]).filter((t: any) => {
    const d = String(t?.date || "").slice(0, 10);
    return d === "2026-06-12";
  });

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/50">
      <div className="w-full px-6 py-8 space-y-6">
        {/* HEADER */}
        <GlassCard className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl border border-primary/40 bg-primary/10 flex items-center justify-center">
                  <Compass className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="font-heading text-2xl font-bold tracking-tight">Macro Intelligence</h1>
                  <p className="text-xs text-muted-foreground">Monthly macro decision terminal</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <HeaderChip label="Theme" value={latest?.macro_theme || "—"} />
                <HeaderChip label="Fed Cycle" value={latest?.fed_cycle || "—"} />
                <HeaderChip label="Environment" value={latest?.environment || "—"} />
                <HeaderChip label="Confidence" value={latest?.confidence_level || "—"} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Cycle switcher */}
              <Select value={activeCycleId || ""} onValueChange={switchCycle}>
                <SelectTrigger className="h-9 w-[200px] text-xs"><SelectValue placeholder="Select cycle" /></SelectTrigger>
                <SelectContent>
                  {cycles.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.status === "archived" ? <Archive className="h-3 w-3 text-muted-foreground" /> : <Activity className="h-3 w-3 text-primary" />}
                        {c.label || monthLabel(c.cycle_month)}
                        {c.status === "active" && <Badge variant="outline" className="h-4 text-[9px]">Active</Badge>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setConfirmNewCycleOpen(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> New Cycle
              </Button>
              <Button variant="outline" size="sm" onClick={saveEvents} disabled={running || isReadOnly}>Save Events</Button>
              <Button size="sm" onClick={runAnalysis} disabled={running || isReadOnly} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {running ? "Analyzing..." : "Run AI Analysis"}
              </Button>
            </div>
          </div>
          {isReadOnly && (
            <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200 flex items-center gap-2">
              <Archive className="h-3.5 w-3.5" /> This cycle is archived. Read-only.
            </div>
          )}
        </GlassCard>

        {/* PRIMARY LAYER: DOMINANT NARRATIVE */}
        <GlassCard className="p-6 md:p-8">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary/80 font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Dominant Market Narrative
          </div>
          <p className="mt-3 font-heading text-2xl md:text-3xl leading-snug text-foreground">
            {latest?.dominant_narrative || latest?.narrative || <span className="text-muted-foreground italic">Run analysis to generate today's market story.</span>}
          </p>
          {!!latest?.narrative_drivers?.length && (
            <div className="mt-5 flex flex-wrap gap-2">
              {latest.narrative_drivers.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {d}
                </span>
              ))}
            </div>
          )}
          {/* Bias chip strip */}
          <div className="mt-6 flex flex-wrap gap-3">
            <BiasChip title="USD" bias={latest?.usd_bias} icon={<DollarSign className="h-3.5 w-3.5" />} />
            <BiasChip title="Gold" bias={latest?.gold_bias} icon={<Coins className="h-3.5 w-3.5" />} accent="gold" />
            <BiasChip title="Fed" bias={latest?.fed_bias} icon={<Brain className="h-3.5 w-3.5" />} />
            <div className="flex-1 min-w-[140px] rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" /> Environment
              </div>
              <div className="mt-1 font-heading text-lg font-bold leading-tight">{latest?.environment || "—"}</div>
            </div>
            <div className="flex-1 min-w-[140px] rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-primary" /> Market Focus
              </div>
              <div className="mt-1 font-heading text-lg font-bold leading-tight">{latest?.market_focus || "—"}</div>
              {latest?.market_focus_explanation && <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{latest.market_focus_explanation}</p>}
            </div>
          </div>
        </GlassCard>

        {/* WHAT'S HAPPENING RIGHT NOW + FORWARD EXPECTATION */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard className="p-6">
            <SectionHeader icon={<BookOpen className="h-4 w-4" />} title="What's Happening Right Now" subtitle="Market story in plain English" />
            <ul className="mt-4 space-y-2">
              {(latest?.current_story || []).length === 0 && (
                <li className="text-sm text-muted-foreground italic">No story yet. Run analysis to populate.</li>
              )}
              {(latest?.current_story || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-snug">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionHeader
              icon={<ArrowRight className="h-4 w-4" />}
              title="Forward Expectation Engine"
              subtitle={latest?.next_event ? `Markets now wait on: ${latest.next_event}` : "What may happen next"}
            />
            {latest?.forward_expectation ? (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <ForwardCard
                  variant="high"
                  label={`If ${latest.next_event || "data"} comes in HIGH`}
                  probability={latest.forward_expectation.if_high?.probability || 0}
                  outcomes={latest.forward_expectation.if_high?.outcomes || []}
                />
                <ForwardCard
                  variant="low"
                  label={`If ${latest.next_event || "data"} comes in LOW`}
                  probability={latest.forward_expectation.if_low?.probability || 0}
                  outcomes={latest.forward_expectation.if_low?.outcomes || []}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground italic">Run analysis to generate forward outcomes.</p>
            )}
          </GlassCard>
        </div>

        {/* FED EXPECTATION SPECTRUMS + CONFLICTS */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard className="p-6">
            <SectionHeader icon={<Brain className="h-4 w-4" />} title="Fed Expectation Engine" subtitle="Probability spectrums" />
            <div className="mt-5 space-y-5">
              <SpectrumBar left="Dovish" right="Hawkish" leftAccent="emerald" rightAccent="rose" value={latest?.hawkish_probability ?? 50} />
              <SpectrumBar left="Cuts" right="Hikes" leftAccent="emerald" rightAccent="rose" value={latest?.rate_hike_probability ?? Math.max(0, 100 - (latest?.rate_cut_probability ?? 50))} />
              <div className="grid grid-cols-2 gap-4 pt-2">
                <MiniBlock label="Inflation" value={latest?.inflation_pressure} icon={<Activity className="h-3.5 w-3.5" />} />
                <MiniBlock label="Recession Risk" value={latest?.recession_risk != null ? `${Math.round(latest.recession_risk)}%` : "—"} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionHeader icon={<AlertTriangle className="h-4 w-4" />} title="Macro Conflict Detector" subtitle="Mixed signals & dominant read" />
            <div className="mt-4 space-y-3">
              {(latest?.conflict_signals || []).length === 0 && (
                <p className="text-sm text-muted-foreground italic">No conflicts detected.</p>
              )}
              {(latest?.conflict_signals || []).map((c: any, i: number) => (
                <div key={i} className="rounded-lg border border-border/50 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{c.conflict}</span>
                    <Badge variant="outline" className={c.severity === "High" ? "border-rose-400/40 text-rose-300" : c.severity === "Medium" ? "border-amber-400/40 text-amber-300" : "border-border/50"}>{c.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Dominant: <span className="text-foreground/80">{c.dominant_signal}</span></p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* SECONDARY: SMART MONEY / PRICING / POSITIONING / COACHING */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CompactCard icon={<Sparkles className="h-3.5 w-3.5" />} title="Smart Money View" body={latest?.smart_money_view} />
          <CompactCard icon={<Activity className="h-3.5 w-3.5" />} title="Expectation Pricing" body={latest?.expectation_pricing} />
          <CompactCard icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Positioning Risk" body={latest?.positioning_risk} />
          <CompactCard icon={<Compass className="h-3.5 w-3.5" />} title="Trade Filter" body={latest?.trade_filter} />
        </div>

        {/* COACHING */}
        {!!latest?.coaching?.length && (
          <GlassCard className="p-5">
            <SectionHeader icon={<Brain className="h-4 w-4" />} title="Mentor Cautions" subtitle="Avoid these thinking traps" />
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {latest.coaching.map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-sm leading-snug">
                  <Zap className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" /> <span>{c}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* DEEP DIVE — FULL AI INTERPRETATION */}
        <GlassCard className="p-5">
          <Collapsible open={showDeepDive} onOpenChange={setShowDeepDive}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between gap-3 text-left">
                <SectionHeader icon={<Brain className="h-4 w-4" />} title="Deep Dive Reasoning" subtitle="Full AI interpretation & narrative shift" />
                <ChevronDown className={`h-4 w-4 transition-transform ${showDeepDive ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-7 whitespace-pre-line">
                  {latest?.interpretation || <span className="text-muted-foreground italic">No interpretation yet.</span>}
                </p>
                {latest?.narrative_shift && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300 font-semibold mb-1">
                      <Zap className="h-3.5 w-3.5" /> Narrative Shift
                    </div>
                    <p className="text-sm leading-6">{latest.narrative_shift}</p>
                  </div>
                )}
                {latest?.historical_context && (
                  <div className="rounded-lg border border-border/50 bg-background/30 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                      <History className="h-3.5 w-3.5" /> Historical Context
                    </div>
                    <p className="text-sm leading-6">{latest.historical_context}</p>
                  </div>
                )}
                {!!latest?.future_probabilities?.length && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">All Future Probabilities</div>
                    <div className="space-y-2">
                      {latest.future_probabilities.map((p: any, i: number) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium leading-snug pr-3">{p.outcome}</span>
                            <span className="font-heading font-bold text-primary">{Math.round(p.probability)}%</span>
                          </div>
                          <Progress value={Math.max(0, Math.min(100, p.probability))} className="h-1.5" />
                          {p.rationale && <p className="text-xs text-muted-foreground leading-relaxed">{p.rationale}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </GlassCard>

        {/* ECONOMIC TABLE — grouped by category */}
        <GlassCard className="p-6">
          <SectionHeader
            icon={<Activity className="h-4 w-4" />}
            title="Economic Data Input"
            subtitle="Grouped by category • Use + Add Event to expand any category"
            right={null}
          />
          <div className="mt-4 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : (
              CATEGORIES.map(cat => {
                const rows = eventsByCategory[cat];
                const onAdd = isReadOnly ? undefined : () => addEvent(cat);
                if (!rows || rows.length === 0) {
                  return (
                    <CategoryGroup key={cat} category={cat} count={0} onAdd={onAdd}>
                      <p className="text-xs text-muted-foreground italic px-3 py-2">No events yet — click <span className="font-medium text-foreground">+ Add Event</span> above.</p>
                    </CategoryGroup>
                  );
                }
                return (
                  <CategoryGroup key={cat} category={cat} count={rows.length} defaultOpen onAdd={onAdd}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                            <th className="text-left font-medium px-2 py-1.5">Event</th>
                            <th className="text-left font-medium px-2 py-1.5 w-[88px]">Prev</th>
                            <th className="text-left font-medium px-2 py-1.5 w-[88px]">Fcst</th>
                            <th className="text-left font-medium px-2 py-1.5 w-[88px]">Actual</th>
                            <th className="text-left font-medium px-2 py-1.5 w-44">Market Signal</th>
                            <th className="text-left font-medium px-2 py-1.5 w-36">Economic Direction</th>
                            <th className="text-left font-medium px-2 py-1.5 w-32">Impact</th>
                            {!isReadOnly && <th className="w-8"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((e) => {
                            const i = events.indexOf(e);
                            const toneEvent = isToneEvent(e);
                            return (
                              <tr key={i} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                                <td className="px-2 py-1.5">
                                  <Input
                                    disabled={isReadOnly}
                                    value={e.event}
                                    onChange={ev => updateEvent(i, { event: ev.target.value })}
                                    className="h-8 bg-transparent border-border/40"
                                    placeholder={cat === 'Fed' ? 'e.g. FOMC Tone or Federal Funds Rate' : 'Event name'}
                                  />
                                </td>
                                {toneEvent ? (
                                  <td className="px-2 py-1.5" colSpan={3}>
                                    <ToneSelect disabled={isReadOnly} value={getFedTone(e)} onChange={v => updateEvent(i, { unit: v })} />
                                  </td>
                                ) : (
                                  <>
                                    <td className="px-2 py-1.5"><NumInput value={e.previous} onChange={v => !isReadOnly && updateEvent(i, { previous: v })} /></td>
                                    <td className="px-2 py-1.5"><NumInput value={e.forecast} onChange={v => !isReadOnly && updateEvent(i, { forecast: v })} /></td>
                                    <td className="px-2 py-1.5"><NumInput value={e.actual} onChange={v => !isReadOnly && updateEvent(i, { actual: v })} /></td>
                                  </>
                                )}
                                <td className="px-2 py-1.5"><AutoReadout value={e.surprise} tone={surpriseTone(e.surprise)} /></td>
                                <td className="px-2 py-1.5"><AutoReadout value={e.trend} tone={surpriseTone(e.trend)} /></td>
                                <td className="px-2 py-1.5"><AutoReadout value={e.impact} tone={e.impact === 'High' ? 'rose' : e.impact === 'Medium' ? 'amber' : 'muted'} /></td>
                                {!isReadOnly && (
                                  <td className="px-2 py-1.5"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeEvent(i)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CategoryGroup>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* TIMELINE + PREDICTION HISTORY */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Timeline */}
          <GlassCard className="p-6">
            <SectionHeader icon={<History className="h-4 w-4" />} title="Macro Timeline" subtitle={activeCycle ? (activeCycle.label || monthLabel(activeCycle.cycle_month)) : ""} />
            <div className="mt-4 space-y-3">
              {cycleTimeline.length === 0 && <p className="text-sm text-muted-foreground italic">Timeline will populate as you run analyses.</p>}
              <div className="relative pl-5">
                {cycleTimeline.length > 0 && <div className="absolute left-2 top-1 bottom-1 w-px bg-border/60" />}
                {cycleTimeline.map((t: any, i: number) => (
                  <div key={i} className="relative pb-3">
                    <div className="absolute -left-3 top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.date}</div>
                    <div className="text-sm leading-snug">{t.headline}</div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Prediction History — forecast tracking (NFP → CPI → FOMC cycle) */}
          <GlassCard className="p-6">
            <SectionHeader
              icon={<Layers className="h-4 w-4" />}
              title="Prediction History"
              subtitle="Macro forecast tracking · NFP → CPI → FOMC. Each AI run logs a forward forecast; mark Worked / Failed after the next release."
            />

            {/* Hit-rate tiles */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {([
                { label: "Overall Hit Rate", s: predictionHitStats.overall },
                { label: "Last 90 Days",     s: predictionHitStats.last90 },
                { label: "This Year",        s: predictionHitStats.year },
              ] as const).map(({ label, s }) => (
                <div key={label} className="rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="mt-0.5 font-heading text-lg font-bold tabular-nums text-foreground">{s.rate}%</div>
                  <div className="text-[10px] text-muted-foreground">{s.hits}/{s.total} worked</div>
                </div>
              ))}
            </div>

            {/* Status filter */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {([
                { k: "all",     l: "All" },
                { k: "pending", l: "Pending" },
                { k: "worked",  l: "Worked" },
                { k: "failed",  l: "Failed" },
              ] as { k: StatusKey; l: string }[]).map(({ k, l }) => (
                <button
                  key={k}
                  onClick={() => setStatusFilter(k)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
                    statusFilter === k
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                >{l}</button>
              ))}
            </div>

            {/* Range filter */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([
                { k: "month", l: "This Month" },
                { k: "90d",   l: "Last 90 Days" },
                { k: "year",  l: "This Year" },
                { k: "all",   l: "All Time" },
              ] as { k: RangeKey; l: string }[]).map(({ k, l }) => (
                <button
                  key={k}
                  onClick={() => setHistoryRange(k)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
                    historyRange === k
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                >{l}</button>
              ))}
            </div>

            {/* Pending review banner */}
            {pendingPredictions.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
                {pendingPredictions.length} pending prediction{pendingPredictions.length > 1 ? "s" : ""} — review before logging the next cycle event.
              </div>
            )}

            <Separator className="my-4" />

            <div className="space-y-3">
              {filteredPredictions.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No predictions in this range.</p>
              )}
              {filteredPredictions.map(p => {
                const usdTone = surpriseTone(p.usd_outlook?.includes("Bull") ? "Bullish" : p.usd_outlook?.includes("Bear") ? "Bearish" : p.usd_outlook || undefined);
                const goldTone = surpriseTone(p.gold_outlook?.includes("Bull") ? "Bullish" : p.gold_outlook?.includes("Bear") ? "Bearish" : p.gold_outlook || undefined);
                const fedTone = /Hawk/i.test(p.fed_outlook || "") ? "rose" : /Dov/i.test(p.fed_outlook || "") ? "emerald" : "muted";
                return (
                  <div key={p.id} className="rounded-xl border border-border/60 bg-background/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">{p.source_event}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Badge variant="outline" className="text-[10px]">{p.target_event}</Badge>
                        <span className="text-[10px] text-muted-foreground ml-2">{p.prediction_date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.status === "worked" && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Worked</Badge>
                        )}
                        {p.status === "failed" && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>
                        )}
                        {p.status === "pending" && (
                          <>
                            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]">Pending</Badge>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setPredictionStatus(p.id, "worked")}>
                              <CheckCircle2 className="h-3 w-3" /> Worked
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setPredictionStatus(p.id, "failed")}>
                              <XCircle className="h-3 w-3" /> Failed
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><DollarSign className="h-3 w-3" />USD</div>
                        <div className="mt-0.5"><LabelPill value={p.usd_outlook || null} tone={usdTone} /></div>
                      </div>
                      <div className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><Coins className="h-3 w-3" />Gold</div>
                        <div className="mt-0.5"><LabelPill value={p.gold_outlook || null} tone={goldTone} /></div>
                      </div>
                      <div className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground"><Compass className="h-3 w-3" />Fed</div>
                        <div className="mt-0.5"><LabelPill value={p.fed_outlook || null} tone={fedTone as any} /></div>
                      </div>
                    </div>

                    {p.narrative && (
                      <p className="mt-3 text-xs italic text-muted-foreground leading-relaxed">{p.narrative}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* CONFIRM NEW CYCLE DIALOG */}
      <Dialog open={confirmNewCycleOpen} onOpenChange={setConfirmNewCycleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Create New Macro Cycle</DialogTitle>
            <DialogDescription className="pt-2">
              Create a new monthly macro cycle for <span className="font-semibold text-foreground">{monthLabel(monthKey(new Date()))}</span>?
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Archives current month</li>
            <li>• Preserves historical memory</li>
            <li>• Preserves prediction history</li>
            <li>• Preserves macro narrative history</li>
            <li>• Resets active economic table</li>
            <li>• Carries forward previous macro context</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmNewCycleOpen(false)}>Cancel</Button>
            <Button onClick={startNewCycle} className="gap-1"><Plus className="h-4 w-4" /> Create New Cycle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Insights — page bottom (universal) */}
      <div className="px-6 pb-8">
        <AIInsightsPanel
          page="Macro Intelligence"
          payload={{
            cycle: activeCycle ? { label: activeCycle.label, status: activeCycle.status, month: activeCycle.cycle_month } : null,
            latest_analysis: latest ? {
              theme: latest.macro_theme, fed_cycle: latest.fed_cycle, environment: latest.environment,
              usd_bias: latest.usd_bias, gold_bias: latest.gold_bias, fed_bias: latest.fed_bias,
              confidence: latest.confidence_level, narrative: latest.dominant_narrative,
            } : null,
            event_count: events.length,
            predictions: predictions.slice(0, 12).map((p: any) => ({
              source: p.source_event, target: p.target_event, status: p.status,
              usd: p.usd_outlook, gold: p.gold_outlook, fed: p.fed_outlook,
            })),
            hit_rate: predictionHitStats.overall,
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   SUBCOMPONENTS
   ========================================================================= */
function CompactCard({ icon, title, body }: { icon: React.ReactNode; title: string; body?: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span> {title}
      </div>
      <p className="mt-2 text-sm leading-snug">{body || <span className="text-muted-foreground italic">—</span>}</p>
    </GlassCard>
  );
}

function ForwardCard({ variant, label, probability, outcomes }: {
  variant: "high" | "low"; label: string; probability: number; outcomes: string[];
}) {
  const isHigh = variant === "high";
  const accent = isHigh ? "rose" : "emerald";
  const accentClasses = isHigh
    ? "border-rose-400/30 bg-rose-400/5"
    : "border-emerald-400/30 bg-emerald-400/5";
  const Arrow = isHigh ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={`rounded-xl border p-3.5 ${accentClasses}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${isHigh ? "text-rose-300" : "text-emerald-300"}`}>
          <Arrow className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="font-heading font-bold text-base tabular-nums">{Math.round(probability)}%</span>
      </div>
      <Progress value={probability} className="h-1.5 mt-2" />
      <ul className="mt-3 space-y-1.5">
        {outcomes.map((o, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-snug">
            <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${isHigh ? "bg-rose-400" : "bg-emerald-400"}`} />
            <span>{o}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryGroup({ category, count, children, defaultOpen = false, onAdd }: {
  category: string; count: number; children: React.ReactNode; defaultOpen?: boolean; onAdd?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/30 hover:bg-accent/30 transition-colors">
        <CollapsibleTrigger asChild>
          <button className="flex-1 flex items-center gap-2 text-left">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
            <span className="text-xs font-semibold uppercase tracking-wider">{category}</span>
            <Badge variant="outline" className="text-[10px] h-5">{count}</Badge>
          </button>
        </CollapsibleTrigger>
        {onAdd && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add Event
          </button>
        )}
      </div>
      <CollapsibleContent className="pt-2 px-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}
