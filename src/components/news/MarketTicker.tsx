import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TickerItem {
  symbol: string;
  flag: string;
  price: number;
  change: number;
  changePercent: number;
  decimals: number;
}

const CACHE_KEY = 'market-ticker-cache-v2';
const CACHE_TS_KEY = 'market-ticker-cache-ts-v2';
const POLL_MS = 6 * 60 * 60 * 1000;  // 6 hours
const RETRY_MS = 5 * 60 * 1000;       // 5 min, only while data is missing
const MIN_GAP_MS = 60_000;            // 1 min floor between requests
const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // reuse cache without fetch if newer than 6h

function loadCache(): TickerItem[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>(() => loadCache());
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState(false);
  const itemsRef = useRef(items);
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef(false);
  itemsRef.current = items;

  useEffect(() => {
    let cancelled = false;

    const fetchPrices = async (force = false) => {
      const now = Date.now();
      if (inFlightRef.current) return;
      if (now - lastFetchRef.current < MIN_GAP_MS) return;
      // Skip if cached value is fresh enough.
      if (!force) {
        try {
          const ts = Number(localStorage.getItem(CACHE_TS_KEY) || 0);
          if (ts && now - ts < STALE_AFTER_MS && itemsRef.current.length > 0 && itemsRef.current.every(i => i.price > 0)) return;
        } catch {}
      }
      inFlightRef.current = true;
      lastFetchRef.current = now;
      try {
        const { data, error: fnError } = await supabase.functions.invoke('market-ticker');
        if (cancelled) return;
        if (fnError) throw fnError;
        if (data?.data && Array.isArray(data.data)) {
          setItems(prev => {
            const next = data.data.map((fresh: TickerItem) => {
              if (fresh.price > 0) return fresh;
              const cached = prev.find(p => p.symbol === fresh.symbol);
              return cached && cached.price > 0 ? cached : fresh;
            });
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(next));
              localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
            } catch {}
            return next;
          });
          setError(false);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Ticker fetch error:', e);
          setError(true);
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    fetchPrices();
    const poll = setInterval(fetchPrices, POLL_MS);
    const retry = setInterval(() => {
      const list = itemsRef.current;
      if (list.length === 0 || list.some(i => i.price === 0)) fetchPrices();
    }, RETRY_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(retry);
    };
  }, []); // mount once — never re-create timers on state change

  const formatPrice = (price: number, decimals: number) => {
    return price.toFixed(decimals);
  };

  if (items.length === 0) {
    return (
      <div className="w-full h-10 border-b border-border/50 bg-background flex items-center pl-4 pr-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          {error ? 'Market data unavailable' : 'Loading market data...'}
        </div>
      </div>
    );
  }


  const doubled = [...items, ...items];

  return (
    <div
      className="w-full border-b border-border/50 bg-background overflow-hidden flex items-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex-1 min-w-0 overflow-hidden">
        <div
          className={cn(
            "flex items-center gap-0 whitespace-nowrap py-3",
            "animate-marquee"
          )}
          style={isPaused ? { animationPlayState: 'paused' } : undefined}
        >
          {doubled.map((item, i) => (
            <div
              key={`${item.symbol}-${i}`}
              className="flex items-center gap-3 px-6 border-r border-border/30 last:border-r-0 cursor-default group transition-transform duration-200 hover:scale-105"
            >
              <span className="text-lg">{item.flag}</span>
              <span className="text-sm font-bold text-foreground tracking-wide">
                {item.symbol}
              </span>
              {item.price > 0 ? (
                <>
                  <span className="text-sm font-mono text-foreground/80">
                    {formatPrice(item.price, item.decimals)}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold font-mono",
                      item.changePercent >= 0 ? "text-success" : "text-destructive"
                    )}
                  >
                    {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

}
