import { useMemo } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import { PageHeader, MetricCard } from '@/components/shared/MetricCard';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, formatPercent, calcWinRate } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, Clock, AlertTriangle, Sparkles, Brain, Zap, Shield } from 'lucide-react';

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</p>
      ))}
    </div>
  );
};

export default function AIInsights() {
  const { trades } = useTrading();
  const valid = useMemo(() => trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'), [trades]);

  // Generate insights
  const insights = useMemo(() => {
    if (valid.length < 5) return [];
    const results: { title: string; description: string; type: 'positive' | 'negative' | 'neutral'; icon: any }[] = [];

    const winRate = calcWinRate(trades);
    if (winRate >= 55) results.push({ title: 'Strong Win Rate', description: `Your ${winRate.toFixed(1)}% win rate shows consistent edge. Maintain your current approach.`, type: 'positive', icon: Target });
    else if (winRate < 40) results.push({ title: 'Low Win Rate Alert', description: `At ${winRate.toFixed(1)}%, review your entry criteria and confluences.`, type: 'negative', icon: AlertTriangle });

    // Best pair
    const pairMap = new Map<string, number>();
    valid.forEach(t => pairMap.set(t.asset, (pairMap.get(t.asset) || 0) + t.profitLoss));
    const bestPair = [...pairMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const worstPair = [...pairMap.entries()].sort((a, b) => a[1] - b[1])[0];
    if (bestPair) results.push({ title: `Focus on ${bestPair[0]}`, description: `${bestPair[0]} is your most profitable pair at ${formatCurrency(bestPair[1])}. Consider allocating more focus here.`, type: 'positive', icon: TrendingUp });
    if (worstPair && worstPair[1] < 0) results.push({ title: `Avoid ${worstPair[0]}`, description: `${worstPair[0]} is your worst pair at ${formatCurrency(worstPair[1])}. Consider reducing exposure.`, type: 'negative', icon: TrendingDown });

    // Session analysis
    const sessionMap = new Map<string, { pl: number; count: number }>();
    valid.forEach(t => {
      const s = sessionMap.get(t.session) || { pl: 0, count: 0 };
      s.pl += t.profitLoss; s.count++;
      sessionMap.set(t.session, s);
    });
    const bestSession = [...sessionMap.entries()].sort((a, b) => b[1].pl - a[1].pl)[0];
    if (bestSession) results.push({ title: `Best Session: ${bestSession[0]}`, description: `${bestSession[0]} session yields ${formatCurrency(bestSession[1].pl)} across ${bestSession[1].count} trades.`, type: 'neutral', icon: Clock });

    // Overtrading check
    const dayMap = new Map<string, number>();
    valid.forEach(t => dayMap.set(t.date, (dayMap.get(t.date) || 0) + 1));
    const overtradeDays = [...dayMap.values()].filter(c => c > 3).length;
    if (overtradeDays > 2) results.push({ title: 'Overtrading Detected', description: `You've overtraded (>3 trades/day) on ${overtradeDays} days. This correlates with lower win rates.`, type: 'negative', icon: AlertTriangle });

    // Mistake patterns
    const allMistakes = valid.flatMap(t => t.mistakes);
    if (allMistakes.length > 0) {
      const freq = new Map<string, number>();
      allMistakes.forEach(m => freq.set(m, (freq.get(m) || 0) + 1));
      const topMistake = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
      results.push({ title: `Top Mistake: ${topMistake[0]}`, description: `${topMistake[0]} occurred ${topMistake[1]} times. Eliminating this could significantly improve performance.`, type: 'negative', icon: Brain });
    }

    // RR analysis
    const avgRR = valid.filter(t => t.actualRR).reduce((s, t) => s + (t.actualRR || 0), 0) / (valid.filter(t => t.actualRR).length || 1);
    if (avgRR >= 2) results.push({ title: 'Excellent Risk:Reward', description: `Average RR of ${avgRR.toFixed(2)} shows strong trade management.`, type: 'positive', icon: Zap });

    // Discipline analysis
    const withPsych = valid.filter(t => t.psychology);
    if (withPsych.length >= 3) {
      const highDisc = withPsych.filter(t => t.psychology!.discipline >= 4);
      const lowDisc = withPsych.filter(t => t.psychology!.discipline <= 2);
      const highDiscWR = highDisc.length > 0 ? (highDisc.filter(t => t.result === 'Win').length / highDisc.length) * 100 : 0;
      const lowDiscWR = lowDisc.length > 0 ? (lowDisc.filter(t => t.result === 'Win').length / lowDisc.length) * 100 : 0;
      if (highDiscWR > lowDiscWR + 10) {
        results.push({ title: 'Discipline Pays Off', description: `High discipline trades win at ${highDiscWR.toFixed(0)}% vs ${lowDiscWR.toFixed(0)}% for low discipline. Stay disciplined!`, type: 'positive', icon: Shield });
      }
    }

    // Direction bias
    const longs = valid.filter(t => t.direction === 'Long');
    const shorts = valid.filter(t => t.direction === 'Short');
    const longWR = longs.length > 0 ? (longs.filter(t => t.result === 'Win').length / longs.length) * 100 : 0;
    const shortWR = shorts.length > 0 ? (shorts.filter(t => t.result === 'Win').length / shorts.length) * 100 : 0;
    if (Math.abs(longWR - shortWR) > 15) {
      const better = longWR > shortWR ? 'Long' : 'Short';
      const betterWR = Math.max(longWR, shortWR);
      results.push({ title: `${better} Bias Advantage`, description: `Your ${better} trades win at ${betterWR.toFixed(0)}%, significantly higher. Consider focusing on ${better} setups.`, type: 'neutral', icon: Target });
    }

    return results;
  }, [valid, trades]);

  // Radar data
  const radarData = useMemo(() => {
    const winRate = calcWinRate(trades);
    const avgRR = valid.filter(t => t.actualRR).reduce((s, t) => s + (t.actualRR || 0), 0) / (valid.filter(t => t.actualRR).length || 1);
    const withPsych = valid.filter(t => t.psychology);
    const avgDiscipline = withPsych.length ? (withPsych.reduce((s, t) => s + t.psychology!.discipline, 0) / withPsych.length) * 20 : 50;
    const avgFocus = withPsych.length ? (withPsych.reduce((s, t) => s + t.psychology!.focus, 0) / withPsych.length) * 20 : 50;
    const consistency = Math.min(100, valid.length * 2);
    const riskMgmt = withPsych.filter(t => t.psychology!.checklist.riskRespected).length / (withPsych.length || 1) * 100;
    return [
      { subject: 'Win Rate', value: winRate },
      { subject: 'RR Ratio', value: Math.min(100, avgRR * 25) },
      { subject: 'Discipline', value: avgDiscipline },
      { subject: 'Focus', value: avgFocus },
      { subject: 'Consistency', value: consistency },
      { subject: 'Risk Mgmt', value: riskMgmt },
    ];
  }, [valid, trades]);

  // Overall score
  const overallScore = useMemo(() => {
    if (radarData.length === 0) return 0;
    return Math.round(radarData.reduce((s, d) => s + d.value, 0) / radarData.length);
  }, [radarData]);

  // Setup performance data
  const setupData = useMemo(() => {
    const map = new Map<string, { wins: number; total: number; pl: number }>();
    valid.forEach(t => {
      const s = map.get(t.setup) || { wins: 0, total: 0, pl: 0 };
      s.total++;
      if (t.result === 'Win') s.wins++;
      s.pl += t.profitLoss;
      map.set(t.setup, s);
    });
    return [...map.entries()]
      .map(([name, d]) => ({ name, winRate: d.total > 0 ? Math.round((d.wins / d.total) * 100) : 0, pl: d.pl, trades: d.total }))
      .sort((a, b) => b.pl - a.pl)
      .slice(0, 6);
  }, [valid]);

  return (
    <div className="p-6 w-full">
      <PageHeader title="AI Insights" subtitle="Intelligent trading recommendations">
      </PageHeader>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Trader Score" value={`${overallScore}/100`} icon={Sparkles} emphasis="gold" />
        <MetricCard label="Total Insights" value={insights.length} icon={Zap} emphasis="gold" />
        <MetricCard label="Positive Signals" value={insights.filter(i => i.type === 'positive').length} icon={TrendingUp} trend="up" />
        <MetricCard label="Risk Alerts" value={insights.filter(i => i.type === 'negative').length} icon={AlertTriangle} trend={insights.filter(i => i.type === 'negative').length > 2 ? 'down' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Trader Radar */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Target className="h-4 w-4 text-gold" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.15em]">Trader Profile</h3>
              <p className="text-[10px] text-muted-foreground">Performance radar analysis</p>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="value" stroke="hsl(var(--gold))" fill="hsl(var(--gold))" fillOpacity={0.16} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {/* Score summary */}
          <div className="flex items-center justify-center gap-3 mt-2 pt-3 border-t border-border/50">
            <span className={cn('text-3xl font-bold', overallScore >= 70 ? 'text-gold' : overallScore >= 40 ? 'text-foreground' : 'text-destructive')}>{overallScore}</span>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall Score</p>
              <p className="text-xs font-medium">{overallScore >= 70 ? 'Strong Performance' : overallScore >= 40 ? 'Room to Improve' : 'Needs Attention'}</p>
            </div>
          </div>
        </div>

        {/* Insights Cards */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-gold" />
            <h3 className="text-xs font-bold uppercase tracking-[0.15em]">AI Recommendations</h3>
            <span className="text-[10px] text-muted-foreground ml-1">({insights.length} signals)</span>
          </div>
          {insights.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-hide">
              {insights.map((insight, i) => {
                const InsightIcon = insight.icon;
                return (
                  <div key={i} className={cn(
                    'border rounded-2xl p-4 transition-all hover:shadow-md',
                    insight.type === 'positive' && 'bg-gold/10 border-gold/30 hover:border-gold/50',
                    insight.type === 'negative' && 'bg-destructive/5 border-destructive/20 hover:border-destructive/40',
                    insight.type === 'neutral' && 'bg-card border-border hover:border-primary/30',
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                        insight.type === 'positive' && 'bg-gold/10 border border-gold/25',
                        insight.type === 'negative' && 'bg-destructive/10',
                        insight.type === 'neutral' && 'bg-primary/10',
                      )}>
                        <InsightIcon className={cn(
                          'h-4 w-4',
                          insight.type === 'positive' && 'text-gold',
                          insight.type === 'negative' && 'text-destructive',
                          insight.type === 'neutral' && 'text-primary',
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold">{insight.title}</h4>
                          <span className={cn(
                            'text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                            insight.type === 'positive' && 'bg-gold/10 text-gold',
                            insight.type === 'negative' && 'bg-destructive/10 text-destructive',
                            insight.type === 'neutral' && 'bg-primary/10 text-primary',
                          )}>
                            {insight.type === 'positive' ? 'Strength' : insight.type === 'negative' ? 'Alert' : 'Info'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Log at least 5 trades to generate AI insights</p>
              <p className="text-xs mt-1 opacity-60">The more trades you log, the smarter the insights become</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
