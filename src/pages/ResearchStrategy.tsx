import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Strategy, createEmptyTest } from '@/types/research';
import { loadStrategies, saveStrategies } from '@/lib/researchStorage';
import { StrategyDashboard } from '@/components/research/StrategyDashboard';
import { StrategyDialog } from '@/components/research/StrategyDialog';
import { useToast } from '@/hooks/use-toast';

export default function ResearchStrategy() {
  const { user } = useAuth();
  const { strategyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setStrategies(loadStrategies(user.id));
  }, [user]);

  const strategy = useMemo(() => strategies.find((s) => s.id === strategyId), [strategies, strategyId]);

  const persist = (next: Strategy[]) => {
    setStrategies(next);
    if (user) saveStrategies(user.id, next);
  };

  if (!strategy) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Strategy not found. <button className="text-primary underline" onClick={() => navigate('/research-lab')}>Back to Research Lab</button></p>
      </div>
    );
  }

  const update = (s: Strategy) => persist(strategies.map((x) => x.id === s.id ? { ...s, updatedAt: new Date().toISOString() } : x));

  const newTest = () => {
    const t = createEmptyTest(strategy.pairs[0] || '');
    update({ ...strategy, tests: [t, ...strategy.tests] });
    navigate(`/research-lab/${strategy.id}/test/${t.id}`);
  };

  const archive = () => {
    update({ ...strategy, status: strategy.status === 'Archived' ? 'Testing' : 'Archived' });
    toast({ title: strategy.status === 'Archived' ? 'Strategy restored' : 'Strategy archived' });
  };

  const promote = () => {
    toast({ title: 'Promoted to Playbook', description: `${strategy.name} added to your playbook queue.` });
  };

  return (
    <div className="p-4 sm:p-6">
      <StrategyDashboard
        strategy={strategy}
        onUpdate={update}
        onEdit={() => setEditOpen(true)}
        onArchive={archive}
        onNewTest={newTest}
        onPromote={promote}
      />
      <StrategyDialog open={editOpen} onOpenChange={setEditOpen} initial={strategy} onSave={update} />
    </div>
  );
}
