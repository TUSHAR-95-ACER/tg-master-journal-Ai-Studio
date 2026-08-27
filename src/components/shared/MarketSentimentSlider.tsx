import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MarketSentimentSliderProps {
  /** Long percentage 0-100. 50 = balanced. null/undefined = unset (defaults to 50 visually). */
  value?: number | null;
  onChange: (longPct: number) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Horizontal draggable sentiment slider.
 * Far left = 100% short / 0% long. Far right = 0% short / 100% long. Center = 50/50.
 */
export function MarketSentimentSlider({ value, onChange, className, disabled }: MarketSentimentSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const longPct = Math.max(0, Math.min(100, value ?? 50));
  const shortPct = 100 - longPct;

  const updateFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const next = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    onChange(next);
  }, [onChange]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, updateFromClientX]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    setDragging(true);
    updateFromClientX(e.clientX);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (disabled) return;
    const delta = Math.sign(e.deltaX || e.deltaY);
    if (!delta) return;
    e.preventDefault();
    onChange(Math.max(0, Math.min(100, longPct + delta)));
  };

  return (
    <div className={cn('select-none', className)}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        className={cn(
          'relative h-10 rounded-xl border border-border bg-background overflow-hidden cursor-ew-resize',
          'transition-shadow',
          dragging && 'shadow-[0_0_0_2px_hsl(var(--primary)/0.35)]',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {/* Red short fill (left) */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-destructive/30 to-destructive/10 transition-all duration-150"
          style={{ width: `${shortPct}%` }}
        />
        {/* Green long fill (right) */}
        <div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-success/30 to-success/10 transition-all duration-150"
          style={{ width: `${longPct}%` }}
        />
        {/* Center line */}
        <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 w-px bg-border/60 pointer-events-none" />
        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-7 w-1.5 rounded-full bg-foreground/80 shadow-md pointer-events-none transition-[left] duration-150"
          style={{ left: `${longPct}%` }}
        />
        {/* Labels */}
        <div className="relative z-10 flex items-center justify-between h-full px-3 text-[11px] font-heading font-semibold tracking-wide pointer-events-none">
          <span className="text-destructive">SHORT {shortPct}%</span>
          <span className="text-success">LONG {longPct}%</span>
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground/60 px-1">
        <span>Bearish crowd</span>
        <span>Balanced</span>
        <span>Bullish crowd</span>
      </div>
    </div>
  );
}
