import { useState, useMemo, useEffect, useRef } from 'react';
import { BiasBadge, BiasSelectContent } from '@/components/shared/BiasBadge';
import { MultiMediaBox } from '@/components/shared/MultiMediaBox';
import { useTrading } from '@/contexts/TradingContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Calendar, Shield, Target, TrendingUp, FileText, Eye, Clock, Crosshair, StickyNote, BarChart3, Save, Newspaper, ArrowLeft, Video } from 'lucide-react';
import { DailyReviewVideo } from '@/components/plans/DailyReviewVideo';

import { DailyPlan, DailyPairPlan, ALL_ASSETS, MARKET_LOCATIONS, MarketLocation } from '@/types/trading';
import { cn } from '@/lib/utils';
import { UnifiedMediaBox } from '@/components/shared/UnifiedMediaBox';
import { RichJournalBlock } from '@/components/shared/RichJournalBlock';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { coerceRichJournal, serializeJournal } from '@/lib/journalData';
import { PlanListHeader, PlanDetailHeader, PlanEmptyState } from '@/components/plans/PlanHeader';
import { PlanListItem } from '@/components/plans/PlanListItem';
import { toast } from '@/hooks/use-toast';
import { AIInsightsPanel } from '@/components/shared/AIInsightsPanel';
import { MarketSentimentSlider } from '@/components/shared/MarketSentimentSlider';
import { adaptDailyPlan } from '@/lib/aiInsightAdapters';
import { useAutosave } from '@/hooks/useAutosave';
import { SaveStatusIndicator } from '@/components/shared/SaveStatusIndicator';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draftStorage';

const emptyPairPlan = (): DailyPairPlan => ({
  id: crypto.randomUUID(),
  pair: '',
  bias: 'Neutral',
  setup: '',
  reasons: [],
  keyLevels: '',
  narrative: '',
});

function formatDayLabel(date: string): string {
  const d = new Date(date);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatFullDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function BiasTag({ bias }: { bias: string }) {
  return <BiasBadge bias={bias} hideNeutral />;
}

function SectionCard({ title, icon, accent = 'primary', badge, children, className }: {
  title: string; icon?: React.ReactNode; accent?: 'primary' | 'success' | 'warning' | 'destructive';
  badge?: string; children: React.ReactNode; className?: string;
}) {
  const iconColors = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    destructive: 'text-destructive bg-destructive/10',
  };

  return (
    <div className={cn(
      'rounded-xl border border-border/40 bg-card/60 overflow-visible shadow-sm',
      className
    )}>
      <div className="px-5 py-3.5 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', iconColors[accent])}>
                {icon}
              </div>
            )}
            <h3 className="font-heading text-xs font-bold tracking-wide uppercase text-foreground">{title}</h3>
          </div>
          {badge && (
            <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

export default function DailyPlanPage() {
  const { dailyPlans, addDailyPlan, updateDailyPlan, deleteDailyPlan, trades, sessions, loadingDailyPlans, hydrateDailyPlanMedia } = useTrading();
  const { user: authUser } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localPlan, setLocalPlan] = useState<DailyPlan | null>(null);
  const restoredRef = useRef<Set<string>>(new Set());

  const startNew = () => {
    const plan: DailyPlan = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      dailyBias: 'Neutral',
      sessionFocus: sessions[0] || 'New York',
      maxTrades: 2,
      riskLimit: '1%',
      pairs: [emptyPairPlan()],
      newsItems: [],
      analysisVideoUrl: '',
      note: '',
      // v2: enables Daily/4H reference charts + Market Location selector.
      // Legacy plans (no schemaVersion) keep their original layout untouched.
      schemaVersion: 2,
    };
    addDailyPlan(plan);
    setActiveId(plan.id);
    setLocalPlan(plan);
  };

  const openPlan = (id: string) => {
    const plan = dailyPlans.find(p => p.id === id);
    if (!plan) return;
    setActiveId(id);

    // List rows now carry length-only placeholder `pairs` — hydrate the full
    // row from the backend and merge any field not already supplied by a
    // restored local draft.
    const mergeFull = (full: DailyPlan | null) => {
      if (!full) return;
      setLocalPlan(prev => {
        if (!prev || prev.id !== id) return prev;
        // Prefer prev (user's in-flight edits / draft) for fields they may
        // have just changed; otherwise fall back to the hydrated value.
        const hasRealPairs = Array.isArray(prev.pairs) && prev.pairs.some(p => p && (p as any).id);
        return {
          ...full,
          ...prev,
          revision: full.revision ?? prev.revision,
          updatedAt: full.updatedAt ?? prev.updatedAt,
          pairs: hasRealPairs ? prev.pairs : full.pairs,
          newsItems: prev.newsItems ?? full.newsItems,
          daySummary: prev.daySummary ?? full.daySummary,
          notesJournal: prev.notesJournal ?? full.notesJournal,
          resultChartImage: prev.resultChartImage ?? full.resultChartImage,
          resultNarrative: prev.resultNarrative ?? full.resultNarrative,
          note: prev.note ?? full.note,
        };
      });
    };

    const base: DailyPlan = { ...plan, pairs: (plan.pairs || []).map(pp => ({ ...pp })) };

    if (authUser?.id && !restoredRef.current.has(id)) {
      const draft = loadDraft<DailyPlan>('dailyPlan', authUser.id, id);
      restoredRef.current.add(id);
      if (draft && draft.savedAt > (Date.parse(plan.updatedAt || '') || 0)) {
        setLocalPlan({ ...draft.data, pairs: draft.data.pairs?.map(pp => ({ ...pp })) || [] });
        toast({ title: 'Draft restored', description: 'Picked up where you left off.' });
        hydrateDailyPlanMedia(id).then(mergeFull);
        return;
      }
    }
    setLocalPlan(base);
    hydrateDailyPlanMedia(id).then(mergeFull);
  };

  const update = (updates: Partial<DailyPlan>) => {
    if (!localPlan) return;
    setLocalPlan({ ...localPlan, ...updates });
  };

  const updatePair = (pairId: string, updates: Partial<DailyPairPlan>) => {
    if (!localPlan) return;
    setLocalPlan({
      ...localPlan,
      pairs: localPlan.pairs.map(p => p.id === pairId ? { ...p, ...updates } : p),
    });
  };

  const addPair = () => {
    if (!localPlan) return;
    update({ pairs: [...localPlan.pairs, emptyPairPlan()] });
  };

  const removePair = (id: string) => {
    if (!localPlan) return;
    update({ pairs: localPlan.pairs.filter(p => p.id !== id) });
  };

  // Autosave: persists to backend (debounced) and snapshots to localStorage for crash recovery.
  // Gated on hydration — if `pairs` still carries length-only placeholders, do
  // NOT save: a race with the hydration round-trip would otherwise wipe real
  // pair data on disk.
  const isHydrated = !localPlan || !localPlan.pairs?.some((p: any) => p && p.__placeholder);
  const { status: saveStatus } = useAutosave<DailyPlan | null>({
    value: localPlan,
    enabled: !!localPlan && !!authUser?.id && isHydrated,
    debounceMs: 1200,
    onSave: async (val) => {
      if (!val || !authUser?.id) return;
      saveDraft('dailyPlan', authUser.id, val, val.id);
      const result = await updateDailyPlan(val);
      if (!result) return val;
      const persisted = { ...val, revision: result.revision, updatedAt: result.updated_at };
      setLocalPlan(current => current?.id === val.id ? { ...current, revision: result.revision, updatedAt: result.updated_at } : current);
      return persisted;
    },
    onSaved: (val) => {
      if (val && authUser?.id) clearDraft('dailyPlan', authUser.id, val.id);
    },
  });

  // Snapshot drafts continuously while typing (independent of debounce).
  useEffect(() => {
    if (!localPlan || !authUser?.id) return;
    const t = setTimeout(() => saveDraft('dailyPlan', authUser.id, localPlan, localPlan.id), 400);
    return () => clearTimeout(t);
  }, [localPlan, authUser?.id]);

  const handleClose = () => {
    setActiveId(null);
    setLocalPlan(null);
  };

  // Parse sessionFocus as potentially comma-separated for multi-select
  const selectedSessions = useMemo(() => {
    if (!localPlan) return [];
    const sf = localPlan.sessionFocus as string;
    return sf ? sf.split(',').map(s => s.trim()).filter(Boolean) : [];
  }, [localPlan?.sessionFocus]);

  const toggleSession = (session: string) => {
    const current = selectedSessions;
    const updated = current.includes(session)
      ? current.filter(s => s !== session)
      : [...current, session];
    update({ sessionFocus: updated.join(', ') as any });
  };

  const dayTrades = useMemo(() => {
    if (!localPlan) return [];
    return trades.filter(t => t.date === localPlan.date);
  }, [localPlan?.date, trades]);

  // List view
  if (!activeId) {
    return (
      <div className="px-3 sm:px-4 py-3 w-full space-y-6 pb-20">
        <PlanListHeader title="Daily Plans" subtitle="Execution-focused daily journal" onNew={startNew} newLabel="New Day" />

        {/* Stats Bar */}
        {dailyPlans.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-mono font-bold text-foreground">{dailyPlans.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Days</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-mono font-bold text-success">{dailyPlans.filter(p => p.tookTrades).length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Trading Days</p>
            </div>
          </div>
        )}

        {loadingDailyPlans ? (
          // Skeleton during initial fetch — fixes the "blank page" race condition where
          // empty state would flash before data hydrated.
          <div className="grid gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : dailyPlans.length === 0 ? (
          <PlanEmptyState
            message="No daily plans yet. Start your first session."
            actionLabel="Create your first plan"
            onAction={startNew}
            icon={<Clock className="h-7 w-7 text-muted-foreground/60" />}
          />
        ) : (
          <div className="grid gap-2">
            {[...dailyPlans].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(plan => (
              <PlanListItem
                key={plan.id}
                onClick={() => openPlan(plan.id)}
                onDelete={() => deleteDailyPlan(plan.id)}
                title={formatDayLabel(plan.date)}
                subtitle={plan.sessionFocus}
                meta={`${plan.pairs.length} pairs`}
                icon={<Crosshair className="h-4 w-4 text-primary" />}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!localPlan) return null;

  return (
    <div className="px-3 sm:px-4 py-3 w-full space-y-5 pb-28">
      <PlanDetailHeader onBack={() => { setActiveId(null); setLocalPlan(null); }} backLabel="All days" />

      {/* Hero Banner - no Neutral badge */}
      <div className="relative rounded-2xl overflow-hidden border border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
        <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-primary">Daily Plan</span>
            </div>
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
              {formatFullDate(localPlan.date)}
            </h1>
          </div>
        </div>
      </div>

      {/* Config Section - removed daily bias */}
      <SectionCard title="Session Config" icon={<Shield className="h-3.5 w-3.5" />} badge="Setup">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Date</Label>
            <Input type="date" value={localPlan.date} onChange={e => update({ date: e.target.value })} className="rounded-lg h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Max Trades</Label>
            <Input type="number" min={1} max={20} value={localPlan.maxTrades} onChange={e => update({ maxTrades: parseInt(e.target.value) || 2 })} className="rounded-lg h-9 text-sm" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Risk Limit</Label>
            <Input value={localPlan.riskLimit} onChange={e => update({ riskLimit: e.target.value })} placeholder="1%" className="rounded-lg h-9 text-sm" />
          </div>
        </div>
        {/* Multi-session select using checkboxes */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Session Focus (multi-select)</Label>
          <div className="flex flex-wrap gap-2">
            {sessions.map(s => (
              <label key={s} className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all',
                selectedSessions.includes(s)
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50'
              )}>
                <Checkbox
                  checked={selectedSessions.includes(s)}
                  onCheckedChange={() => toggleSession(s)}
                  className="h-3 w-3"
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* News */}
      <SectionCard title="News & Events" icon={<Newspaper className="h-3.5 w-3.5" />} accent="warning" badge="Macro">
        <MultiMediaBox
          values={(() => {
            const img = localPlan.newsItems?.[0]?.image;
            if (!img) return [];
            return img.includes('|||') ? img.split('|||').filter(Boolean) : [img];
          })()}
          onChange={vals => {
            const joined = vals.filter(Boolean).join('|||');
            const items = localPlan.newsItems && localPlan.newsItems.length > 0
              ? [{ ...localPlan.newsItems[0], image: joined }]
              : [{ id: crypto.randomUUID(), date: '', event: '', currency: '', impact: 'High' as const, image: joined }];
            update({ newsItems: items });
          }}
          label="Economic Calendar / News Screenshots"
          maxItems={4}
          gridCols={2}
          forceAspect="16/9"
        />
      </SectionCard>

      {/* PAIR CARDS */}
      {localPlan.pairs.map((pp, idx) => (
        <div key={pp.id} className="space-y-4">
          {/* Pair Divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="flex items-center gap-2.5 bg-muted/50 rounded-full px-4 py-2 border border-border/50">
              <span className="font-mono text-[10px] font-bold text-muted-foreground/50">#{idx + 1}</span>
              <Select value={pp.pair || 'none'} onValueChange={v => updatePair(pp.id, { pair: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-[150px] text-sm font-heading font-extrabold border-none shadow-none p-0 h-auto bg-transparent">
                  <SelectValue placeholder="Select Pair" />
                </SelectTrigger>
                <SelectContent>{ALL_ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
              <BiasTag bias={pp.bias} />
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-border via-transparent to-transparent" />
            {localPlan.pairs.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removePair(pp.id)} className="shrink-0 h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Predicted Bias | Actual Bias | Market Sentiment + Market Condition (left) & Market Location (right, v2+) */}
          <SectionCard title="Bias Comparison" icon={<TrendingUp className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Predicted Bias</Label>
                <Select value={pp.bias} onValueChange={v => updatePair(pp.id, { bias: v as any })}>
                  <SelectTrigger className="w-full rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger>
                  <BiasSelectContent />
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actual Bias</Label>
                <Select value={pp.actualBias || 'none'} onValueChange={v => updatePair(pp.id, { actualBias: v === 'none' ? '' : v as DailyPairPlan['actualBias'] })}>
                  <SelectTrigger className="w-full rounded-lg h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <BiasSelectContent includeNone />
                </Select>
              </div>
              {pp.pair !== 'DXY' && (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Market Sentiment</Label>
                  <MarketSentimentSlider value={pp.marketSentiment} onChange={v => updatePair(pp.id, { marketSentiment: v })} />
                </div>
              )}
            </div>

            {/* Bottom row: Market Condition + Market Location (v2+).
                Uses the same Select dropdown as Predicted Bias / Actual Bias for visual consistency. */}
            <div className={cn(
              'grid gap-4 grid-cols-1',
              (localPlan.schemaVersion ?? 1) >= 2 ? 'md:grid-cols-4' : ''
            )}>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Market Condition</Label>
                <Select
                  value={pp.marketCondition ?? 'none'}
                  onValueChange={v => updatePair(pp.id, { marketCondition: v === 'none' ? undefined : (v as any) })}
                >
                  <SelectTrigger className="w-full rounded-lg h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="Trending">📈 Trending</SelectItem>
                    <SelectItem value="Volatile">🌊 Volatile</SelectItem>
                    <SelectItem value="Sideways">➡️ Sideways</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(localPlan.schemaVersion ?? 1) >= 2 && ([
                { key: 'marketLocationDaily', label: 'Daily' },
                { key: 'marketLocation4H', label: '4H' },
                { key: 'marketLocation1H', label: '1H' },
              ] as const).map(({ key, label }) => {
                const current = pp[key] as MarketLocation | undefined;
                return (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Crosshair className="h-3 w-3" /> Market Location · {label}
                    </Label>
                    <Select
                      value={current ?? 'none'}
                      onValueChange={v => updatePair(pp.id, { [key]: v === 'none' ? undefined : (v as MarketLocation) } as Partial<DailyPairPlan>)}
                    >
                      <SelectTrigger className="w-full rounded-lg h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {MARKET_LOCATIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Daily / 4H reference charts — top of Prediction/Result stack (v2+) */}
          {(localPlan.schemaVersion ?? 1) >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <SectionCard title="Daily View" icon={<BarChart3 className="h-3.5 w-3.5" />}>
                <UnifiedMediaBox value={pp.dailyViewImage} onChange={v => updatePair(pp.id, { dailyViewImage: v })} label="Daily View" maxPreviewHeight="336px" />
              </SectionCard>
              <SectionCard title="4H View" icon={<BarChart3 className="h-3.5 w-3.5" />}>
                <UnifiedMediaBox value={pp.fourHViewImage} onChange={v => updatePair(pp.id, { fourHViewImage: v })} label="4H View" maxPreviewHeight="336px" />
              </SectionCard>
            </div>
          )}

          {/* Prediction + Result — side-by-side on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <SectionCard title="Prediction" icon={<Eye className="h-3.5 w-3.5" />} accent="primary">
              <UnifiedMediaBox value={pp.chartImage} onChange={v => updatePair(pp.id, { chartImage: v })} label="Prediction Chart" maxPreviewHeight="336px" />
              <RichJournalBlock
                title="Prediction Notes"
                scope={`daily/${localPlan.id}/pair-${pp.id}/analysis`}
                value={coerceRichJournal(pp.analysisJournal, pp.narrative)}
                onChange={v => updatePair(pp.id, { analysisJournal: serializeJournal(v), narrative: v.text })}
                placeholder="Expected price movement, key reasoning…"
                className="border-0 shadow-none p-0 bg-transparent"
              />
            </SectionCard>

            <SectionCard title="Result" icon={<BarChart3 className="h-3.5 w-3.5" />} accent="success" badge="Post-Session">
              <UnifiedMediaBox value={pp.resultChartImage} onChange={v => updatePair(pp.id, { resultChartImage: v })} label="Result Chart" maxPreviewHeight="336px" />
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Result Notes</Label>
                <RichTextEditor
                  value={pp.resultNarrative || ''}
                  onChange={v => updatePair(pp.id, { resultNarrative: v })}
                  placeholder="What actually happened…"
                  className="font-journal"
                />
              </div>
            </SectionCard>
          </div>
        </div>
      ))}

      {/* Add Pair */}
      <button
        onClick={addPair}
        className="w-full py-3.5 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/[0.03] transition-all flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Add Pair
      </button>

      {/* Trade Activity */}
      <SectionCard title="Trade Activity" icon={<BarChart3 className="h-3.5 w-3.5" />} accent="primary">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Did you take any trade?</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={localPlan.tookTrades === true ? 'default' : 'outline'} onClick={() => update({ tookTrades: true })} className="rounded-lg h-8 text-xs font-semibold px-4">Yes</Button>
              <Button size="sm" variant={localPlan.tookTrades === false ? 'default' : 'outline'} onClick={() => update({ tookTrades: false })} className="rounded-lg h-8 text-xs font-semibold px-4">No</Button>
            </div>
          </div>

          {localPlan.tookTrades === true && (
            dayTrades.length > 0 ? (
              <div className="space-y-2">
                {dayTrades.map(t => (
                  <div key={t.id} className="rounded-lg border border-border/50 bg-muted/20 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-heading font-bold">{t.asset}</span>
                      <span className={cn('text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full',
                        t.result === 'Win' ? 'bg-success/10 text-success' :
                        t.result === 'Loss' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      )}>{t.result}</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px] text-muted-foreground">
                      <div><span className="block text-foreground font-semibold">{t.direction}</span>Direction</div>
                      <div><span className="block text-foreground font-mono">{t.entryPrice}</span>Entry</div>
                      <div><span className="block text-foreground font-mono">{t.stopLoss}</span>SL</div>
                      <div><span className="block text-foreground font-mono">{t.takeProfit}</span>TP</div>
                      <div><span className="block text-foreground font-mono">{t.exitPrice || '—'}</span>Exit</div>
                      <div><span className={cn('block font-mono font-bold', t.profitLoss >= 0 ? 'text-success' : 'text-destructive')}>${t.profitLoss.toFixed(2)}</span>P/L</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No trades found for {localPlan.date}.</p>
            )
          )}
          {localPlan.tookTrades === false && (
            <p className="text-sm text-muted-foreground italic">No trades taken today.</p>
          )}
        </div>
      </SectionCard>

      {/* Day Summary - Notion */}
      <SectionCard title="Day Summary" icon={<BarChart3 className="h-3.5 w-3.5" />} accent="success" badge="Review">
        <RichJournalBlock
          title="Summary"
          scope={`daily/${localPlan.id}/summary`}
          value={coerceRichJournal((localPlan as DailyPlan).daySummary, localPlan.resultNarrative)}
          onChange={v => update({ daySummary: serializeJournal(v), resultNarrative: v.text } as Partial<DailyPlan>)}
          placeholder="What happened in the market today…"
          className="border-0 shadow-none p-0 bg-transparent"
        />
      </SectionCard>

      {/* Notes - Notion */}
      <SectionCard title="Notes" icon={<StickyNote className="h-3.5 w-3.5" />}>
        <RichJournalBlock
          title="Notes"
          scope={`daily/${localPlan.id}/notes`}
          value={coerceRichJournal((localPlan as DailyPlan).notesJournal, localPlan.note)}
          onChange={v => update({ notesJournal: serializeJournal(v), note: v.text } as Partial<DailyPlan>)}
          placeholder="Final thoughts, screenshots, video clips…"
          className="border-0 shadow-none p-0 bg-transparent"
        />
      </SectionCard>

      {/* Daily Review Video — Google Drive embed (lazy-loaded) */}
      <SectionCard title="Daily Review Video" icon={<Video className="h-3.5 w-3.5" />} accent="success" badge="Review">
        <DailyReviewVideo
          value={localPlan.reviewVideo ?? null}
          onChange={(v) => update({ reviewVideo: v } as Partial<DailyPlan>)}
        />
      </SectionCard>

      <AIInsightsPanel page="Daily Plan" payload={adaptDailyPlan(localPlan, dayTrades)} />


      {/* Sticky autosave status — Notion-style */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 px-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/95 border border-border/60 shadow-lg backdrop-blur">
          <SaveStatusIndicator status={saveStatus} />
          <span className="h-3 w-px bg-border/60" />
          <Button onClick={handleClose} size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1">
            <ArrowLeft className="h-3 w-3" /> Back
          </Button>
        </div>
      </div>
    </div>
  );
}
