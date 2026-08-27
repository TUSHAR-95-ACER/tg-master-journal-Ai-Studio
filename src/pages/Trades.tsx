import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, ChevronDown, ChevronUp, LayoutGrid, List, Filter } from 'lucide-react';
import { useTrading } from '@/contexts/TradingContext';
import { PageHeader } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
const TradeFormDialog = lazy(() => import('@/components/trades/TradeFormDialog').then(m => ({ default: m.TradeFormDialog })));
const TradeDetailSheet = lazy(() => import('@/components/trades/TradeDetailSheet').then(m => ({ default: m.TradeDetailSheet })));
import { TradeEntryGate } from '@/components/trades/TradeEntryGate';
import { TradeGalleryView } from '@/components/trades/TradeGalleryView';
import { TradeTableRow } from '@/components/trades/TradeTableRow';
import { Trade } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AIInsightsPanel } from '@/components/shared/AIInsightsPanel';
import { adaptTrades } from '@/lib/aiInsightAdapters';


export default function Trades() {
  const { trades, deleteTrade } = useTrading();
  const [searchParams] = useSearchParams();
  const [showGate, setShowGate] = useState(searchParams.get('new') === 'true');
  const [showForm, setShowForm] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [sortField, setSortField] = useState<'date' | 'profitLoss'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table');

  // Filters
  const [filterPair, setFilterPair] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<string>('all');

  const uniquePairs = useMemo(() => [...new Set(trades.map(t => t.asset).filter((a): a is string => !!a && a.trim() !== ''))].sort(), [trades]);

  const filtered = useMemo(() => {
    return trades.filter(t => {
      if (filterPair !== 'all' && t.asset !== filterPair) return false;
      if (filterResult !== 'all' && t.result !== filterResult) return false;
      return true;
    });
  }, [trades, filterPair, filterResult]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const mult = sortDir === 'desc' ? -1 : 1;
      if (sortField === 'date') return mult * (new Date(a.date).getTime() - new Date(b.date).getTime());
      return mult * (a.profitLoss - b.profitLoss);
    });
  }, [filtered, sortField, sortDir]);

  // PERF: Infinite scroll — only render the first N rows, load 50 more when sentinel scrolls into view.
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filterPair, filterResult, sortField, sortDir, viewMode]);
  const visible = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        setVisibleCount(c => Math.min(c + PAGE_SIZE, sorted.length));
      }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [sorted.length]);

  const toggleSort = (field: 'date' | 'profitLoss') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: 'date' | 'profitLoss' }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />;
  };

  // Stable handler identities so memoized rows don't re-render on every parent update.
  const handleSelect = useCallback((t: Trade) => setSelectedTrade(t), []);
  const handleEdit = useCallback((t: Trade) => { setEditTrade(t); setShowForm(true); }, []);
  const handleDelete = useCallback((id: string) => { deleteTrade(id); }, [deleteTrade]);


  const hasActiveFilters = filterPair !== 'all' || filterResult !== 'all';

  return (
    <div className="px-3 sm:px-4 py-3 w-full">
      <PageHeader title="Trades" subtitle={`${filtered.length} of ${trades.length} trades`}>
        <Button onClick={() => { setEditTrade(null); setShowGate(true); }} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Log Trade
        </Button>
      </PageHeader>

      {/* Toolbar: filters + view toggle */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterPair} onValueChange={setFilterPair}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All Pairs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pairs</SelectItem>
              {uniquePairs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterResult} onValueChange={setFilterResult}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue placeholder="All Results" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              <SelectItem value="Win">Win</SelectItem>
              <SelectItem value="Loss">Loss</SelectItem>
              <SelectItem value="Breakeven">Breakeven</SelectItem>
              <SelectItem value="Untriggered Setup">Untriggered Setup</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setFilterPair('all'); setFilterResult('all'); }}>
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={() => setViewMode('table')}
          >
            <List className="h-3.5 w-3.5" /> Table
          </Button>
          <Button
            variant={viewMode === 'gallery' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs gap-1.5"
            onClick={() => setViewMode('gallery')}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Gallery
          </Button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer" onClick={() => toggleSort('date')}>
                    <span className="flex items-center gap-1">Date <SortIcon field="date" /></span>
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Day</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Pair</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Setup</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Session</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Dir</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground font-mono">Qty</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground font-mono">RR</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground font-mono cursor-pointer" onClick={() => toggleSort('profitLoss')}>
                    <span className="flex items-center gap-1">P/L <SortIcon field="profitLoss" /></span>
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Grade</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Result</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-12 text-center text-muted-foreground">
                      No trades logged yet. Click "Log Trade" to get started.
                    </td>
                  </tr>
                ) : (
                  visible.map(trade => (
                    <TradeTableRow
                      key={trade.id}
                      trade={trade}
                      onSelect={handleSelect}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))
                )}

              </tbody>
            </table>
          </div>
          {visibleCount < sorted.length && (
            <div ref={sentinelRef} className="px-3 py-4 text-center text-xs text-muted-foreground">
              Loading more… ({visibleCount} / {sorted.length})
            </div>
          )}
        </div>
      )}

      {/* Gallery View */}
      {viewMode === 'gallery' && (
        <>
          <TradeGalleryView trades={visible} onSelectTrade={setSelectedTrade} />
          {visibleCount < sorted.length && (
            <div ref={sentinelRef} className="py-4 text-center text-xs text-muted-foreground">
              Loading more… ({visibleCount} / {sorted.length})
            </div>
          )}
        </>
      )}

      <AIInsightsPanel page="Trades" payload={adaptTrades(sorted)} className="mt-6" />

      <TradeEntryGate
        open={showGate}
        onPass={() => { setShowGate(false); setShowForm(true); }}
        onCancel={() => setShowGate(false)}
      />
      <Suspense fallback={null}>
        {(showForm || editTrade) && (
          <TradeFormDialog open={showForm} onOpenChange={setShowForm} editTrade={editTrade} />
        )}
        {selectedTrade && (
          <TradeDetailSheet trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
        )}
      </Suspense>
    </div>
  );
}
