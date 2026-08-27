// Shared bias system: options + colors + directional icons.
// Used in Daily/Weekly plans, tags, analytics, charts.

import { TrendingUp, TrendingDown, Minus, MoveHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Bias = 'Bullish' | 'Bearish' | 'Neutral' | 'Sideways';

export interface BiasMeta {
  value: Bias;
  label: string;
  icon: LucideIcon;
  text: string;
  bg: string;
  border: string;
  dot: string;
  /** Numeric direction for analytics: -1 bearish → +1 bullish. 0 = no directional view. */
  score: number;
}

export const BIAS_META: Record<Bias, BiasMeta> = {
  Bullish: {
    value: 'Bullish', label: 'Bullish', icon: TrendingUp,
    text: 'text-success', bg: 'bg-success/15', border: 'border-success/30', dot: 'bg-success',
    score: 1,
  },
  Bearish: {
    value: 'Bearish', label: 'Bearish', icon: TrendingDown,
    text: 'text-destructive', bg: 'bg-destructive/15', border: 'border-destructive/30', dot: 'bg-destructive',
    score: -1,
  },
  Neutral: {
    value: 'Neutral', label: 'Neutral', icon: Minus,
    text: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border', dot: 'bg-muted-foreground/60',
    score: 0,
  },
  Sideways: {
    value: 'Sideways', label: 'Sideways', icon: MoveHorizontal,
    text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/25', dot: 'bg-warning',
    score: 0,
  },
};

export const BIAS_OPTIONS: BiasMeta[] = [
  BIAS_META.Bullish,
  BIAS_META.Bearish,
  BIAS_META.Neutral,
  BIAS_META.Sideways,
];

export function getBiasMeta(bias: string | undefined | null): BiasMeta | null {
  if (!bias) return null;
  // Backward compat: collapse legacy "Slightly *" values onto the new 4.
  if (bias === 'Slightly Bullish') return BIAS_META.Bullish;
  if (bias === 'Slightly Bearish') return BIAS_META.Bearish;
  return (BIAS_META as Record<string, BiasMeta>)[bias] ?? null;
}

/** Map any (including legacy) bias label to the canonical 4-value set. */
export function normalizeBiasDirection(bias: string | undefined | null): Bias | '' {
  if (!bias) return '';
  if (bias === 'Bullish' || bias === 'Slightly Bullish') return 'Bullish';
  if (bias === 'Bearish' || bias === 'Slightly Bearish') return 'Bearish';
  if (bias === 'Sideways') return 'Sideways';
  if (bias === 'Neutral') return 'Neutral';
  return '';
}
