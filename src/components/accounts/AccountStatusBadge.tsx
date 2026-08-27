import { cn } from '@/lib/utils';
import { AccountStatus } from '@/types/trading';

const STATUS_STYLES: Record<AccountStatus, string> = {
  Evaluation: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Funded: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Active: 'bg-success/15 text-success border-success/30',
  Disabled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const STATUS_DOT: Record<AccountStatus, string> = {
  Evaluation: 'bg-blue-400',
  Funded: 'bg-purple-400',
  Active: 'bg-success',
  Disabled: 'bg-destructive',
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
      STATUS_STYLES[status]
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {status}
    </span>
  );
}
