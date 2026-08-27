import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InfoTooltipProps {
  text?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Tooltip helper.
 * - With `children`: those children become the hover trigger (e.g. wrap an existing icon).
 * - Without `children`: renders NOTHING (legacy "(i)" trigger has been globally removed).
 */
export function InfoTooltip({ text, children }: InfoTooltipProps) {
  if (!children) return null;
  if (!text) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed border-gold/40 bg-background/95 text-foreground shadow-[0_0_18px_-6px_hsl(var(--gold)/0.5)]">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Reusable chart section header with gold accent bar. Title itself becomes the tooltip trigger. */
export function ChartHeader({ title, tooltip }: { title: string; tooltip?: string }) {
  const titleEl = (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
  );
  return (
    <div className="flex items-center gap-2 mb-3 sm:mb-4">
      <span aria-hidden className="inline-block h-3.5 w-[3px] rounded-sm bg-gradient-to-b from-gold via-gold/70 to-primary/60 shadow-[0_0_8px_hsl(var(--gold)/0.55)]" />
      {tooltip ? <InfoTooltip text={tooltip}>{titleEl}</InfoTooltip> : titleEl}
    </div>
  );
}
