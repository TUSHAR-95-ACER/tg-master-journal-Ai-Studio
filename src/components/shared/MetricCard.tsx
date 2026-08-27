import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { HeaderActions } from '@/components/layout/HeaderActions';

/** Format large numbers compactly: 10000 → 10K, 1000000 → 1M */
export function formatCompactNumber(value: string | number): string {
  if (typeof value === 'string') {
    // Try to parse currency strings like "$10,000.00" or "-$5,000.00"
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return value;
    const prefix = value.startsWith('-') || value.includes('-$') ? '-' : '';
    const currency = value.includes('$') ? '$' : '';
    const percent = value.includes('%') ? '%' : '';
    const abs = Math.abs(num);
    if (abs >= 1_000_000) return `${prefix}${currency}${(abs / 1_000_000).toFixed(1)}M${percent}`;
    if (abs >= 10_000) return `${prefix}${currency}${(abs / 1_000).toFixed(1)}K${percent}`;
    return value;
  }
  return String(value);
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  emphasis?: 'gold';
  className?: string;
  tooltip?: string;
  /** Comparison vs previous period (e.g. "+12.4%", "-$42"). null = not enough data, undefined = hide */
  delta?: string | null;
  /** 'up' = green (good), 'down' = red (bad), 'flat' = gray */
  deltaTone?: 'up' | 'down' | 'flat';
  deltaLabel?: string;
}

export function MetricCard({ label, value, icon: Icon, subtitle, trend, emphasis, className, tooltip, delta, deltaTone, deltaLabel = 'vs last 30 days' }: MetricCardProps) {
  const displayValue = formatCompactNumber(value);

  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-3 sm:p-4 animate-fade-in overflow-hidden",
      emphasis === 'gold' && 'border-gold/45 bg-[linear-gradient(135deg,hsl(var(--gold)/0.12),hsl(var(--card))_58%)] shadow-[0_0_0_1px_hsl(var(--gold)/0.12)_inset,0_12px_30px_-24px_hsl(var(--gold)/0.75)]',
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className={cn(
            "text-[10px] sm:text-xs font-medium uppercase tracking-wider truncate",
            emphasis === 'gold' ? 'text-gold' : 'text-muted-foreground',
          )}>{label}</span>
        </div>
        {Icon && (
          tooltip ? (
            <InfoTooltip text={tooltip}>
              <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ml-1", emphasis === 'gold' ? 'text-gold' : 'text-muted-foreground')} />
            </InfoTooltip>
          ) : (
            <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 ml-1", emphasis === 'gold' ? 'text-gold' : 'text-muted-foreground')} />
          )
        )}
      </div>
      <div className={cn(
        "font-heading font-bold tracking-tight break-words overflow-wrap-anywhere",
        "text-lg sm:text-xl lg:text-2xl",
        emphasis === 'gold' && 'text-gold',
        trend === 'up' && 'text-success',
        trend === 'down' && 'text-destructive',
      )}>
        <span className="hidden sm:inline">{value}</span>
        <span className="sm:hidden">{displayValue}</span>
      </div>
      {delta !== undefined && (
        delta === null ? (
          <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-1.5 truncate italic">Not enough data</p>
        ) : (
          <p className={cn(
            "text-[10px] sm:text-[11px] font-medium mt-1.5 truncate tabular-nums",
            deltaTone === 'up' && 'text-success',
            deltaTone === 'down' && 'text-destructive',
            (!deltaTone || deltaTone === 'flat') && 'text-muted-foreground',
          )}>
            {delta} <span className="text-muted-foreground/70 font-normal">{deltaLabel}</span>
          </p>
        )
      )}
      {subtitle && (
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
      )}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
      <div className="relative pl-3">
        <span aria-hidden className="absolute left-0 top-1 bottom-1 w-[3px] rounded-sm bg-gradient-to-b from-gold via-gold/70 to-primary shadow-[0_0_10px_hsl(var(--gold)/0.6)]" />
        <h1 className="font-heading text-xl sm:text-2xl font-bold uppercase tracking-[0.12em]">
          <span className="bg-gradient-to-r from-gold via-foreground to-foreground bg-clip-text text-transparent">{title}</span>
        </h1>
        {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <HeaderActions>{children}</HeaderActions>
    </div>
  );
}
