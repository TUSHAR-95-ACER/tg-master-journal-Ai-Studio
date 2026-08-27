import { useState, useEffect, useRef } from 'react';
import { BiasBadge, BiasSelectContent } from '@/components/shared/BiasBadge';
import { MultiMediaBox } from '@/components/shared/MultiMediaBox';
import { useTrading } from '@/contexts/TradingContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoExpandTextarea } from '@/components/shared/AutoExpandTextarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Calendar, Shield, BarChart3, TrendingUp, Eye, Save, Newspaper, NotebookPen, ArrowLeft, Video } from 'lucide-react';
import { DailyReviewVideo } from '@/components/plans/DailyReviewVideo';
import { loadUserStorage, saveUserStorage } from '@/lib/userStorage';
import type { DailyReviewVideo as DailyReviewVideoMeta } from '@/types/trading';
import { WeeklyPlan, PairAnalysis, ALL_ASSETS } from '@/types/trading';
import { cn } from '@/lib/utils';
import { UnifiedMediaBox } from '@/components/shared/UnifiedMediaBox';
import { RichJournalBlock } from '@/components/shared/RichJournalBlock';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { coerceRichJournal, emptyJournal, serializeJournal } from '@/lib/journalData';
import { PlanListHeader, PlanDetailHeader, PlanEmptyState } from '@/components/plans/PlanHeader';
import { PlanListItem } from '@/components/plans/PlanListItem';
import { toast } from '@/hooks/use-toast';
import { AIInsightsPanel } from '@/components/shared/AIInsightsPanel';
import { adaptWeeklyPlan } from '@/lib/aiInsightAdapters';
import { useAutosave } from '@/hooks/useAutosave';
import { SaveStatusIndicator } from '@/components/shared/SaveStatusIndicator';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draftStorage';

const emptyPairAnalysis = (): PairAnalysis => ({
  id: crypto.randomUUID(),
  pair: '',
  bias: 'Neutral',
  setupFocus: '',
  reasons: [],
  keyLevels: '',
  narrative: '',
  expectedDirection: 'Buy',
  actualDirection: '',
  actualResult: '',
  note: '',
});

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const weekNum = Math.ceil(day / 7);
  return `Week ${weekNum} ${month}`;
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${start.getFullYear()}`;
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

export default function WeeklyPlanPage() {
  const { weeklyPlans, addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan, loadingWeeklyPlans, hydrateWeeklyPlanMedia } = useTrading();
  const { user: authUser } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localPlan, setLocalPlan] = useState<WeeklyPlan | null>(null);
  const [marketsRaw, setMarketsRaw] = useState<string>('');
  const [reviewVideo, setReviewVideo] = useState<DailyReviewVideoMeta | null>(null);

  // Load Weekly Review Video from local user storage keyed by weekStart
  useEffect(() => {
    if (!authUser?.id || !localPlan?.weekStart) { setReviewVideo(null); return; }
    setReviewVideo(loadUserStorage<DailyReviewVideoMeta | null>(`weeklyReviewVideo:${localPlan.weekStart}`, authUser.id, null));
  }, [authUser?.id, localPlan?.weekStart]);
  useEffect(() => {
    if (!authUser?.id || !localPlan?.weekStart) return;
    saveUserStorage(`weeklyReviewVideo:${localPlan.weekStart}`, authUser.id, reviewVideo);
  }, [authUser?.id, localPlan?.weekStart, reviewVideo]);

  // Sync raw markets input when switching plans
  useEffect(() => {
    if (localPlan) setMarketsRaw(localPlan.markets.join(', '));
    else setMarketsRaw('');
    // Only resync when the plan identity changes, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPlan?.id]);
  const restoredRef = useRef<Set<string>>(new Set());

  const startNew = () => {
    const plan: WeeklyPlan = {
      id: crypto.randomUUID(),
      weekStart: new Date().toISOString().split('T')[0],
      bias: '',
      markets: [],
      setups: [],
      levels: '',
      risk: '',
      goals: '',
      pairAnalyses: [emptyPairAnalysis()],
      newsItems: [],
      newsResult: '',
      analysisVideoUrl: '',
    };
    addWeeklyPlan(plan);
    setActiveId(plan.id);
    setLocalPlan(plan);
  };

  const openPlan = (id: string) => {
    const plan = weeklyPlans.find(p => p.id === id);
    if (!plan) return;
    setActiveId(id);

    // The list-view row has placeholder pairAnalyses (length-only); fetch the
    // full plan in the background and patch state once it arrives.
    const applyFull = (full: WeeklyPlan | null) => {
      if (!full) return;
      setLocalPlan(prev => {
        if (!prev || prev.id !== id) return prev;
        const hasRealPairs = Array.isArray(prev.pairAnalyses) && prev.pairAnalyses.some(p => p && (p as any).id);
        return {
          ...full,
          ...prev,
          revision: full.revision ?? prev.revision,
          updatedAt: full.updatedAt ?? prev.updatedAt,
          pairAnalyses: hasRealPairs ? prev.pairAnalyses : full.pairAnalyses,
          newsItems: prev.newsItems ?? full.newsItems,
          observation: (prev as any).observation ?? (full as any).observation,
          calendarResult: (prev as any).calendarResult ?? (full as any).calendarResult,
        };
      });
    };

    if (authUser?.id && !restoredRef.current.has(id)) {
      const draft = loadDraft<WeeklyPlan>('weeklyPlan', authUser.id, id);
      restoredRef.current.add(id);
      if (draft && draft.savedAt > (Date.parse(plan.updatedAt || '') || 0)) {
        setLocalPlan({ ...draft.data, pairAnalyses: draft.data.pairAnalyses?.map(pa => ({ ...pa })) || [] });
        toast({ title: 'Draft restored', description: 'Picked up where you left off.' });
        // still hydrate so non-draft fields stay accurate
        hydrateWeeklyPlanMedia(id).then(applyFull);
        return;
      }
    }
    const base: WeeklyPlan = { ...plan, pairAnalyses: (plan.pairAnalyses || []).map(pa => ({ ...pa })) };
    setLocalPlan(base);
    hydrateWeeklyPlanMedia(id).then(applyFull);
  };

  const update = (updates: Partial<WeeklyPlan>) => {
    if (!localPlan) return;
    setLocalPlan({ ...localPlan, ...updates });
  };

  const updatePair = (pairId: string, updates: Partial<PairAnalysis>) => {
    if (!localPlan) return;
    setLocalPlan({
      ...localPlan,
      pairAnalyses: localPlan.pairAnalyses.map(p => p.id === pairId ? { ...p, ...updates } : p),
    });
  };

  const addPair = () => {
    if (!localPlan) return;
    update({ pairAnalyses: [...localPlan.pairAnalyses, emptyPairAnalysis()] });
  };

  const removePair = (id: string) => {
    if (!localPlan) return;
    update({ pairAnalyses: localPlan.pairAnalyses.filter(p => p.id !== id) });
  };

  // Block autosave while the open plan still contains hydration placeholders
  // (length-only synthesized pair_analyses). Otherwise a race between the
  // 1.2s debounce and the hydration round-trip could wipe real pair data.
  const isHydrated = !localPlan || !localPlan.pairAnalyses?.some((p: any) => p && p.__placeholder);
  const { status: saveStatus } = useAutosave<WeeklyPlan | null>({
    value: localPlan,
    enabled: !!localPlan && !!authUser?.id && isHydrated,
    debounceMs: 1200,
    onSave: async (val) => {
      if (!val || !authUser?.id) return;
      saveDraft('weeklyPlan', authUser.id, val, val.id);
      const result = await updateWeeklyPlan(val);
      if (!result) return val;
      const persisted = { ...val, revision: result.revision, updatedAt: result.updated_at };
      setLocalPlan(current => current?.id === val.id ? { ...current, revision: result.revision, updatedAt: result.updated_at } : current);
      return persisted;
    },
    onSaved: (val) => {
      if (val && authUser?.id) clearDraft('weeklyPlan', authUser.id, val.id);
    },
  });

  useEffect(() => {
    if (!localPlan || !authUser?.id) return;
    const t = setTimeout(() => saveDraft('weeklyPlan', authUser.id, localPlan, localPlan.id), 400);
    return () => clearTimeout(t);
  }, [localPlan, authUser?.id]);

  const handleClose = () => {
    setActiveId(null);
    setLocalPlan(null);
  };

  // List view
  if (!activeId) {
    return (
      <div className="px-3 sm:px-4 py-3 w-full space-y-6 pb-20">
        <PlanListHeader title="Weekly Plans" subtitle="Strategic market analysis & bias journal" onNew={startNew} newLabel="New Week" />

        {/* Stats Bar */}
        {weeklyPlans.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-mono font-bold text-foreground">{weeklyPlans.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Weeks</p>
            </div>
          </div>
        )}

        {loadingWeeklyPlans ? (
          <div className="grid gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : weeklyPlans.length === 0 ? (
          <PlanEmptyState
            message="No weekly plans yet. Start your first analysis."
            actionLabel="Create your first plan"
            onAction={startNew}
            icon={<Calendar className="h-7 w-7 text-muted-foreground/60" />}
          />
        ) : (
          <div className="grid gap-2">
            {[...weeklyPlans].sort((a, b) => (b.weekStart || '').localeCompare(a.weekStart || '')).map(plan => (
              <PlanListItem
                key={plan.id}
                onClick={() => openPlan(plan.id)}
                onDelete={() => deleteWeeklyPlan(plan.id)}
                title={formatWeekLabel(plan.weekStart)}
                subtitle={plan.markets.length > 0 ? plan.markets.slice(0, 4).join(' · ') : undefined}
                meta={`${plan.pairAnalyses.length} pairs`}
                icon={<BarChart3 className="h-4 w-4 text-primary" />}
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
      <PlanDetailHeader onBack={() => { setActiveId(null); setLocalPlan(null); }} backLabel="All weeks" />

      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-primary">Weekly Plan</span>
          </div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            {formatWeekLabel(localPlan.weekStart)}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{formatWeekRange(localPlan.weekStart)}</p>
        </div>
      </div>

      {/* Config */}
      <SectionCard title="Week Config" icon={<Shield className="h-3.5 w-3.5" />} badge="Setup">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Week Starting</Label>
            <Input type="date" value={localPlan.weekStart} onChange={e => update({ weekStart: e.target.value })} className="rounded-lg h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Markets Focus</Label>
            <Input
              value={marketsRaw}
              onChange={e => {
                const raw = e.target.value;
                setMarketsRaw(raw);
                // Accept any of: , . / - | : ; ( ) ' and whitespace as separators
                const tokens = raw.split(/[,./\-|:;()'\s]+/).map(s => s.trim()).filter(Boolean);
                update({ markets: tokens });
              }}
              placeholder="EURUSD, XAUUSD, NAS100"
              className="rounded-lg h-9 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Risk Plan</Label>
          <AutoExpandTextarea value={localPlan.risk} onChange={e => update({ risk: e.target.value })} className="text-sm" placeholder="Max 2% per trade, 5% daily drawdown..." minRows={2} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Weekly Goals</Label>
          <AutoExpandTextarea value={localPlan.goals} onChange={e => update({ goals: e.target.value })} className="text-sm" placeholder="Focus on A+ setups only, max 3 trades per day..." minRows={2} />
        </div>
      </SectionCard>

      {/* Economic Calendar */}
      <SectionCard title="Economic Calendar" icon={<Newspaper className="h-3.5 w-3.5" />} accent="warning" badge="News">
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
          label="Forex Factory / Economic Calendar"
          maxItems={4}
          gridCols={2}
          forceAspect="16/9"
        />
      </SectionCard>

      {/* PAIR ANALYSES */}
      {localPlan.pairAnalyses.map((pa, idx) => (
        <div key={pa.id} className="space-y-4">
          {/* Pair Divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="flex items-center gap-2.5 bg-muted/50 rounded-full px-4 py-2 border border-border/50">
              <span className="font-mono text-[10px] font-bold text-muted-foreground/50">#{idx + 1}</span>
              <Select value={pa.pair || 'none'} onValueChange={v => updatePair(pa.id, { pair: v === 'none' ? '' : v })}>
                <SelectTrigger className="w-[150px] text-sm font-heading font-extrabold border-none shadow-none p-0 h-auto bg-transparent">
                  <SelectValue placeholder="Select Pair" />
                </SelectTrigger>
                <SelectContent>{ALL_ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
              <BiasTag bias={pa.bias} />
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-border via-transparent to-transparent" />
            {localPlan.pairAnalyses.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removePair(pa.id)} className="shrink-0 h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Predicted Bias vs Actual Bias — placed BEFORE charts */}
          <SectionCard title="Bias Comparison" icon={<TrendingUp className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Predicted Bias</Label>
                <Select value={pa.bias} onValueChange={v => updatePair(pa.id, { bias: v as PairAnalysis['bias'] })}>
                  <SelectTrigger className="w-full rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger>
                  <BiasSelectContent />
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actual Bias</Label>
                <Select value={pa.actualBias || 'none'} onValueChange={v => updatePair(pa.id, { actualBias: v === 'none' ? '' : v as PairAnalysis['actualBias'] })}>
                  <SelectTrigger className="w-full rounded-lg h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <BiasSelectContent includeNone />
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* Chart Analysis - exact 50/50 desktop split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <SectionCard title="Prediction" icon={<Eye className="h-3.5 w-3.5" />} accent="primary">
              <UnifiedMediaBox value={pa.chartImage} onChange={v => updatePair(pa.id, { chartImage: v })} label="Prediction Chart" maxPreviewHeight="336px" />
              <RichJournalBlock
                title="Prediction Notes"
                scope={`weekly/${localPlan.id}/pair-${pa.id}/analysis`}
                value={coerceRichJournal(pa.analysisJournal, pa.narrative, undefined)}
                onChange={v => updatePair(pa.id, { analysisJournal: serializeJournal(v), narrative: v.text })}
                placeholder="Liquidity zones, order flow expectations, key reasoning…"
                className="border-0 shadow-none p-0 bg-transparent"
              />
            </SectionCard>

            <SectionCard title="Result" icon={<BarChart3 className="h-3.5 w-3.5" />} accent="success" badge="Post-Week">
              <UnifiedMediaBox value={pa.resultChartImage} onChange={v => updatePair(pa.id, { resultChartImage: v })} label="Result Chart" maxPreviewHeight="336px" />
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Result Notes</Label>
                <RichTextEditor
                  value={pa.note || ''}
                  onChange={v => updatePair(pa.id, { note: v })}
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
        <Plus className="h-4 w-4" /> Add Pair Analysis
      </button>

      {/* Observation - Notion-style block */}
      <SectionCard title="Observation" icon={<NotebookPen className="h-3.5 w-3.5" />} accent="primary" badge="Journal">
        <RichJournalBlock
          title="Weekly Observation"
          scope={`weekly/${localPlan.id}/observation`}
          value={coerceRichJournal((localPlan as WeeklyPlan).observation)}
          onChange={v => update({ observation: serializeJournal(v) } as Partial<WeeklyPlan>)}
          placeholder="Planning notes, market observations, annotated charts…"
          className="border-0 shadow-none p-0 bg-transparent"
        />
      </SectionCard>

      {/* Calendar Result - Notion-style block */}
      <SectionCard title="Calendar Result" icon={<Calendar className="h-3.5 w-3.5" />} accent="warning" badge="Post-Week">
        <RichJournalBlock
          title="Reflection & Media"
          scope={`weekly/${localPlan.id}/calendar-result`}
          value={coerceRichJournal((localPlan as WeeklyPlan).calendarResult, localPlan.newsResult, undefined)}
          onChange={v => update({ calendarResult: serializeJournal(v), newsResult: v.text } as Partial<WeeklyPlan>)}
          placeholder="Which events impacted the market? Was the reaction expected?"
          className="border-0 shadow-none p-0 bg-transparent"
        />
      </SectionCard>

      {/* Weekly Review Video — Google Drive embed (reuses DailyReviewVideo component). */}
      <SectionCard title="Weekly Review Video" icon={<Video className="h-3.5 w-3.5" />} accent="success" badge="Review">
        <DailyReviewVideo value={reviewVideo} onChange={setReviewVideo} />
      </SectionCard>

      <AIInsightsPanel page="Weekly Plan" payload={adaptWeeklyPlan(localPlan)} />


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
