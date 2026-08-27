import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, MetricCard } from '@/components/shared/MetricCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Strategy } from '@/types/research';
import { loadStrategies } from '@/lib/researchStorage';
import { computeKPIs, conditionStats, winRateByKey } from '@/lib/researchAnalytics';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

export default function ResearchAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    if (!user) return;
    setStrategies(loadStrategies(user.id));
  }, [user]);

  const rows = useMemo(() => strategies.map((s) => {
    const k = computeKPIs(s.tests);
    const days = new Set(s.tests.map((t) => t.date).filter(Boolean)).size;
    return { strategy: s, kpi: k, days };
  }), [strategies]);

  const active = rows.filter((r) => r.strategy.status !== 'Archived');
  const archived = rows.filter((r) => r.strategy.status === 'Archived');

  const mostTested = [...rows].sort((a, b) => b.kpi.totalTests - a.kpi.totalTests)[0];
  const ranked = [...active].filter((r) => r.kpi.totalTests >= 1).sort((a, b) => b.kpi.winRate - a.kpi.winRate);
  const highest = ranked[0];
  const lowest = ranked[ranked.length - 1];
  const promotionCandidates = active.filter((r) => r.kpi.validationScore >= 60 && r.kpi.totalTests >= 10);
  const retireCandidates = active.filter((r) => r.kpi.totalTests >= 10 && r.kpi.winRate < 35);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    strategies.forEach((s) => s.tests.forEach((t) => {
      if (!t.date) return;
      const m = t.date.slice(0, 7);
      map.set(m, (map.get(m) || 0) + 1);
    }));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
  }, [strategies]);

  // Aggregate market condition performance across ALL tests (every strategy).
  const conditions = useMemo(() => {
    const allTests = strategies.flatMap((s) => s.tests);
    return conditionStats(allTests);
  }, [strategies]);
  const graded = conditions.filter((c) => c.total >= 1);
  const bestCond = [...graded].sort((a, b) => b.winRate - a.winRate)[0];
  const worstCond = [...graded].sort((a, b) => a.winRate - b.winRate)[0];

  const rankChart = ranked.slice(0, 12).map((r) => ({ key: r.strategy.name, winRate: Math.round(r.kpi.winRate) }));

  // DR-template aggregate breakdowns: only tests from strategies using the DR template,
  // so non-DR strategies don't pollute Entry Type / DR Level / FVG / Breakout / LTF stats.
  const drStats = useMemo(() => {
    const drTests = strategies.filter((s) => s.template === 'dr').flatMap((s) => s.tests);
    const byEntryType = winRateByKey(drTests, (t) => t.entryType || '');
    const byDrLevel = winRateByKey(drTests, (t) => t.drLevel || '');
    const byFvg = winRateByKey(drTests, (t) => t.fvgLocation || '');
    const byBreakout = winRateByKey(drTests, (t) => t.breakoutQuality || '');
    const ltfExploded: Array<{ ltf: string; result: string }> = [];
    drTests.forEach((t) => {
      const arr = Array.isArray(t.ltfConfirmation) ? t.ltfConfirmation : [];
      arr.forEach((ltf) => ltfExploded.push({ ltf, result: t.result || '' }));
    });
    const ltfMap = new Map<string, { wins: number; losses: number; total: number }>();
    ltfExploded.forEach(({ ltf, result }) => {
      if (!ltf) return;
      const cur = ltfMap.get(ltf) || { wins: 0, losses: 0, total: 0 };
      if (result === 'Win') cur.wins++;
      if (result === 'Loss') cur.losses++;
      if (result === 'Win' || result === 'Loss') cur.total++;
      ltfMap.set(ltf, cur);
    });
    const byLtf = [...ltfMap.entries()].map(([key, v]) => ({ key, ...v, winRate: v.total ? (v.wins / v.total) * 100 : 0 }));
    const best = (rows: typeof byEntryType) => {
      const sig = rows.filter((r) => r.total >= 1);
      if (!sig.length) return null;
      return [...sig].sort((a, b) => b.winRate - a.winRate)[0];
    };
    return {
      totalDrTests: drTests.length,
      byEntryType, byDrLevel, byFvg, byBreakout, byLtf,
      bestEntryType: best(byEntryType),
      bestDrLevel: best(byDrLevel),
      bestFvg: best(byFvg),
      bestBreakout: best(byBreakout),
      bestLtf: best(byLtf),
    };
  }, [strategies]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Research Lab Analytics"
        subtitle="Strategy performance, validation progress and promotion candidates. Independent from Journal Analytics."
      >
        <Button variant="outline" size="sm" onClick={() => navigate('/research-lab')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Research Lab
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Strategies" value={rows.length} />
        <MetricCard label="Active" value={active.length} />
        <MetricCard label="Archived" value={archived.length} />
        <MetricCard label="Most Tested" value={mostTested?.strategy.name || '—'} emphasis="gold" />
        <MetricCard label="Highest Win Rate" value={highest ? `${highest.strategy.name} · ${highest.kpi.winRate.toFixed(0)}%` : '—'} emphasis="gold" />
        <MetricCard label="Lowest Win Rate" value={lowest && lowest !== highest ? `${lowest.strategy.name} · ${lowest.kpi.winRate.toFixed(0)}%` : '—'} trend="down" />
      </div>

      <Card className="p-5">
        <h3 className="font-heading font-semibold mb-1">Market Condition Performance</h3>
        <p className="text-xs text-muted-foreground mb-4">Wins ÷ resolved tests tagged with each market condition. Drives Best / Worst recommendations below.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {conditions.map((c) => {
            const icon = c.key === 'Trending' ? '📈' : c.key === 'Volatile' ? '🌊' : '➡️';
            return (
              <div key={c.key} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{icon} {c.key}</span>
                  <span className="font-mono text-xs font-bold">{c.total === 0 ? '—' : `${c.winRate.toFixed(0)}%`}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{c.wins}W / {c.losses}L · {c.total} resolved</p>
                <div className="h-1.5 rounded-full bg-muted/50 mt-3 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.winRate)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {graded.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bestCond && (
              <div className="rounded-lg border border-gold/45 bg-gold/10 p-3 shadow-[0_0_0_1px_hsl(var(--gold)/0.12)_inset]">
                <p className="text-[10px] uppercase tracking-wider text-gold font-semibold">Best Market Condition</p>
                <p className="font-heading text-lg font-bold mt-1">{bestCond.key} · {bestCond.winRate.toFixed(0)}% Success</p>
              </div>
            )}
            {worstCond && worstCond !== bestCond && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold">Worst Market Condition</p>
                <p className="font-heading text-lg font-bold mt-1">{worstCond.key} · {worstCond.winRate.toFixed(0)}% Success</p>
              </div>
            )}
          </div>
        )}
        {graded.length === 0 && (
          <p className="text-xs text-muted-foreground italic mt-4">Tag a market condition on your strategy tests (Trending / Volatile / Sideways) to populate this section.</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h3 className="font-heading font-semibold">DR Strategy Breakdown</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{drStats.totalDrTests} DR tests</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Aggregates every test logged under a DR-template strategy. Empty rows mean that dimension hasn&rsquo;t been tagged yet.</p>
        {drStats.totalDrTests === 0 ? (
          <p className="text-xs text-muted-foreground italic">Create a DR strategy and log tests with Entry Type, DR Level, FVG Location, Breakout Quality, and LTF Confirmation to populate this dashboard.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
              {[
                { label: 'Best Entry Type', v: drStats.bestEntryType },
                { label: 'Best DR Level', v: drStats.bestDrLevel },
                { label: 'Best FVG Location', v: drStats.bestFvg },
                { label: 'Best Breakout Quality', v: drStats.bestBreakout },
                { label: 'Best LTF Confirmation', v: drStats.bestLtf },
              ].map(({ label, v }) => (
                <div key={label} className="rounded-lg border border-gold/40 bg-gold/10 p-3 shadow-[0_0_0_1px_hsl(var(--gold)/0.12)_inset]">
                  <p className="text-[10px] uppercase tracking-wider text-gold font-semibold">{label}</p>
                  <p className="font-heading text-sm font-bold mt-1">{v ? `${v.key} · ${v.winRate.toFixed(0)}%` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{v ? `${v.wins}W / ${v.losses}L · ${v.total} resolved` : 'No data'}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                { title: 'Win Rate by Entry Type', rows: drStats.byEntryType },
                { title: 'Win Rate by DR Level', rows: drStats.byDrLevel },
                { title: 'Win Rate by FVG Location', rows: drStats.byFvg },
                { title: 'Win Rate by Breakout Quality', rows: drStats.byBreakout },
                { title: 'Win Rate by LTF Confirmation', rows: drStats.byLtf },
              ].map(({ title, rows }) => (
                <div key={title} className="rounded-lg border border-border/60 bg-background/40 p-3">
                  <p className="text-xs font-semibold mb-2">{title}</p>
                  {rows.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">No tagged tests yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {rows.map((r) => (
                        <li key={r.key} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate">{r.key}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[11px] text-muted-foreground">{r.wins}W/{r.losses}L</span>
                            <span className="font-mono font-bold">{r.total ? `${r.winRate.toFixed(0)}%` : '—'}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>



      <Card className="p-5">
        <h3 className="font-heading font-semibold mb-3">Strategy Performance Ranking</h3>
        {rankChart.length === 0 ? (
          <p className="text-sm text-muted-foreground">No strategies with tests yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rankChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="key" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="winRate" fill="hsl(var(--gold))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-heading font-semibold mb-3">Strategy Comparison Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3">Strategy</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Template</th>
                <th className="text-right py-2 pr-3">Tests</th>
                <th className="text-right py-2 pr-3">Days</th>
                <th className="text-right py-2 pr-3">Win %</th>
                <th className="text-right py-2 pr-3">Avg RR</th>
                <th className="text-right py-2 pr-3">Bias %</th>
                <th className="text-right py-2 pr-3">A %</th>
                <th className="text-right py-2 pr-3">Validation</th>
                <th className="text-right py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.strategy.id} className="border-b border-border/60 hover:bg-accent/40 cursor-pointer"
                  onClick={() => navigate(`/research-lab/${r.strategy.id}`)}>
                  <td className="py-2 pr-3 font-medium">{r.strategy.icon} {r.strategy.name}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-[10px]">{r.strategy.status}</Badge></td>
                  <td className="py-2 pr-3 uppercase text-xs text-muted-foreground">{r.strategy.template || 'blank'}</td>
                  <td className="py-2 pr-3 text-right">{r.kpi.totalTests}</td>
                  <td className="py-2 pr-3 text-right">{r.days}</td>
                  <td className="py-2 pr-3 text-right">{r.kpi.winRate ? `${r.kpi.winRate.toFixed(0)}%` : '—'}</td>
                  <td className="py-2 pr-3 text-right">{r.kpi.avgRR ? r.kpi.avgRR.toFixed(2) : '—'}</td>
                  <td className="py-2 pr-3 text-right">{r.kpi.biasAccuracy ? `${r.kpi.biasAccuracy.toFixed(0)}%` : '—'}</td>
                  <td className="py-2 pr-3 text-right">{r.kpi.aGradePct ? `${r.kpi.aGradePct.toFixed(0)}%` : '—'}</td>
                  <td className="py-2 pr-3 text-right font-mono">{r.kpi.validationScore}/100</td>
                  <td className="py-2 text-right">
                    {r.kpi.validationScore >= 60 && r.kpi.totalTests >= 10
                      ? <Badge className="bg-gold text-gold-foreground shadow-[0_0_18px_hsl(var(--gold)/0.28)]">Promote</Badge>
                      : r.kpi.totalTests >= 10 && r.kpi.winRate < 35
                        ? <Badge variant="destructive">Retire</Badge>
                        : <Badge variant="secondary">Keep testing</Badge>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={11} className="py-6 text-center text-muted-foreground text-xs">No strategies yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-heading font-semibold mb-3">Promotion Candidates</h3>
          {promotionCandidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">None yet. Need ≥10 tests and ≥60 validation score.</p>
          ) : (
            <ul className="space-y-2">
              {promotionCandidates.map((r) => (
                <li key={r.strategy.id} className="flex items-center justify-between text-sm">
                  <span>{r.strategy.icon} {r.strategy.name}</span>
                  <span className="font-mono text-xs text-gold">{r.kpi.validationScore}/100</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-heading font-semibold mb-3">Strategies to Retire</h3>
          {retireCandidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">None. Underperformers need ≥10 tests and &lt;35% win rate.</p>
          ) : (
            <ul className="space-y-2">
              {retireCandidates.map((r) => (
                <li key={r.strategy.id} className="flex items-center justify-between text-sm">
                  <span>{r.strategy.icon} {r.strategy.name}</span>
                  <span className="font-mono text-xs text-destructive">{r.kpi.winRate.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-heading font-semibold mb-3">Monthly Testing Activity</h3>
        {monthly.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tests logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="count" fill="hsl(var(--gold))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
