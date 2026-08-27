import { useMemo } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import { PageHeader, MetricCard } from '@/components/shared/MetricCard';
import { formatCurrency, calcAvgRR } from '@/lib/calculations';
import { cn } from '@/lib/utils';

export default function SetupPlaybook() {
  const { trades, customSetups, addCustomSetup, updateCustomSetup, deleteCustomSetup } = useTrading();
  const valid = useMemo(() => trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'), [trades]);

  const setupData = useMemo(() => {
    const allSetups = [...new Set(valid.map(t => t.setup))];
    return allSetups.map(setup => {
      const st = valid.filter(t => t.setup === setup);
      const wins = st.filter(t => t.result === 'Win').length;
      const winRate = st.length ? (wins / st.length) * 100 : 0;
      const avgRR = calcAvgRR(st);
      const totalPL = st.reduce((s, t) => s + t.profitLoss, 0);

      const sessionMap = new Map<string, number>();
      const condMap = new Map<string, number>();
      st.forEach(t => {
        sessionMap.set(t.session, (sessionMap.get(t.session) || 0) + (t.result === 'Win' ? 1 : 0));
        condMap.set(t.marketCondition, (condMap.get(t.marketCondition) || 0) + (t.result === 'Win' ? 1 : 0));
      });
      const bestSession = sessionMap.size > 0 ? [...sessionMap.entries()].reduce((a, b) => b[1] > a[1] ? b : a)[0] : '-';
      const bestCondition = condMap.size > 0 ? [...condMap.entries()].reduce((a, b) => b[1] > a[1] ? b : a)[0] : '-';

      return { name: setup, trades: st.length, winRate: Math.round(winRate * 10) / 10, avgRR, totalPL, bestSession, bestCondition };
    }).sort((a, b) => b.winRate - a.winRate);
  }, [valid]);

  const bestSetup = setupData[0];
  const worstSetup = setupData.length > 1 ? setupData[setupData.length - 1] : null;

  return (
    <div className="p-6 w-full">
      <PageHeader title="Setup Playbook" subtitle="Performance analytics for each trading setup">
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total Setups" value={setupData.length} />
        <MetricCard label="Best Setup" value={bestSetup?.name || '-'} subtitle={bestSetup ? `${bestSetup.winRate}% WR` : ''} trend="up" />
        <MetricCard label="Worst Setup" value={worstSetup?.name || '-'} subtitle={worstSetup ? `${worstSetup.winRate}% WR` : ''} trend="down" />
        <MetricCard label="Total Trades" value={valid.length} />
      </div>

      {/* Setup Cards with Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {setupData.map((s, idx) => (
          <div key={s.name} className={cn(
            'bg-card border rounded-lg p-4 space-y-3',
            idx === 0 ? 'border-success/50 bg-success/5' :
            idx === setupData.length - 1 && setupData.length > 1 ? 'border-destructive/50 bg-destructive/5' :
            'border-border'
          )}>
            <div className="flex items-center justify-between">
              <h4 className={cn('text-sm font-bold',
                idx === 0 ? 'text-success' :
                idx === setupData.length - 1 && setupData.length > 1 ? 'text-destructive' : 'text-foreground'
              )}>{s.name}</h4>
              <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">#{idx + 1}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Win Rate:</span> <span className="font-mono font-semibold">{s.winRate}%</span></div>
              <div><span className="text-muted-foreground">Avg RR:</span> <span className="font-mono font-semibold">{s.avgRR}</span></div>
              <div><span className="text-muted-foreground">Total P/L:</span> <span className={cn('font-mono font-semibold', s.totalPL >= 0 ? 'text-success' : 'text-destructive')}>{formatCurrency(s.totalPL)}</span></div>
              <div><span className="text-muted-foreground">Trades:</span> <span className="font-mono font-semibold">{s.trades}</span></div>
              <div><span className="text-muted-foreground">Best Session:</span> <span className="font-mono text-[10px]">{s.bestSession}</span></div>
              <div><span className="text-muted-foreground">Best Condition:</span> <span className="font-mono text-[10px]">{s.bestCondition}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Rank</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Setup</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground font-mono">Trades</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground font-mono">Win Rate</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground font-mono">Avg RR</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground font-mono">Total P/L</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Best Session</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Best Condition</th>
            </tr>
          </thead>
          <tbody>
            {setupData.map((s, idx) => (
              <tr key={s.name} className={cn('border-b border-border/50 hover:bg-accent/50',
                idx === 0 ? 'bg-success/5' : idx === setupData.length - 1 && setupData.length > 1 ? 'bg-destructive/5' : ''
              )}>
                <td className="px-4 py-2.5 font-mono text-xs font-bold">#{idx + 1}</td>
                <td className={cn('px-4 py-2.5 text-xs font-medium',
                  idx === 0 ? 'text-success' : idx === setupData.length - 1 && setupData.length > 1 ? 'text-destructive' : ''
                )}>{s.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.trades}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.winRate}%</td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.avgRR}</td>
                <td className={cn('px-4 py-2.5 font-mono text-xs', s.totalPL >= 0 ? 'text-success' : 'text-destructive')}>{formatCurrency(s.totalPL)}</td>
                <td className="px-4 py-2.5 text-xs">{s.bestSession}</td>
                <td className="px-4 py-2.5 text-xs">{s.bestCondition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
