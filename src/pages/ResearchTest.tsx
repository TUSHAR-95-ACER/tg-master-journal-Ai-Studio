import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Strategy, ResearchTest as RTest } from '@/types/research';
import { loadStrategies, saveStrategies } from '@/lib/researchStorage';
import { TestEditor } from '@/components/research/TestEditor';

export default function ResearchTest() {
  const { user } = useAuth();
  const { strategyId, testId } = useParams();
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    if (!user) return;
    setStrategies(loadStrategies(user.id));
  }, [user]);

  const strategy = useMemo(() => strategies.find((s) => s.id === strategyId), [strategies, strategyId]);
  const test = useMemo(() => strategy?.tests.find((t) => t.id === testId), [strategy, testId]);

  if (!strategy || !test) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Test not found. <button className="text-primary underline" onClick={() => navigate('/research-lab')}>Back to Research Lab</button></p>
      </div>
    );
  }

  const onSave = async (updated: RTest) => {
    const nextStrategy: Strategy = {
      ...strategy,
      tests: strategy.tests.map((t) => t.id === updated.id ? updated : t),
      updatedAt: new Date().toISOString(),
    };
    const next = strategies.map((s) => s.id === strategy.id ? nextStrategy : s);
    setStrategies(next);
    if (user) saveStrategies(user.id, next);
  };

  return (
    <div className="p-4 sm:p-6">
      <TestEditor strategy={strategy} test={test} onSave={onSave} />
    </div>
  );
}
