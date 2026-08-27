import { useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { useTrading } from '@/contexts/TradingContext';
import type { Trade } from '@/types/trading';
import { getRawUrl } from '@/lib/mediaSlot';
import { SmartImg } from '@/components/shared/SmartImg';

interface Props {
  trade: Trade;
  alt: string;
  className?: string;
}

/**
 * Renders a trade chart image, lazily fetching the heavy media column
 * once the card scrolls into view. Slot values may be raw URLs, data URLs,
 * or encoded `urlmeta:` link previews — always resolve via getRawUrl.
 */
export function LazyTradeImage({ trade, alt, className }: Props) {
  const { hydrateTradeMedia } = useTrading();
  const ref = useRef<HTMLDivElement | null>(null);
  const initial = trade.executionImage || trade.predictionImage || null;
  const [src, setSrc] = useState<string | null>(initial);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(Boolean(initial));

  useEffect(() => {
    if (tried || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          io.disconnect();
          setTried(true);
          setLoading(true);
          hydrateTradeMedia(trade.id).then(full => {
            setLoading(false);
            if (!full) return;
            setSrc(full.executionImage || full.predictionImage || null);
          });
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [trade.id, hydrateTradeMedia, tried]);

  const resolvedSrc = src ? getRawUrl(src) : null;
  const isLoadable = !!resolvedSrc && /^(https?:|data:|blob:|\/)/.test(resolvedSrc);

  return (
    <div ref={ref} className={className}>
      {isLoadable ? (
        <SmartImg
          src={resolvedSrc!}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
      ) : loading ? (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
          <ImageOff className="h-10 w-10" />
          <span className="text-xs font-medium">No Chart</span>
        </div>
      )}
    </div>
  );
}
