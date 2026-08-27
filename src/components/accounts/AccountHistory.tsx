import { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { Trade, Transaction, TradingAccount, ScaleEvent } from '@/types/trading';
import { formatCurrency } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface AccountHistoryProps {
  account: TradingAccount;
  trades: Trade[];
  transactions: Transaction[];
  scaleEvents?: ScaleEvent[];
}

interface HistoryEvent {
  id: string;
  date: string;
  type: 'trade' | 'deposit' | 'withdrawal' | 'payout' | 'scale';
  label: string;
  amount: number;
  note?: string;
  scaleInfo?: { oldSize: number; newSize: number };
}

export function AccountHistory({ account, trades, transactions, scaleEvents = [] }: AccountHistoryProps) {
  const events = useMemo(() => {
    const items: HistoryEvent[] = [];

    trades.forEach(t => {
      items.push({ id: t.id, date: t.date, type: 'trade', label: `${t.asset} ${t.direction} — ${t.result}`, amount: t.profitLoss, note: t.notes });
    });

    transactions.forEach(tx => {
      items.push({ id: tx.id, date: tx.date, type: tx.type === 'Deposit' ? 'deposit' : 'withdrawal', label: tx.type, amount: tx.type === 'Withdrawal' ? -tx.amount : tx.amount, note: tx.note });
    });

    account.payouts?.forEach(p => {
      items.push({ id: p.id, date: p.date, type: 'payout', label: 'Payout', amount: -p.amount, note: p.note });
    });

    scaleEvents.forEach(se => {
      items.push({ id: se.id, date: se.date, type: 'scale', label: 'Scale Up', amount: se.newSize - se.oldSize, note: se.note, scaleInfo: { oldSize: se.oldSize, newSize: se.newSize } });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [trades, transactions, account.payouts, scaleEvents]);

  if (events.length === 0) {
    return <div className="text-center text-muted-foreground text-sm py-12">No history yet for this account.</div>;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="h-3.5 w-3.5 text-success" />;
      case 'withdrawal': return <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />;
      case 'payout': return <ArrowUpRight className="h-3.5 w-3.5 text-purple-400" />;
      case 'scale': return <Zap className="h-3.5 w-3.5 text-primary" />;
      default: return null;
    }
  };

  const getTradeIcon = (amount: number) =>
    amount >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />;

  return (
    <div className="space-y-1">
      {events.map(ev => (
        <div key={ev.id} className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", ev.type === 'scale' ? 'bg-primary/20' : 'bg-muted/50')}>
              {ev.type === 'trade' ? getTradeIcon(ev.amount) : getIcon(ev.type)}
            </div>
            <div>
              <p className="text-xs font-medium">
                {ev.label}
                {ev.scaleInfo && (
                  <span className="ml-2 text-muted-foreground">
                    {formatCurrency(ev.scaleInfo.oldSize)} → {formatCurrency(ev.scaleInfo.newSize)}
                  </span>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground">{ev.date}{ev.note ? ` · ${ev.note}` : ''}</p>
            </div>
          </div>
          {ev.type !== 'scale' && (
            <span className={cn('text-xs font-mono font-semibold', ev.amount >= 0 ? 'text-success' : 'text-destructive')}>
              {formatCurrency(ev.amount)}
            </span>
          )}
          {ev.type === 'scale' && (
            <span className="text-xs font-mono font-semibold text-primary">
              +{formatCurrency(ev.amount)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
