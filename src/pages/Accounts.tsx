import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Wallet, BarChart3, ArrowUpRight, TrendingUp, Pencil, Archive } from 'lucide-react';
import { useTrading } from '@/contexts/TradingContext';
import { PageHeader, MetricCard } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TradingAccount, AccountType, PropFirmStage, AccountStatus, ScaleEvent } from '@/types/trading';
import { calcWinRate, calcProfitFactor, calcMaxDrawdown, calcAvgRR, formatCurrency, formatPercent } from '@/lib/calculations';
import { EquityCurveChart } from '@/components/dashboard/EquityCurveChart';
import { AccountStatusBadge } from '@/components/accounts/AccountStatusBadge';
import { PhaseProgressBar } from '@/components/accounts/PhaseProgressBar';
import { AccountHistory } from '@/components/accounts/AccountHistory';
import { AccountPerformance } from '@/components/accounts/AccountPerformance';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const TYPES: AccountType[] = ['Personal', 'Prop Firm', 'Funded', 'Demo'];

export default function Accounts() {
  const { accounts, addAccount, updateAccount, deleteAccount, trades, transactions, addTransaction, scaleEvents, addScaleEvent } = useTrading();
  const [showForm, setShowForm] = useState(false);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showScaleForm, setShowScaleForm] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [txType, setTxType] = useState<'Deposit' | 'Withdrawal'>('Deposit');
  const [editAcc, setEditAcc] = useState<TradingAccount | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', broker: '', type: 'Personal' as AccountType, startingBalance: '', currency: 'USD',
    stage: '' as PropFirmStage | '', targetBalance: '',
    phase1TargetPercent: '', phase2TargetPercent: '', phase3TargetPercent: '',
    targetPercent: '', dailyDrawdownPercent: '', maxDrawdownPercent: '',
    steps: '2' as string,
  });
  const [txForm, setTxForm] = useState({ date: new Date().toISOString().split('T')[0], accountId: '', type: 'Deposit' as 'Deposit' | 'Withdrawal', amount: '', note: '' });
  const [scaleForm, setScaleForm] = useState({ accountId: '', newSize: '', note: '', date: new Date().toISOString().split('T')[0] });

  // Split accounts into active and archived/disabled
  const activeAccounts = useMemo(() => accounts.filter(a => a.status !== 'Disabled'), [accounts]);
  const archivedAccounts = useMemo(() => accounts.filter(a => a.status === 'Disabled'), [accounts]);

  const isPropFirm = (type: AccountType) => type === 'Prop Firm' || type === 'Funded';

  const getSteps = (acc: TradingAccount): (1 | 2 | 3) => acc.steps || 2;

  const getPhases = (acc: TradingAccount): string[] => {
    const steps = getSteps(acc);
    const phases: string[] = [];
    for (let i = 1; i <= steps; i++) phases.push(`Phase ${i}`);
    phases.push('Funded');
    return phases;
  };

  const getPhaseTarget = (acc: TradingAccount, phase: string): number | undefined => {
    if (phase === 'Phase 1') return acc.phase1Target;
    if (phase === 'Phase 2') return acc.phase2Target;
    if (phase === 'Phase 3') return acc.phase3Target;
    return acc.targetBalance;
  };

  const openNew = () => {
    setEditAcc(null);
    setForm({ name: '', broker: '', type: 'Personal', startingBalance: '', currency: 'USD', stage: '', targetBalance: '', phase1TargetPercent: '', phase2TargetPercent: '', phase3TargetPercent: '', targetPercent: '', dailyDrawdownPercent: '', maxDrawdownPercent: '', steps: '2' });
    setShowForm(true);
  };

  const handleSave = () => {
    const startBal = parseFloat(form.startingBalance) || 0;
    const tPct = form.targetPercent ? parseFloat(form.targetPercent) : undefined;
    const ddPct = form.dailyDrawdownPercent ? parseFloat(form.dailyDrawdownPercent) : undefined;
    const mxPct = form.maxDrawdownPercent ? parseFloat(form.maxDrawdownPercent) : undefined;
    const p1Pct = form.phase1TargetPercent ? parseFloat(form.phase1TargetPercent) : undefined;
    const p2Pct = form.phase2TargetPercent ? parseFloat(form.phase2TargetPercent) : undefined;
    const p3Pct = form.phase3TargetPercent ? parseFloat(form.phase3TargetPercent) : undefined;
    const currentSize = editAcc?.currentSize || startBal;
    const steps = parseInt(form.steps) as 1 | 2 | 3;

    const acc: TradingAccount = {
      id: editAcc?.id || crypto.randomUUID(),
      name: form.name, broker: form.broker, type: form.type,
      startingBalance: startBal,
      currentSize: editAcc ? editAcc.currentSize : startBal,
      initialSize: editAcc ? editAcc.initialSize : startBal,
      currency: form.currency,
      stage: form.stage as PropFirmStage || undefined,
      targetBalance: tPct ? currentSize * (1 + tPct / 100) : (form.targetBalance ? parseFloat(form.targetBalance) : undefined),
      createdAt: editAcc?.createdAt || new Date().toISOString(),
      phase1Target: p1Pct ? startBal * (1 + p1Pct / 100) : undefined,
      phase2Target: p2Pct ? startBal * (1 + p2Pct / 100) : undefined,
      phase3Target: p3Pct ? startBal * (1 + p3Pct / 100) : undefined,
      phase1TargetPercent: p1Pct,
      phase2TargetPercent: p2Pct,
      phase3TargetPercent: p3Pct,
      maxDrawdownLimit: mxPct ? currentSize * (mxPct / 100) : undefined,
      dailyDrawdownLimit: ddPct ? currentSize * (ddPct / 100) : undefined,
      targetPercent: tPct,
      dailyDrawdownPercent: ddPct,
      maxDrawdownPercent: mxPct,
      steps: isPropFirm(form.type) ? steps : undefined,
      status: editAcc?.status,
      payouts: editAcc?.payouts || [],
    };
    if (editAcc) {
      updateAccount(acc);
    } else {
      addAccount(acc);
    }
    setShowForm(false);
  };

  const openEdit = (acc: TradingAccount) => {
    setEditAcc(acc);
    setForm({
      name: acc.name, broker: acc.broker, type: acc.type,
      startingBalance: String(acc.startingBalance), currency: acc.currency,
      stage: acc.stage || '', targetBalance: acc.targetBalance ? String(acc.targetBalance) : '',
      phase1TargetPercent: acc.phase1TargetPercent ? String(acc.phase1TargetPercent) : '',
      phase2TargetPercent: acc.phase2TargetPercent ? String(acc.phase2TargetPercent) : '',
      phase3TargetPercent: acc.phase3TargetPercent ? String(acc.phase3TargetPercent) : '',
      targetPercent: acc.targetPercent ? String(acc.targetPercent) : '',
      dailyDrawdownPercent: acc.dailyDrawdownPercent ? String(acc.dailyDrawdownPercent) : '',
      maxDrawdownPercent: acc.maxDrawdownPercent ? String(acc.maxDrawdownPercent) : '',
      steps: String(acc.steps || 2),
    });
    setShowForm(true);
  };

  const openTxForm = (accountId: string, type: 'Deposit' | 'Withdrawal') => {
    setTxType(type);
    setTxForm({ date: new Date().toISOString().split('T')[0], accountId, type, amount: '', note: '' });
    setShowTxForm(true);
  };

  const handleTx = () => {
    addTransaction({
      id: crypto.randomUUID(),
      date: txForm.date, accountId: txForm.accountId,
      type: txForm.type, amount: parseFloat(txForm.amount) || 0, note: txForm.note,
    });
    setShowTxForm(false);
    if (txForm.type === 'Withdrawal') {
      const acc = accounts.find(a => a.id === txForm.accountId);
      if (acc && isPropFirm(acc.type)) {
        if (window.confirm('Did account scale after this payout? Click OK to log a scale-up.')) {
          openScaleForm(txForm.accountId);
        }
      }
    }
  };

  const openScaleForm = (accountId: string) => {
    setScaleForm({ accountId, newSize: '', note: '', date: new Date().toISOString().split('T')[0] });
    setShowScaleForm(true);
  };

  const handleScale = () => {
    const acc = accounts.find(a => a.id === scaleForm.accountId);
    if (!acc) return;
    const newSize = parseFloat(scaleForm.newSize) || 0;
    if (newSize <= acc.currentSize) {
      alert('New size must be greater than current size.');
      return;
    }

    const event: ScaleEvent = {
      id: crypto.randomUUID(),
      accountId: acc.id,
      date: scaleForm.date,
      oldSize: acc.currentSize,
      newSize,
      note: scaleForm.note || undefined,
    };
    addScaleEvent(event);

    // Scale = Funded automatically, all phases completed
    updateAccount({
      ...acc,
      currentSize: newSize,
      stage: 'Funded',
      targetBalance: acc.targetPercent ? newSize * (1 + acc.targetPercent / 100) : acc.targetBalance,
      maxDrawdownLimit: acc.maxDrawdownPercent ? newSize * (acc.maxDrawdownPercent / 100) : acc.maxDrawdownLimit,
      dailyDrawdownLimit: acc.dailyDrawdownPercent ? newSize * (acc.dailyDrawdownPercent / 100) : acc.dailyDrawdownLimit,
    });
    setShowScaleForm(false);
  };

  const getBalance = useCallback((acc: TradingAccount) => {
    const accTrades = trades.filter(t => t.accounts.some(a => a.accountId === acc.id));
    const tradePL = accTrades.reduce((s, t) => s + t.profitLoss, 0);
    const accTxs = transactions.filter(t => t.accountId === acc.id);
    const deposits = accTxs.filter(t => t.type === 'Deposit').reduce((s, t) => s + t.amount, 0);
    const withdrawals = accTxs.filter(t => t.type === 'Withdrawal').reduce((s, t) => s + t.amount, 0);
    return acc.startingBalance + deposits - withdrawals + tradePL;
  }, [trades, transactions]);

  const deriveStatus = useCallback((acc: TradingAccount): AccountStatus => {
    if (acc.status === 'Disabled') return 'Disabled';
    if (!isPropFirm(acc.type)) return 'Active';
    const balance = getBalance(acc);
    // Check max drawdown
    if (acc.maxDrawdownLimit && balance <= acc.startingBalance - acc.maxDrawdownLimit) return 'Disabled';
    // Check daily drawdown
    if (acc.dailyDrawdownLimit) {
      const today = new Date().toISOString().split('T')[0];
      const todayPL = trades.filter(t => t.date === today && t.accounts.some(a => a.accountId === acc.id))
        .reduce((s, t) => s + t.profitLoss, 0);
      if (todayPL <= -(acc.dailyDrawdownLimit)) return 'Disabled';
    }
    if (acc.stage === 'Funded' || acc.stage === 'Scale Up') return 'Active';
    return 'Evaluation';
  }, [getBalance, trades]);

  const deriveStage = useCallback((acc: TradingAccount): PropFirmStage | undefined => {
    if (!isPropFirm(acc.type)) return acc.stage;
    if (!acc.stage) return acc.stage;
    if (acc.stage === 'Funded' || acc.stage === 'Scale Up') return acc.stage;
    const balance = getBalance(acc);
    const steps = getSteps(acc);

    // Check phase progression
    if (acc.stage === 'Phase 1' && acc.phase1Target && balance >= acc.phase1Target) {
      const nextStage: PropFirmStage = steps >= 2 ? 'Phase 2' : 'Funded';
      setTimeout(() => updateAccount({ ...acc, stage: nextStage }), 0);
      return nextStage;
    }
    if (acc.stage === 'Phase 2' && steps >= 2) {
      const target = acc.phase2Target || acc.targetBalance;
      if (target && balance >= target) {
        const nextStage: PropFirmStage = steps >= 3 ? 'Phase 3' : 'Funded';
        setTimeout(() => updateAccount({ ...acc, stage: nextStage }), 0);
        return nextStage;
      }
    }
    if (acc.stage === 'Phase 3' && steps >= 3) {
      const target = acc.phase3Target || acc.targetBalance;
      if (target && balance >= target) {
        setTimeout(() => updateAccount({ ...acc, stage: 'Funded' }), 0);
        return 'Funded';
      }
    }
    return acc.stage;
  }, [getBalance, updateAccount]);

  const getCompletedPhases = (acc: TradingAccount, currentStage?: PropFirmStage): string[] => {
    if (!currentStage) return [];
    const phases = getPhases(acc);
    const currentIdx = phases.indexOf(currentStage === 'Scale Up' ? 'Funded' : currentStage);
    return phases.filter((_, i) => i < currentIdx);
  };

  const getProgress = (acc: TradingAccount) => {
    const stage = deriveStage(acc);
    if (!stage) return 0;
    if (stage === 'Funded' || stage === 'Scale Up') return 100;
    const bal = getBalance(acc);
    const target = getPhaseTarget(acc, stage);
    if (!target) return 0;
    return Math.min(100, Math.max(0, ((bal - acc.startingBalance) / (target - acc.startingBalance)) * 100));
  };

  const toggleDisable = (acc: TradingAccount) => {
    updateAccount({ ...acc, status: acc.status === 'Disabled' ? undefined : 'Disabled' });
  };

  const activeTrades = useMemo(() => {
    if (!selectedAccountId) return trades;
    return trades.filter(t => t.accounts.some(a => a.accountId === selectedAccountId));
  }, [trades, selectedAccountId]);

  const validActiveTrades = useMemo(() => activeTrades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'), [activeTrades]);

  const activeMetrics = useMemo(() => ({
    total: activeTrades.length,
    winRate: calcWinRate(activeTrades),
    totalPL: validActiveTrades.reduce((s, t) => s + t.profitLoss, 0),
    totalRR: calcAvgRR(activeTrades) * validActiveTrades.length,
    profitFactor: calcProfitFactor(activeTrades),
    maxDrawdown: calcMaxDrawdown(activeTrades),
  }), [activeTrades, validActiveTrades]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || null;
  const selectedAccountTrades = useMemo(() => {
    if (!selectedAccountId) return trades;
    return trades.filter(t => t.accounts.some(a => a.accountId === selectedAccountId));
  }, [trades, selectedAccountId]);
  const selectedAccountTxs = useMemo(() => {
    if (!selectedAccountId) return transactions;
    return transactions.filter(t => t.accountId === selectedAccountId);
  }, [transactions, selectedAccountId]);
  const selectedScaleEvents = useMemo(() => {
    if (!selectedAccountId) return scaleEvents;
    return scaleEvents.filter(e => e.accountId === selectedAccountId);
  }, [scaleEvents, selectedAccountId]);

  const totalScaleUps = useMemo(() => {
    if (selectedAccountId) return scaleEvents.filter(e => e.accountId === selectedAccountId).length;
    return scaleEvents.length;
  }, [scaleEvents, selectedAccountId]);

  const latestScale = useMemo(() => {
    const relevant = selectedAccountId ? scaleEvents.filter(e => e.accountId === selectedAccountId) : scaleEvents;
    if (relevant.length === 0) return null;
    return relevant.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [scaleEvents, selectedAccountId]);

  const growthPercent = useMemo(() => {
    if (selectedAccount) {
      if (selectedAccount.initialSize === 0) return 0;
      return ((selectedAccount.currentSize - selectedAccount.initialSize) / selectedAccount.initialSize) * 100;
    }
    const totalInitial = accounts.reduce((s, a) => s + (a.initialSize || a.startingBalance), 0);
    const totalCurrent = accounts.reduce((s, a) => s + (a.currentSize || a.startingBalance), 0);
    if (totalInitial === 0) return 0;
    return ((totalCurrent - totalInitial) / totalInitial) * 100;
  }, [selectedAccount, accounts]);

  const safeSize = (acc: TradingAccount) => acc.currentSize || acc.startingBalance || 0;
  const safeInitial = (acc: TradingAccount) => acc.initialSize || acc.startingBalance || 0;

  const getGrowth = (acc: TradingAccount) => {
    const initial = safeInitial(acc);
    if (initial === 0) return 0;
    return ((safeSize(acc) - initial) / initial) * 100;
  };

  const isScaled = (acc: TradingAccount) => scaleEvents.some(e => e.accountId === acc.id);

  const renderAccountCard = (acc: TradingAccount, isArchived = false) => {
    const balance = getBalance(acc);
    const pl = balance - acc.startingBalance;
    const isSelected = selectedAccountId === acc.id;
    const status = deriveStatus(acc);
    const currentStage = deriveStage(acc);
    const progress = getProgress(acc);
    const growth = getGrowth(acc);
    const scaled = isScaled(acc);
    const completedPhases = getCompletedPhases(acc, currentStage);
    const isFundedOrScaled = currentStage === 'Funded' || currentStage === 'Scale Up';

    return (
      <div
        key={acc.id}
        onClick={() => setSelectedAccountId(acc.id)}
        className={cn(
          'flex-shrink-0 min-w-[280px] bg-card border rounded-lg p-4 cursor-pointer transition-all relative group',
          isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground/30',
          isArchived && 'opacity-60'
        )}
      >
        {/* Status badge top-right */}
        <div className="absolute top-3 right-3">
          <AccountStatusBadge status={status} />
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold">{acc.name}</p>
                {scaled && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-primary/20 text-primary">Scaled → Funded ✓</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{acc.broker} · {acc.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 mr-16">
            <Button
              variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); openEdit(acc); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
              onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Balance = Current Size always */}
        <div className="flex items-center justify-between text-xs">
          <div>
            <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Balance</p>
            <p className="font-mono font-semibold text-sm">{acc.currency} {(acc.currentSize || acc.startingBalance || 0).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">P/L</p>
            <p className={cn('font-mono font-semibold text-sm', pl >= 0 ? 'text-success' : 'text-destructive')}>
              {formatCurrency(pl)}
            </p>
          </div>
        </div>

        {/* Size & Growth */}
        <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
          <div>
            <p className="text-muted-foreground">Initial</p>
            <p className="font-mono font-medium">{formatCurrency(acc.initialSize || acc.startingBalance)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Size</p>
            <p className="font-mono font-medium">{formatCurrency(safeSize(acc))}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Growth</p>
            <p className={cn('font-mono font-medium', growth > 0 ? 'text-success' : growth < 0 ? 'text-destructive' : '')}>
              {growth.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Risk Rules - % only, no dollar values */}
        {(acc.targetPercent || acc.dailyDrawdownPercent || acc.maxDrawdownPercent) && (
          <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
            {acc.targetPercent && <p>Target: {acc.targetPercent}%</p>}
            {acc.dailyDrawdownPercent && <p>Daily DD: {acc.dailyDrawdownPercent}%</p>}
            {acc.maxDrawdownPercent && <p>Max DD: {acc.maxDrawdownPercent}%</p>}
          </div>
        )}

        {/* Phase progress bar */}
        {isPropFirm(acc.type) && currentStage && (
          <>
            <PhaseProgressBar
              currentStage={currentStage}
              progress={progress}
              steps={getSteps(acc)}
              completedPhases={completedPhases}
            />
            {status === 'Disabled' && (
              <p className="text-[10px] font-semibold text-destructive mt-1">⛔ Account Failed — Drawdown limit breached</p>
            )}
            {/* Phase completion messages */}
            {completedPhases.includes('Phase 1') && currentStage === 'Phase 2' && (
              <p className="text-[10px] font-semibold text-success mt-1">🎉 Phase 1 Passed! Now in Phase 2</p>
            )}
            {completedPhases.includes('Phase 2') && currentStage === 'Phase 3' && (
              <p className="text-[10px] font-semibold text-success mt-1">🎉 Phase 2 Passed! Now in Phase 3</p>
            )}
            {isFundedOrScaled && (
              <p className="text-[10px] font-semibold text-success mt-1">🏆 All phases passed! You are Funded!</p>
            )}
          </>
        )}

        {/* Simple progress for non-prop accounts */}
        {!isPropFirm(acc.type) && acc.targetBalance && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Target</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Action buttons — No deposit for prop firms, withdraw only when funded */}
        <div className="flex gap-2 mt-3">
          {/* Deposit: only for non-prop accounts */}
          {!isPropFirm(acc.type) && (
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1"
              onClick={(e) => { e.stopPropagation(); openTxForm(acc.id, 'Deposit'); }}>
              Deposit
            </Button>
          )}

          {/* Withdraw: only for funded prop firms or non-prop accounts */}
          {(!isPropFirm(acc.type) || isFundedOrScaled) ? (
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1"
              onClick={(e) => { e.stopPropagation(); openTxForm(acc.id, 'Withdrawal'); }}>
              <ArrowUpRight className="h-3 w-3 text-destructive" /> Withdraw
            </Button>
          ) : isPropFirm(acc.type) ? (
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 opacity-40 cursor-not-allowed" disabled>
              <ArrowUpRight className="h-3 w-3" /> Withdraw
            </Button>
          ) : null}

          {/* Scale: only for prop firms */}
          {isPropFirm(acc.type) && (
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1"
              onClick={(e) => { e.stopPropagation(); openScaleForm(acc.id); }}>
              <TrendingUp className="h-3 w-3 text-primary" /> Scale
            </Button>
          )}
        </div>
        <Button
          variant="ghost" size="sm" className="w-full h-6 text-[10px] mt-1 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); toggleDisable(acc); }}
        >
          {acc.status === 'Disabled' ? 'Enable' : 'Disable'}
        </Button>
      </div>
    );
  };

  return (
    <div className="p-6 w-full">
      <PageHeader title="Accounts" subtitle="All accounts combined">
        <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add Account
        </Button>
      </PageHeader>

      {/* Active Account Cards */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
        <div
          onClick={() => setSelectedAccountId(null)}
          className={cn(
            'flex-shrink-0 min-w-[200px] bg-card border rounded-lg p-4 cursor-pointer transition-all',
            !selectedAccountId ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:border-muted-foreground/30'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">All Accounts</p>
              <p className="text-[10px] text-muted-foreground">{trades.length} trades</p>
            </div>
          </div>
        </div>

        {activeAccounts.map(acc => renderAccountCard(acc))}
      </div>

      {/* Archived / Failed Accounts */}
      {archivedAccounts.length > 0 && (
        <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen} className="mb-6">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2 text-muted-foreground text-xs w-full justify-start">
              <Archive className="h-3.5 w-3.5" />
              Archived / Failed Accounts ({archivedAccounts.length})
              <span className="text-[10px]">{archivedOpen ? '▲' : '▼'}</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex gap-3 mt-2 overflow-x-auto pb-2">
              {archivedAccounts.map(acc => renderAccountCard(acc, true))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard label="Trades" value={activeMetrics.total} icon={BarChart3} tooltip="Total trades taken on this account" />
            <MetricCard label="Win Rate" value={formatPercent(activeMetrics.winRate)} trend={activeMetrics.winRate >= 50 ? 'up' : 'down'} tooltip="Percentage of winning trades on this account" />
            <MetricCard label="Total P/L" value={formatCurrency(activeMetrics.totalPL)} trend={activeMetrics.totalPL >= 0 ? 'up' : 'down'} tooltip="Net profit or loss across all trades on this account" />
            <MetricCard label="Total RR" value={activeMetrics.totalRR.toFixed(1)} tooltip="Sum of all risk-reward ratios achieved on this account" />
            <MetricCard label="Profit Factor" value={activeMetrics.profitFactor === Infinity ? '∞' : activeMetrics.profitFactor.toFixed(2)} tooltip="Gross profits ÷ gross losses. Above 1.5 is considered strong" />
            <MetricCard label="Max Drawdown" value={formatCurrency(activeMetrics.maxDrawdown)} trend="down" tooltip="Largest drop from a peak in your equity curve" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <MetricCard label="Total Scale-Ups" value={totalScaleUps} icon={TrendingUp} tooltip="Number of times your account size was increased" />
            <MetricCard label="Latest Scale" value={latestScale ? `${formatCurrency(latestScale.oldSize)} → ${formatCurrency(latestScale.newSize)}` : 'N/A'} tooltip="Most recent account size upgrade" />
            <MetricCard label="Growth %" value={`${growthPercent.toFixed(1)}%`} trend={growthPercent > 0 ? 'up' : growthPercent < 0 ? 'down' : undefined} tooltip="Percentage growth from initial to current account size" />
          </div>

          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Equity Curve</h3>
            <div className="h-[300px]">
              <EquityCurveChart trades={activeTrades} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              {selectedAccount ? `${selectedAccount.name} History` : 'All Accounts History'}
            </h3>
            {selectedAccount ? (
              <AccountHistory account={selectedAccount} trades={selectedAccountTrades} transactions={selectedAccountTxs} scaleEvents={selectedScaleEvents} />
            ) : (
              <div className="space-y-6">
                {accounts.map(acc => {
                  const accTrades = trades.filter(t => t.accounts.some(a => a.accountId === acc.id));
                  const accTxs = transactions.filter(t => t.accountId === acc.id);
                  const accScales = scaleEvents.filter(e => e.accountId === acc.id);
                  if (accTrades.length === 0 && accTxs.length === 0 && accScales.length === 0) return null;
                  return (
                    <div key={acc.id}>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">{acc.name}</h4>
                      <AccountHistory account={acc} trades={accTrades} transactions={accTxs} scaleEvents={accScales} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <AccountPerformance
            account={selectedAccount}
            trades={selectedAccountTrades}
            accounts={accounts}
            transactions={transactions}
            scaleEvents={selectedAccountId ? selectedScaleEvents : scaleEvents}
          />
        </TabsContent>
      </Tabs>

      {/* Account Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{editAcc ? 'Edit Account' : 'Add Account'}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Broker</Label><Input value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value }))} className="h-8 text-xs" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as AccountType }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label className="text-xs">Currency</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Starting Balance</Label><Input type="number" value={form.startingBalance} onChange={e => setForm(f => ({ ...f, startingBalance: e.target.value }))} className="h-8 text-xs font-mono" /></div>
              {!isPropFirm(form.type) && (
                <div><Label className="text-xs">Target Balance</Label><Input type="number" value={form.targetBalance} onChange={e => setForm(f => ({ ...f, targetBalance: e.target.value }))} className="h-8 text-xs font-mono" /></div>
              )}
            </div>

            {/* Risk Rules % */}
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Risk Rules (%)</p>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Target %</Label><Input type="number" value={form.targetPercent} onChange={e => setForm(f => ({ ...f, targetPercent: e.target.value }))} className="h-8 text-xs font-mono" placeholder="e.g. 10" /></div>
                <div><Label className="text-xs">Daily DD %</Label><Input type="number" value={form.dailyDrawdownPercent} onChange={e => setForm(f => ({ ...f, dailyDrawdownPercent: e.target.value }))} className="h-8 text-xs font-mono" placeholder="e.g. 5" /></div>
                <div><Label className="text-xs">Max DD %</Label><Input type="number" value={form.maxDrawdownPercent} onChange={e => setForm(f => ({ ...f, maxDrawdownPercent: e.target.value }))} className="h-8 text-xs font-mono" placeholder="e.g. 10" /></div>
              </div>
            </div>

            {isPropFirm(form.type) && (
              <>
                {/* Steps selector */}
                <div className="border-t border-border pt-3 mt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Evaluation Steps</p>
                  <div className="flex gap-2">
                    {['1', '2', '3'].map(s => (
                      <Button
                        key={s}
                        type="button"
                        variant={form.steps === s ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => setForm(f => ({ ...f, steps: s }))}
                      >
                        {s} Step{s !== '1' ? 's' : ''}
                      </Button>
                    ))}
                  </div>
                </div>

                <div><Label className="text-xs">Starting Stage</Label>
                  <Select value={form.stage || ''} onValueChange={v => setForm(f => ({ ...f, stage: v as PropFirmStage }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Phase 1">Phase 1</SelectItem>
                      {parseInt(form.steps) >= 2 && <SelectItem value="Phase 2">Phase 2</SelectItem>}
                      {parseInt(form.steps) >= 3 && <SelectItem value="Phase 3">Phase 3</SelectItem>}
                      <SelectItem value="Funded">Funded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Phase targets as % */}
                <div className={cn("grid gap-3", parseInt(form.steps) >= 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                  <div><Label className="text-xs">Phase 1 Target %</Label><Input type="number" value={form.phase1TargetPercent} onChange={e => setForm(f => ({ ...f, phase1TargetPercent: e.target.value }))} className="h-8 text-xs font-mono" placeholder="e.g. 8" /></div>
                  {parseInt(form.steps) >= 2 && (
                    <div><Label className="text-xs">Phase 2 Target %</Label><Input type="number" value={form.phase2TargetPercent} onChange={e => setForm(f => ({ ...f, phase2TargetPercent: e.target.value }))} className="h-8 text-xs font-mono" placeholder="e.g. 5" /></div>
                  )}
                  {parseInt(form.steps) >= 3 && (
                    <div><Label className="text-xs">Phase 3 Target %</Label><Input type="number" value={form.phase3TargetPercent} onChange={e => setForm(f => ({ ...f, phase3TargetPercent: e.target.value }))} className="h-8 text-xs font-mono" placeholder="e.g. 5" /></div>
                  )}
                </div>
                {/* Show calculated values */}
                {form.startingBalance && (form.phase1TargetPercent || form.phase2TargetPercent || form.phase3TargetPercent) && (
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    {form.phase1TargetPercent && <p>Phase 1 Target: {formatCurrency((parseFloat(form.startingBalance) || 0) * (1 + parseFloat(form.phase1TargetPercent) / 100))}</p>}
                    {form.phase2TargetPercent && <p>Phase 2 Target: {formatCurrency((parseFloat(form.startingBalance) || 0) * (1 + parseFloat(form.phase2TargetPercent) / 100))}</p>}
                    {form.phase3TargetPercent && <p>Phase 3 Target: {formatCurrency((parseFloat(form.startingBalance) || 0) * (1 + parseFloat(form.phase3TargetPercent) / 100))}</p>}
                  </div>
                )}
              </>
            )}
            <Button onClick={handleSave} className="w-full">{editAcc ? 'Update' : 'Add Account'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Form */}
      <Dialog open={showTxForm} onOpenChange={setShowTxForm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{txType === 'Deposit' ? 'Deposit Funds' : 'Withdraw Funds'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Date</Label><Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Amount</Label><Input type="number" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-xs font-mono" placeholder="0.00" /></div>
            <div><Label className="text-xs">Note</Label><Input value={txForm.note} onChange={e => setTxForm(f => ({ ...f, note: e.target.value }))} className="h-8 text-xs" placeholder="Optional note..." /></div>
            <Button onClick={handleTx} className={cn("w-full", txType === 'Deposit' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90')}>
              {txType === 'Deposit' ? 'Deposit' : 'Withdraw'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scale-Up Form */}
      <Dialog open={showScaleForm} onOpenChange={setShowScaleForm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Scale Up Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {(() => {
              const acc = accounts.find(a => a.id === scaleForm.accountId);
              if (!acc) return null;
              return (
                <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                  <p className="font-semibold">{acc.name}</p>
                  <p className="text-muted-foreground">Current Size: <span className="font-mono font-medium text-foreground">{formatCurrency(safeSize(acc))}</span></p>
                </div>
              );
            })()}
            <div><Label className="text-xs">Date</Label><Input type="date" value={scaleForm.date} onChange={e => setScaleForm(f => ({ ...f, date: e.target.value }))} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">New Account Size</Label><Input type="number" value={scaleForm.newSize} onChange={e => setScaleForm(f => ({ ...f, newSize: e.target.value }))} className="h-8 text-xs font-mono" placeholder="e.g. 12000" /></div>
            <div><Label className="text-xs">Note</Label><Input value={scaleForm.note} onChange={e => setScaleForm(f => ({ ...f, note: e.target.value }))} className="h-8 text-xs" placeholder="e.g. After first payout" /></div>
            <Button onClick={handleScale} className="w-full bg-primary hover:bg-primary/90">Scale Up</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
