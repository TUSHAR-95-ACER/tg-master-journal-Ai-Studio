import { useMemo } from 'react';
import { DollarSign, Percent, TrendingUp, Award, ArrowDown, BarChart3, Zap } from 'lucide-react';
import { Trade, TradingAccount, Transaction, ScaleEvent } from '@/types/trading';
import { calcWinRate, calcProfitFactor, calcMaxDrawdown, calcAvgRR, formatCurrency, formatPercent } from '@/lib/calculations';
import { MetricCard } from '@/components/shared/MetricCard';
import { ChartHeader } from '@/components/shared/InfoTooltip';
import { EquityCurveChart } from '@/components/dashboard/EquityCurveChart';

interface AccountPerformanceProps {
  account: TradingAccount | null;
  trades: Trade[];
  accounts: TradingAccount[];
  transactions: Transaction[];
  scaleEvents?: ScaleEvent[];
}

export function AccountPerformance({ account, trades, accounts, transactions, scaleEvents = [] }: AccountPerformanceProps) {
  const validTrades = useMemo(() => trades.filter(t => t.result !== 'Untriggered Setup' && t.result !== 'Cancelled'), [trades]);
  const totalPL = useMemo(() => validTrades.reduce((s, t) => s + t.profitLoss, 0), [validTrades]);

  const totalPayouts = useMemo(() => {
    if (account) return account.payouts?.reduce((s, p) => s + p.amount, 0) || 0;
    return accounts.reduce((s, a) => s + (a.payouts?.reduce((ps, p) => ps + p.amount, 0) || 0), 0);
  }, [account, accounts]);

  const totalDeposits = useMemo(() => {
    const txs = account ? transactions.filter(t => t.accountId === account.id) : transactions;
    return txs.filter(t => t.type === 'Deposit').reduce((s, t) => s + t.amount, 0);
  }, [account, transactions]);

  const totalWithdrawals = useMemo(() => {
    const txs = account ? transactions.filter(t => t.accountId === account.id) : transactions;
    return txs.filter(t => t.type === 'Withdrawal').reduce((s, t) => s + t.amount, 0);
  }, [account, transactions]);

  const totalScaleUps = scaleEvents.length;
  const latestScale = useMemo(() => {
    if (scaleEvents.length === 0) return null;
    return [...scaleEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [scaleEvents]);

  const growthPercent = useMemo(() => {
    if (account) {
      const initial = account.initialSize || account.startingBalance;
      if (initial === 0) return 0;
      return (((account.currentSize || account.startingBalance) - initial) / initial) * 100;
    }
    const totalInitial = accounts.reduce((s, a) => s + (a.initialSize || a.startingBalance), 0);
    const totalCurrent = accounts.reduce((s, a) => s + (a.currentSize || a.startingBalance), 0);
    if (totalInitial === 0) return 0;
    return ((totalCurrent - totalInitial) / totalInitial) * 100;
  }, [account, accounts]);

  const avgRR = calcAvgRR(trades);
  const winRate = calcWinRate(trades);
  const pf = calcProfitFactor(trades);
  const dd = calcMaxDrawdown(trades);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total P/L" value={formatCurrency(totalPL)} icon={DollarSign} trend={totalPL >= 0 ? 'up' : 'down'} tooltip="Net profit or loss from all trades on this account" />
        <MetricCard label="Total Payouts" value={formatCurrency(totalPayouts)} icon={Award} trend="up" tooltip="Total money withdrawn as payouts from this account" />
        <MetricCard label="Win Rate" value={formatPercent(winRate)} icon={Percent} trend={winRate >= 50 ? 'up' : 'down'} tooltip="Percentage of winning trades" />
        <MetricCard label="Avg RR" value={avgRR.toFixed(2)} icon={TrendingUp} tooltip="Average risk-reward ratio achieved per trade" />
        <MetricCard label="Profit Factor" value={pf === Infinity ? '∞' : pf.toFixed(2)} icon={BarChart3} tooltip="Gross profit ÷ gross loss. Above 1.5 is strong" />
        <MetricCard label="Max Drawdown" value={formatCurrency(dd)} icon={ArrowDown} trend="down" tooltip="Largest peak-to-trough decline in equity" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Trades" value={trades.length} tooltip="Number of trades on this account" />
        <MetricCard label="Deposits" value={formatCurrency(totalDeposits)} tooltip="Total money deposited into this account" />
        <MetricCard label="Withdrawals" value={formatCurrency(totalWithdrawals)} tooltip="Total money withdrawn from this account" />
        <MetricCard label="Net Deposits" value={formatCurrency(totalDeposits - totalWithdrawals)} trend={totalDeposits - totalWithdrawals >= 0 ? 'up' : 'down'} tooltip="Deposits minus withdrawals — your net capital invested" />
        <MetricCard label="Total Scale-Ups" value={totalScaleUps} icon={Zap} tooltip="Number of times your account size was increased" />
        <MetricCard label="Growth %" value={`${growthPercent.toFixed(1)}%`} icon={TrendingUp} trend={growthPercent > 0 ? 'up' : growthPercent < 0 ? 'down' : undefined} tooltip="Percentage growth from initial to current account size" />
      </div>

      {latestScale && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs">
          <p className="font-semibold text-primary">Latest Scale-Up</p>
          <p className="text-muted-foreground mt-1">
            {formatCurrency(latestScale.oldSize)} → {formatCurrency(latestScale.newSize)}
            <span className="ml-2">({latestScale.date})</span>
            {latestScale.note && <span className="ml-1">· {latestScale.note}</span>}
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-4">
        <ChartHeader title="Equity Curve" tooltip="Visual representation of your account balance over time" />
        <div className="h-[300px]">
          <EquityCurveChart trades={trades} />
        </div>
      </div>
    </div>
  );
}
