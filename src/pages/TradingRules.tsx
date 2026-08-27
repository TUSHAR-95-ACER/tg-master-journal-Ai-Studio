import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Shield, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadUserStorage, saveUserStorage } from '@/lib/userStorage';

interface TradingRule {
  id: string;
  category: string;
  rule: string;
  description: string;
  active: boolean;
}

const STORAGE_KEY = 'ef_trading_rules';

const CATEGORIES = ['Entry', 'Exit', 'Risk', 'Psychology', 'Timing', 'Position Sizing'];

export default function TradingRules() {
  const { user } = useAuth();
  const [rules, setRules] = useState<TradingRule[]>([]);
  const [form, setForm] = useState({ category: 'Entry', rule: '', description: '' });

  useEffect(() => {
    if (!user) {
      setRules([]);
      return;
    }

    setRules(loadUserStorage<TradingRule[]>(STORAGE_KEY, user.id, []));
  }, [user]);

  const save = (updated: TradingRule[]) => {
    setRules(updated);
    if (user) saveUserStorage(STORAGE_KEY, user.id, updated);
  };

  const handleAdd = () => {
    if (!form.rule) return;
    const newRule: TradingRule = { id: crypto.randomUUID(), ...form, active: true };
    save([...rules, newRule]);
    setForm({ category: 'Entry', rule: '', description: '' });
  };

  const toggleRule = (id: string) => save(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
  const deleteRule = (id: string) => save(rules.filter(r => r.id !== id));

  const grouped = CATEGORIES.map(cat => ({
    category: cat,
    rules: rules.filter(r => r.category === cat),
  })).filter(g => g.rules.length > 0);

  const compliance = rules.length ? Math.round((rules.filter(r => r.active).length / rules.length) * 100) : 0;

  return (
    <div className="p-6 w-full">
      <PageHeader title="Trading Rules" subtitle={`${rules.length} rules · ${compliance}% active`}>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Rule Form */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3 h-fit">
          <h3 className="text-sm font-semibold">Add Rule</h3>
          <div>
            <Label className="text-xs">Category</Label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Rule</Label><Input value={form.rule} onChange={e => setForm(f => ({ ...f, rule: e.target.value }))} className="h-8 text-xs" placeholder="Your trading rule..." /></div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="text-xs min-h-[60px]" placeholder="Optional details..." /></div>
          <Button onClick={handleAdd} className="w-full gap-1.5"><Plus className="h-4 w-4" /> Add Rule</Button>
        </div>

        {/* Rules List */}
        <div className="lg:col-span-2 space-y-4">
          {grouped.map(g => (
            <div key={g.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{g.category}</h3>
              <div className="space-y-2">
                {g.rules.map(rule => (
                  <div key={rule.id} className={cn(
                    'bg-card border rounded-lg p-3 flex items-start gap-3 group transition-colors',
                    rule.active ? 'border-success/20' : 'border-border opacity-50',
                  )}>
                    <button onClick={() => toggleRule(rule.id)} className="mt-0.5 shrink-0">
                      <CheckCircle className={cn('h-5 w-5', rule.active ? 'text-success' : 'text-muted-foreground')} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', !rule.active && 'line-through')}>{rule.rule}</p>
                      {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive shrink-0" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
