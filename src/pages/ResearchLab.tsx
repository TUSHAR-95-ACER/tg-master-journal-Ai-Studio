import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Plus, Upload, BarChart3, Archive as ArchiveIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Strategy, createStrategy } from '@/types/research';
import { loadStrategies, saveStrategies, getSeedStrategies } from '@/lib/researchStorage';
import { StrategyCard } from '@/components/research/StrategyCard';
import { StrategyDialog } from '@/components/research/StrategyDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { AIInsightsPanel } from '@/components/shared/AIInsightsPanel';

export default function ResearchLab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [view, setView] = useState<'active' | 'archive'>('active');

  useEffect(() => {
    if (!user) return setStrategies([]);
    setStrategies(loadStrategies(user.id));
  }, [user]);

  const persist = (next: Strategy[]) => {
    setStrategies(next);
    if (user) saveStrategies(user.id, next);
  };

  const active = useMemo(() => strategies.filter((s) => s.status !== 'Archived'), [strategies]);
  const archived = useMemo(() => strategies.filter((s) => s.status === 'Archived'), [strategies]);
  const shown = view === 'active' ? active : archived;

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (s: Strategy) => { setEditing(s); setDialogOpen(true); };

  const handleSave = (s: Strategy) => {
    const exists = strategies.some((x) => x.id === s.id);
    persist(exists ? strategies.map((x) => x.id === s.id ? s : x) : [s, ...strategies]);
  };

  const handleDuplicate = (s: Strategy) => {
    const copy = { ...s, id: crypto.randomUUID(), name: `${s.name} (copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    persist([copy, ...strategies]);
  };
  const handleArchive = (s: Strategy) => {
    persist(strategies.map((x) => x.id === s.id ? { ...x, status: x.status === 'Archived' ? 'Testing' : 'Archived' } : x));
  };
  const handleDelete = (s: Strategy) => {
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    persist(strategies.filter((x) => x.id !== s.id));
  };

  const seed = () => {
    persist([...getSeedStrategies(), ...strategies]);
    toast({ title: 'Strategies seeded', description: 'Added 5 example strategies.' });
  };

  const importStrategy = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
      try {
        const text = await f.text();
        const parsed = JSON.parse(text) as Strategy;
        const imported = createStrategy({ ...parsed, id: undefined as any });
        persist([{ ...imported, tests: parsed.tests || [] }, ...strategies]);
        toast({ title: 'Strategy imported' });
      } catch {
        toast({ title: 'Import failed', description: 'Invalid JSON', variant: 'destructive' });
      }
    };
    input.click();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Research Lab"
        subtitle="Strategies are created, tested, validated, and promoted to your playbook."
      >
        <Button variant="outline" size="sm" onClick={importStrategy}><Upload className="h-4 w-4 mr-1" /> Import</Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/research-lab/analytics')}><BarChart3 className="h-4 w-4 mr-1" /> Analytics</Button>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Strategy</Button>
      </PageHeader>

      <Tabs value={view} onValueChange={(v) => setView(v as 'active' | 'archive')}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="archive"><ArchiveIcon className="h-3 w-3 mr-1" /> Archive ({archived.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={view} className="mt-6">
          {shown.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <div className="text-4xl mb-3">🧪</div>
              <h3 className="font-heading font-semibold text-lg">
                {view === 'active' ? 'No strategies yet' : 'Nothing archived'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {view === 'active' ? 'Create your first strategy or seed examples to get started.' : 'Archived strategies will appear here.'}
              </p>
              {view === 'active' && (
                <div className="flex justify-center gap-2">
                  <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Strategy</Button>
                  <Button variant="outline" onClick={seed}>Seed Examples</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {shown.map((s) => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  onOpen={() => navigate(`/research-lab/${s.id}`)}
                  onEdit={() => openEdit(s)}
                  onDuplicate={() => handleDuplicate(s)}
                  onArchive={() => handleArchive(s)}
                  onDelete={() => handleDelete(s)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <StrategyDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} onSave={handleSave} />

      {/* AI Insights — page bottom (universal) */}
      <AIInsightsPanel
        page="Research Lab"
        payload={{
          total_strategies: strategies.length,
          archived: strategies.filter(s => (s as any).status === 'archived').length,
          strategies: strategies.slice(0, 12).map(s => ({
            name: (s as any).name, category: (s as any).category, status: (s as any).status,
            tests: Array.isArray((s as any).tests) ? (s as any).tests.length : 0,
          })),
        }}
      />
    </div>
  );
}
