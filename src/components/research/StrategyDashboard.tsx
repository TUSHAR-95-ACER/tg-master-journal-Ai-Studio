import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/shared/MetricCard';
import { Strategy } from '@/types/research';
import { computeKPIs, winRateByKey, gradeDistribution, emotionDistribution, biasAccuracySplit } from '@/lib/researchAnalytics';
import { ArrowLeft, Plus, Pencil, Save, Download, Archive, Star, X, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface Props {
  strategy: Strategy;
  onUpdate: (s: Strategy) => void;
  onEdit: () => void;
  onArchive: () => void;
  onNewTest: () => void;
  onPromote: () => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

export function StrategyDashboard({ strategy, onUpdate, onEdit, onArchive, onNewTest, onPromote }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPair, setNewPair] = useState('');
  const kpi = useMemo(() => computeKPIs(strategy.tests), [strategy.tests]);

  const sessionData = useMemo(() => winRateByKey(strategy.tests, (t) => t.session || ''), [strategy.tests]);
  const pairData = useMemo(() => winRateByKey(strategy.tests, (t) => t.pair || ''), [strategy.tests]);
  const gradeData = useMemo(() => gradeDistribution(strategy.tests), [strategy.tests]);
  const emotionData = useMemo(() => emotionDistribution(strategy.tests), [strategy.tests]);
  const biasData = useMemo(() => biasAccuracySplit(strategy.tests), [strategy.tests]);

  const addPair = () => {
    const p = newPair.trim().toUpperCase();
    if (!p || strategy.pairs.includes(p)) return;
    onUpdate({ ...strategy, pairs: [...strategy.pairs, p] });
    setNewPair('');
  };
  const removePair = (p: string) => onUpdate({ ...strategy, pairs: strategy.pairs.filter((x) => x !== p) });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(strategy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategy.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveTemplate = () => {
    onUpdate({ ...strategy, templateName: strategy.name });
    toast({ title: 'Template saved', description: 'Field structure stored for reuse.' });
  };

  const deleteTest = (id: string) => {
    onUpdate({ ...strategy, tests: strategy.tests.filter((t) => t.id !== id) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/research-lab')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> All Strategies
          </Button>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{strategy.icon}</span>
            <div>
              <h1 className="font-heading text-2xl font-bold">{strategy.name}</h1>
              <p className="text-sm text-muted-foreground">{strategy.type} · {strategy.description || 'No description'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onNewTest}><Plus className="h-4 w-4 mr-1" /> New Test</Button>
            <Button variant="outline" onClick={onEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
            <Button variant="outline" onClick={saveTemplate}><Save className="h-4 w-4 mr-1" /> Save Template</Button>
            <Button variant="outline" onClick={exportData}><Download className="h-4 w-4 mr-1" /> Export</Button>
            <Button variant="outline" onClick={onArchive}><Archive className="h-4 w-4 mr-1" /> Archive</Button>
            <Button variant="default" onClick={onPromote} className="bg-emerald-600 hover:bg-emerald-700"><Star className="h-4 w-4 mr-1" /> Promote to Playbook</Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="Total Tests" value={kpi.totalTests} />
        <MetricCard label="Wins" value={kpi.wins} trend="up" />
        <MetricCard label="Losses" value={kpi.losses} trend="down" />
        <MetricCard label="Win Rate" value={`${kpi.winRate.toFixed(1)}%`} trend={kpi.winRate >= 50 ? 'up' : 'down'} />
        <MetricCard label="Avg RR" value={kpi.avgRR ? kpi.avgRR.toFixed(2) : '—'} />
        <MetricCard label="Bias Accuracy" value={`${kpi.biasAccuracy.toFixed(1)}%`} />
        <MetricCard label="Best Session" value={kpi.bestSession} />
        <MetricCard label="Best Pair" value={kpi.bestPair} />
        <MetricCard label="A Grade %" value={`${kpi.aGradePct.toFixed(0)}%`} />
        <MetricCard label="Validation Score" value={`${kpi.validationScore}/100`} trend={kpi.validationScore >= 60 ? 'up' : undefined} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Win Rate by Session">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sessionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="key" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="winRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Win Rate by Pair">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pairData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="key" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="winRate" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Grade Distribution">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={gradeData} dataKey="count" nameKey="key" outerRadius={80} label>
                {gradeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Bias Accuracy">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={biasData} dataKey="count" nameKey="key" outerRadius={80} label>
                {biasData.map((_, i) => <Cell key={i} fill={i === 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Emotional State Distribution" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={emotionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="key" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Pair manager */}
      <Card className="p-5">
        <h3 className="font-heading font-semibold mb-3">Tracked Pairs</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {strategy.pairs.map((p) => (
            <Badge key={p} variant="secondary" className="text-sm gap-1.5 py-1">
              {p}
              <button onClick={() => removePair(p)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          {!strategy.pairs.length && <p className="text-xs text-muted-foreground">No pairs yet.</p>}
        </div>
        <div className="flex gap-2 max-w-xs">
          <Input value={newPair} onChange={(e) => setNewPair(e.target.value)} placeholder="e.g. EURUSD"
            onKeyDown={(e) => e.key === 'Enter' && addPair()} />
          <Button onClick={addPair}><Plus className="h-4 w-4" /></Button>
        </div>
      </Card>

      {/* Tests list */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold">Tests ({strategy.tests.length})</h3>
          <Button size="sm" onClick={onNewTest}><Plus className="h-4 w-4 mr-1" /> New Test</Button>
        </div>
        {!strategy.tests.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tests yet. Create your first test to start validating.</p>
        ) : (
          <div className="space-y-2">
            {strategy.tests.slice().sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
              <div key={t.id}
                onClick={() => navigate(`/research-lab/${strategy.id}/test/${t.id}`)}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent cursor-pointer transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">{t.date}</span>
                  <span className="font-medium w-20">{t.pair || '—'}</span>
                  <span className="text-xs text-muted-foreground w-32">{t.session || '—'}</span>
                  <span className={`text-xs font-medium w-16 ${
                    t.result === 'Win' ? 'text-success' : t.result === 'Loss' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {t.result || 'Open'}
                  </span>
                  {t.grade && <Badge variant="outline" className="text-xs">{t.grade}</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteTest(t.id); }}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`p-4 ${className}`}>
      <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">{title}</h4>
      {children}
    </Card>
  );
}
