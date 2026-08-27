import { useMemo, useState, useEffect } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, MetricCard } from '@/components/shared/MetricCard';
import { ChartHeader } from '@/components/shared/InfoTooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, Trophy, Target, Brain, BarChart3, ChevronLeft, ChevronRight, Sparkles, Loader2, Video } from 'lucide-react';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { loadUserStorage, saveUserStorage } from '@/lib/userStorage';
import { AIInsightsPanel } from '@/components/shared/AIInsightsPanel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DailyReviewVideo } from '@/components/plans/DailyReviewVideo';
import type { DailyReviewVideo as DailyReviewVideoMeta } from '@/types/trading';

type WeeklyReviewNotes = {
  weeklyNarrative: string;
  reflection: string;
  lessons: string;
  mistakes: string;
  improvements: string;
  aiReview: string;
};

const emptyReviewNotes = (): WeeklyReviewNotes => ({
  weeklyNarrative: '',
  reflection: '',
  lessons: '',
  mistakes: '',
  improvements: '',
  aiReview: '',
});

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</p>
      ))}
    </div>
  );
};

function getWeekName(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  const weekNum = Math.ceil(day / 7);
  return `Week ${weekNum} ${month}`;
}

function calcExecutionScore(t: any): number {
  let score = 50;
  if (t.psychology?.checklist?.followPlan) score += 10;
  if (t.psychology?.checklist?.riskRespected) score += 10;
  if (t.psychology?.checklist?.waitedConfirmation) score += 10;
  if (t.psychology?.checklist?.noFomo) score += 10;
  if (t.psychology?.checklist?.noRevenge) score += 10;
  return Math.min(100, score);
}

export default function WeeklyReview() {
  const { trades, weeklyPlans } = useTrading();
  const { user } = useAuth();
  const valid = useMemo(() => trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'), [trades]);

  const weeklyData = useMemo(() => {
    const weeks = new Map<string, typeof valid>();
    valid.forEach(t => {
      const d = new Date(t.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      const arr = weeks.get(key) || [];
      arr.push(t);
      weeks.set(key, arr);
    });
    return Array.from(weeks.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, wt]) => {
        const wins = wt.filter(t => t.result === 'Win').length;
        const losses = wt.filter(t => t.result === 'Loss').length;
        const pl = wt.reduce((s, t) => s + t.profitLoss, 0);
        const avgRR = wt.filter(t => t.actualRR !== undefined).reduce((s, t) => s + (t.actualRR || 0), 0) / (wt.filter(t => t.actualRR !== undefined).length || 1);
        const winRate = wt.length ? (wins / wt.length) * 100 : 0;
        const setups = [...new Set(wt.map(t => t.setup))];
        
        const setupStats = setups.map(s => {
          const st = wt.filter(t => t.setup === s);
          return { name: s, pl: st.reduce((ss, t) => ss + t.profitLoss, 0), count: st.length, winRate: st.length ? (st.filter(t => t.result === 'Win').length / st.length * 100) : 0 };
        });
        const bestSetup = setupStats.reduce((best, s) => s.pl > (best?.pl || -Infinity) ? s : best, setupStats[0]);
        const worstSetup = setupStats.reduce((worst, s) => s.pl < (worst?.pl || Infinity) ? s : worst, setupStats[0]);

        const mistakes = wt.flatMap(t => t.mistakes);
        const avgExec = wt.length ? Math.round(wt.reduce((s, t) => s + calcExecutionScore(t), 0) / wt.length) : 0;

        // Behavior analysis
        const emotionalTrades = wt.filter(t => t.psychology?.emotion && ['Fearful', 'Greedy', 'Frustrated', 'Anxious'].includes(t.psychology.emotion)).length;
        const avgDiscipline = wt.filter(t => t.psychology?.discipline).length > 0
          ? Math.round(wt.filter(t => t.psychology?.discipline).reduce((s, t) => s + (t.psychology?.discipline || 0), 0) / wt.filter(t => t.psychology?.discipline).length * 20)
          : 0;
        
        // Days traded
        const tradingDays = new Set(wt.map(t => t.date)).size;
        const tradesPerDay = tradingDays > 0 ? Math.round(wt.length / tradingDays * 10) / 10 : 0;
        const overtrading = tradesPerDay > 3;

        // Bias accuracy from weekly plans - match by date range
        const weekEnd = new Date(week);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const matchingPlan = weeklyPlans.find(wp => {
          const wpStart = new Date(wp.weekStart);
          const wpEnd = new Date(wpStart);
          wpEnd.setDate(wpEnd.getDate() + 6);
          const tradeWeekStart = new Date(week);
          // Plans match if their weeks overlap
          return Math.abs(tradeWeekStart.getTime() - wpStart.getTime()) <= 3 * 24 * 60 * 60 * 1000;
        });
        let biasAccuracy = 0;
        if (matchingPlan) {
          const analyzed = matchingPlan.pairAnalyses.filter(pa => pa.actualDirection && pa.actualDirection !== '' as any);
          if (analyzed.length > 0) {
            const correct = analyzed.filter(pa => pa.bias === pa.actualDirection);
            biasAccuracy = Math.round((correct.length / analyzed.length) * 100);
          } else if (matchingPlan.bias) {
            // Fallback: check overall weekly bias vs pair results
            const pairsWithResult = matchingPlan.pairAnalyses.filter(pa => pa.actualResult && pa.actualResult !== '' as any);
            if (pairsWithResult.length > 0) {
              const winsAligned = pairsWithResult.filter(pa => pa.actualResult === 'Win').length;
              biasAccuracy = Math.round((winsAligned / pairsWithResult.length) * 100);
            } else {
              // Check if any trades this week align with the overall bias
              const biasDir = matchingPlan.bias.toLowerCase();
              const aligned = wt.filter(t => {
                if (biasDir === 'bullish' && t.direction === 'Long' && t.result === 'Win') return true;
                if (biasDir === 'bearish' && t.direction === 'Short' && t.result === 'Win') return true;
                return false;
              });
              biasAccuracy = wt.length > 0 ? Math.round((aligned.length / wt.length) * 100) : 0;
            }
          }
        }

        // Best/worst pair
        const pairMap = new Map<string, number>();
        wt.forEach(t => pairMap.set(t.asset, (pairMap.get(t.asset) || 0) + t.profitLoss));
        const pairEntries = [...pairMap.entries()];
        const bestPair = pairEntries.sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        const worstPair = pairEntries.sort((a, b) => a[1] - b[1])[0]?.[0] || '-';

        const sessMap = new Map<string, number>();
        wt.forEach(t => sessMap.set(t.session, (sessMap.get(t.session) || 0) + t.profitLoss));
        const sessEntries = [...sessMap.entries()];
        const bestSession = sessEntries.sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        const worstSession = sessEntries.sort((a, b) => a[1] - b[1])[0]?.[0] || '-';

        return {
          week, weekName: getWeekName(week), trades: wt.length, wins, losses, pl,
          avgRR: Math.round(avgRR * 100) / 100,
          winRate: Math.round(winRate * 10) / 10,
          bestSetup, worstSetup,
          mistakeCount: mistakes.length,
          topMistake: mistakes.length ? [...new Set(mistakes)].sort((a, b) => mistakes.filter(m => m === b).length - mistakes.filter(m => m === a).length)[0] : '-',
          avgExec, biasAccuracy, bestPair, worstPair, bestSession, worstSession,
          emotionalTrades, avgDiscipline, tradesPerDay, overtrading, tradingDays,
        };
      });
  }, [valid, weeklyPlans]);

  // Selected week index — defaults to the most recent week. Lets the trader
  // step back through prior weeks for review without losing chart context.
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  useEffect(() => {
    if (weeklyData.length === 0) { setSelectedIdx(-1); return; }
    // Snap to the latest week when data is first loaded or when new weeks arrive.
    setSelectedIdx(prev => (prev < 0 || prev >= weeklyData.length ? weeklyData.length - 1 : prev));
  }, [weeklyData.length]);

  const latest = selectedIdx >= 0 ? weeklyData[selectedIdx] : weeklyData[weeklyData.length - 1];
  const prevWeek = selectedIdx > 0 ? weeklyData[selectedIdx - 1] : undefined;
  const canPrev = selectedIdx > 0;
  const canNext = selectedIdx >= 0 && selectedIdx < weeklyData.length - 1;
  const plTrend = weeklyData.map(w => ({ name: w.weekName, pl: w.pl }));
  const [reviewNotes, setReviewNotes] = useState<WeeklyReviewNotes>(emptyReviewNotes);
  const [reviewVideo, setReviewVideo] = useState<DailyReviewVideoMeta | null>(null);

  useEffect(() => {
    if (!user?.id || !latest?.week) {
      setReviewNotes(emptyReviewNotes());
      setReviewVideo(null);
      return;
    }
    setReviewNotes(loadUserStorage<WeeklyReviewNotes>(`weeklyReviewNotes:${latest.week}`, user.id, emptyReviewNotes()));
    setReviewVideo(loadUserStorage<DailyReviewVideoMeta | null>(`weeklyReviewVideo:${latest.week}`, user.id, null));
  }, [user?.id, latest?.week]);

  useEffect(() => {
    if (!user?.id || !latest?.week) return;
    const t = setTimeout(() => saveUserStorage(`weeklyReviewNotes:${latest.week}`, user.id, reviewNotes), 300);
    return () => clearTimeout(t);
  }, [user?.id, latest?.week, reviewNotes]);

  useEffect(() => {
    if (!user?.id || !latest?.week) return;
    saveUserStorage(`weeklyReviewVideo:${latest.week}`, user.id, reviewVideo);
  }, [user?.id, latest?.week, reviewVideo]);

  const updateReviewNote = (field: keyof WeeklyReviewNotes, value: string) => {
    setReviewNotes(prev => ({ ...prev, [field]: value }));
  };

  // ─── AI auto-generation ───────────────────────────────────────────
  const [aiBusy, setAiBusy] = useState(false);
  const generateWithAI = async (silent = false) => {
    if (!latest?.week || aiBusy) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-review-generate', {
        body: { weekStart: latest.week },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = data as WeeklyReviewNotes;
      setReviewNotes({
        weeklyNarrative: r.weeklyNarrative || '',
        reflection: r.reflection || '',
        lessons: r.lessons || '',
        mistakes: r.mistakes || '',
        improvements: r.improvements || '',
        aiReview: r.aiReview || '',
      });
      if (!silent) toast({ title: '✨ Weekly review generated', description: 'AI populated all sections from this week\'s journal.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate';
      if (!silent) toast({ title: 'AI generation failed', description: msg.slice(0, 160), variant: 'destructive' });
    } finally {
      setAiBusy(false);
    }
  };

  // Auto-generate on first visit to ANY week that has data but no review yet.
  // This ensures historical weeks populate automatically — no need to wait for Sunday.
  // Guarded per-week in localStorage so we never overwrite a user's edits.
  useEffect(() => {
    if (!user?.id || !latest?.week) return;
    if (aiBusy) return;
    const allEmpty = Object.values(reviewNotes).every(v => !v || !v.trim());
    if (!allEmpty) return;
    // Only auto-generate when there is actually something to review for this week.
    const hasData = latest.trades > 0;
    if (!hasData) return;
    const guardKey = `wr-auto:${latest.week}`;
    const already = loadUserStorage<boolean>(guardKey, user.id, false);
    if (already) return;
    saveUserStorage(guardKey, user.id, true);
    void generateWithAI(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, latest?.week, reviewNotes]);

  // Insights
  const insights = useMemo(() => {
    if (!latest) return [];
    const result: string[] = [];

    if (latest.overtrading) result.push(`⚠️ You averaged ${latest.tradesPerDay} trades/day this week. Consider reducing to improve quality.`);
    if (latest.emotionalTrades > 0) result.push(`🧠 ${latest.emotionalTrades} trades were taken under emotional states. Focus on discipline.`);
    if (latest.topMistake !== '-') result.push(`🔁 Your most repeated mistake: "${latest.topMistake}". Work on eliminating this pattern.`);
    if (latest.bestSetup && latest.bestSetup.pl > 0) result.push(`✅ Best setup: "${latest.bestSetup.name}" with ${formatCurrency(latest.bestSetup.pl)} profit.`);
    if (latest.worstSetup && latest.worstSetup.pl < 0) result.push(`❌ Worst setup: "${latest.worstSetup.name}" with ${formatCurrency(latest.worstSetup.pl)}. Review or stop trading it.`);

    if (prevWeek) {
      if (latest.pl > prevWeek.pl) result.push(`📈 P/L improved from ${formatCurrency(prevWeek.pl)} to ${formatCurrency(latest.pl)} compared to the previous week.`);
      if (latest.winRate > prevWeek.winRate) result.push(`📊 Win rate improved: ${prevWeek.winRate}% → ${latest.winRate}%`);
    }

    return result;
  }, [latest, prevWeek]);

  return (
    <div className="px-3 sm:px-4 py-3 w-full space-y-6">
      <PageHeader title="Weekly Review" subtitle="Auto-generated weekly performance reports with behavioral insights">
        <Button size="sm" className="gap-1.5" onClick={() => generateWithAI(false)} disabled={aiBusy || !latest}>
          {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {aiBusy ? 'Generating…' : 'Generate with AI'}
        </Button>
      </PageHeader>

      {latest ? (
        <>
          {/* Week navigator — step through previous weeks for review */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!canPrev}
              onClick={() => setSelectedIdx(i => Math.max(0, (i < 0 ? weeklyData.length - 1 : i) - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous week
            </Button>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Viewing</p>
              <p className="text-sm font-bold font-heading">
                {latest.weekName}
                {selectedIdx === weeklyData.length - 1 && (
                  <span className="ml-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-primary">Current</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!canNext}
              onClick={() => setSelectedIdx(i => Math.min(weeklyData.length - 1, (i < 0 ? weeklyData.length - 1 : i) + 1))}
            >
              Next week <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Top Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Total Trades" value={latest.trades} tooltip="Number of trades taken this week" />
            <MetricCard label="Win Rate" value={`${latest.winRate}%`} trend={latest.winRate >= 50 ? 'up' : 'down'} tooltip="Win percentage" />
            <MetricCard label="Net P/L" value={formatCurrency(latest.pl)} trend={latest.pl >= 0 ? 'up' : 'down'} tooltip="Total profit/loss" />
            <MetricCard label="Avg RR" value={latest.avgRR.toFixed(2)} tooltip="Average risk-reward ratio" />
            <MetricCard label="Execution" value={`${latest.avgExec}%`} trend={latest.avgExec >= 70 ? 'up' : 'down'} tooltip="Execution quality score" />
            <MetricCard label="Bias Accuracy" value={`${latest.biasAccuracy}%`} trend={latest.biasAccuracy >= 50 ? 'up' : 'down'} tooltip="How often your bias was correct" />
          </div>

          {/* Performance + Behavior Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Best & Worst Setup */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" /> Best & Worst Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latest.bestSetup && (
                  <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span className="text-sm font-semibold text-foreground">{latest.bestSetup.name}</span>
                      </div>
                      <span className="text-sm font-bold font-mono text-success">{formatCurrency(latest.bestSetup.pl)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{latest.bestSetup.count} trades • {latest.bestSetup.winRate.toFixed(0)}% win rate</p>
                  </div>
                )}
                {latest.worstSetup && latest.worstSetup.pl < 0 && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-semibold text-foreground">{latest.worstSetup.name}</span>
                      </div>
                      <span className="text-sm font-bold font-mono text-destructive">{formatCurrency(latest.worstSetup.pl)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{latest.worstSetup.count} trades • {latest.worstSetup.winRate.toFixed(0)}% win rate</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Behavior Analysis */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                  <Brain className="h-3.5 w-3.5 text-purple-500" /> Behavior Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Trades/Day</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-sm font-bold font-mono", latest.overtrading ? "text-destructive" : "text-foreground")}>{latest.tradesPerDay}</span>
                    {latest.overtrading && <Badge variant="destructive" className="text-[8px] h-4">OVERTRADING</Badge>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Emotional Trades</span>
                  <span className={cn("text-sm font-bold font-mono", latest.emotionalTrades > 0 ? "text-warning" : "text-success")}>{latest.emotionalTrades}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Discipline Score</span>
                  <span className={cn("text-sm font-bold font-mono", latest.avgDiscipline >= 70 ? "text-success" : latest.avgDiscipline >= 50 ? "text-warning" : "text-destructive")}>{latest.avgDiscipline}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Trading Days</span>
                  <span className="text-sm font-bold font-mono text-foreground">{latest.tradingDays}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Best Pair</span>
                  <span className="text-sm font-semibold text-success">{latest.bestPair}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Worst Pair</span>
                  <span className="text-sm font-semibold text-destructive">{latest.worstPair}</span>
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5 uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Lightbulb className="h-3.5 w-3.5" /> AI Weekly Insight
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.length > 0 ? (
                  <div className="space-y-2">
                    {insights.map((insight, i) => (
                      <p key={i} className="text-xs text-foreground/80 leading-relaxed">{insight}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Complete more trades to generate weekly insights.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <ChartHeader title="Weekly P/L Trend" tooltip="How your weekly profit/loss has been trending" />
                <div className="h-[192px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={plTrend}>
                      <defs>
                        <linearGradient id="plGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip content={<Tip />} />
                      <Area type="monotone" dataKey="pl" name="P/L" stroke="hsl(var(--primary))" fill="url(#plGrad)" strokeWidth={2} baseValue="dataMin" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <ChartHeader title="Win Rate by Week" tooltip="Weekly win rate comparison" />
                <div className="h-[192px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData.map(w => ({ name: w.weekName, winRate: w.winRate }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="winRate" name="Win %" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rich weekly review notes — full editor controls, page scroll only */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {[
              ['weeklyNarrative', 'Weekly Narrative', 'Market story, weekly context, and key themes…'],
              ['reflection', 'Reflection', 'How did you execute this week?'],
              ['lessons', 'Lessons', 'Lessons to carry into next week…'],
              ['mistakes', 'Mistakes', 'Mistakes, leaks, and repeated behaviors…'],
              ['improvements', 'Improvements', 'Concrete process improvements…'],
              ['aiReview', 'AI Review', 'Paste or refine AI review notes here…'],
            ].map(([field, title, placeholder]) => (
              <Card key={field} className="overflow-visible">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RichTextEditor
                    value={reviewNotes[field as keyof WeeklyReviewNotes]}
                    onChange={v => updateReviewNote(field as keyof WeeklyReviewNotes, v)}
                    placeholder={placeholder}
                    className="font-journal"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Weekly Review Video moved to Weekly Plan page. */}



          {/* All Weeks Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground">Week</th>
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground font-mono">Trades</th>
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground font-mono">Win Rate</th>
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground font-mono">P/L</th>
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground font-mono">Avg RR</th>
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground font-mono">Bias Acc</th>
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground font-mono">Exec</th>
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground">Best Setup</th>
                      <th className="px-3 py-3 text-xs font-medium text-muted-foreground">Top Mistake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.slice().reverse().map(w => {
                      const idx = weeklyData.findIndex(x => x.week === w.week);
                      const isSelected = idx === selectedIdx;
                      return (
                      <tr
                        key={w.week}
                        onClick={() => setSelectedIdx(idx)}
                        className={cn(
                          'border-b border-border/50 hover:bg-accent/50 transition-colors cursor-pointer',
                          isSelected && 'bg-primary/5'
                        )}
                      >
                        <td className="px-3 py-2.5 text-xs font-medium">{w.weekName}{isSelected && <span className="ml-2 text-[9px] text-primary font-mono">●</span>}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{w.trades}</td>
                        <td className={cn('px-3 py-2.5 font-mono text-xs', w.winRate >= 50 ? 'text-success' : 'text-destructive')}>{w.winRate}%</td>
                        <td className={cn('px-3 py-2.5 font-mono text-xs', w.pl >= 0 ? 'text-success' : 'text-destructive')}>{formatCurrency(w.pl)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{w.avgRR}</td>
                        <td className={cn('px-3 py-2.5 font-mono text-xs', w.biasAccuracy >= 50 ? 'text-success' : 'text-muted-foreground')}>{w.biasAccuracy}%</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{w.avgExec}%</td>
                        <td className="px-3 py-2.5 text-xs">{w.bestSetup?.name || '-'}</td>
                        <td className="px-3 py-2.5 text-xs">{w.mistakeCount > 0 ? `${w.mistakeCount} (${w.topMistake})` : '-'}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No trading data for weekly review yet. Start logging trades to see your weekly analysis.
          </CardContent>
        </Card>
      )}

      {/* AI Insights — page bottom (universal) */}
      {latest && (
        <AIInsightsPanel
          page="Weekly Review"
          payload={{
            week: latest.week, trades: latest.trades, wins: latest.wins, losses: latest.losses,
            pl: latest.pl, win_rate: latest.winRate, avg_rr: latest.avgRR, bias_accuracy: latest.biasAccuracy,
            exec_score: latest.avgExec, top_mistake: latest.topMistake, best_pair: latest.bestPair, worst_pair: latest.worstPair,
            best_setup: latest.bestSetup?.name, worst_setup: latest.worstSetup?.name,
          }}
        />
      )}
    </div>
  );
}
