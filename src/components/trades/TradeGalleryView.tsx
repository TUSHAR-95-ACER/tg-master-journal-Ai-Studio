import { useEffect, useState } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import { Trade } from '@/types/trading';
import { cn } from '@/lib/utils';
import { ImageOff } from 'lucide-react';
import { format, parse } from 'date-fns';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Download, ZoomIn } from 'lucide-react';
import { getDayOfWeek } from '@/lib/calculations';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LazyTradeImage } from './LazyTradeImage';
import { getRawUrl } from '@/lib/mediaSlot';
import { SmartImg } from '@/components/shared/SmartImg';

interface Props {
  trades: Trade[];
  onSelectTrade: (trade: Trade) => void;
}

export function TradeGalleryView({ trades, onSelectTrade }: Props) {
  const { hydrateTradeMedia } = useTrading();
  const [expandedTrade, setExpandedTrade] = useState<Trade | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Hydrate full media for the expanded trade so the bigger preview shows images.
  useEffect(() => {
    if (!expandedTrade) return;
    if (expandedTrade.executionImage || expandedTrade.predictionImage) return;
    let cancelled = false;
    hydrateTradeMedia(expandedTrade.id).then(full => {
      if (cancelled || !full) return;
      setExpandedTrade(prev => (prev && prev.id === full.id ? { ...prev, ...full } : prev));
    });
    return () => { cancelled = true; };
  }, [expandedTrade?.id, hydrateTradeMedia]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return format(d, 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const resultStyle: Record<string, string> = {
    Win: 'bg-success/15 text-success',
    Loss: 'bg-destructive/15 text-destructive',
    Breakeven: 'bg-muted text-muted-foreground',
    Missed: 'bg-muted text-muted-foreground',
    Cancelled: 'bg-muted text-muted-foreground',
  };

  const getImage = (trade: Trade) => trade.executionImage || trade.predictionImage || null;

  const handleDownload = (src: string, name: string) => {
    const a = document.createElement('a');
    a.href = src;
    a.download = name;
    a.click();
  };

  return (
    <>
      {trades.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          No trades to display.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {trades.map(trade => {
            return (
              <div
                key={trade.id}
                className="group bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30"
                onClick={() => setExpandedTrade(trade)}
              >
                {/* Image area — lazy-hydrated when card scrolls into view. */}
                <div className="relative aspect-[16/10] bg-muted overflow-hidden">
                  <LazyTradeImage trade={trade} alt={`${trade.asset} chart`} className="w-full h-full" />
                  {/* Result badge overlay */}
                  <div className="absolute top-2 right-2">
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm', resultStyle[trade.result])}>
                      {trade.result}
                    </span>
                  </div>
                </div>

                {/* Info below image */}
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{trade.asset}</span>
                    <span className={cn('text-xs font-mono font-medium',
                      trade.result === 'Untriggered Setup' || trade.result === 'Cancelled' ? 'text-muted-foreground' :
                      trade.profitLoss >= 0 ? 'text-success' : 'text-destructive')}>
                      {trade.result === 'Untriggered Setup' || trade.result === 'Cancelled' ? '—' : `${trade.profitLoss >= 0 ? '+' : ''}${trade.profitLoss.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(trade.date)}</span>
                    <span className={cn('text-xs', trade.direction === 'Long' ? 'text-success' : 'text-destructive')}>
                      {trade.direction}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded trade modal */}
      <Dialog open={!!expandedTrade} onOpenChange={() => setExpandedTrade(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          {expandedTrade && (
            <ScrollArea className="max-h-[90vh]">
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-foreground">{expandedTrade.asset}</h2>
                    <span className={cn('text-xs px-2 py-0.5 rounded font-medium',
                      expandedTrade.direction === 'Long' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>
                      {expandedTrade.direction}
                    </span>
                    {expandedTrade.grade && (
                      <Badge variant="outline">{expandedTrade.grade}</Badge>
                    )}
                    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', resultStyle[expandedTrade.result])}>
                      {expandedTrade.result}
                    </span>
                  </div>
                </div>

                {/* Full image */}
                {(expandedTrade.executionImage || expandedTrade.predictionImage) && (() => {
                  const execUrl = expandedTrade.executionImage ? getRawUrl(expandedTrade.executionImage) : '';
                  const predUrl = expandedTrade.predictionImage ? getRawUrl(expandedTrade.predictionImage) : '';
                  const isImg = (u: string) => !!u && /^(https?:|data:|blob:|\/)/.test(u);
                  return (
                    <div className="space-y-3">
                      {isImg(execUrl) && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5 font-medium">Execution Chart</p>
                          <div className="relative group cursor-pointer rounded-lg overflow-hidden border border-border" onClick={() => setPreviewImage(execUrl)}>
                            <SmartImg src={execUrl} alt="Execution" className="w-full object-cover" loading="lazy" decoding="async" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </div>
                      )}
                      {isImg(predUrl) && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5 font-medium">Prediction Chart</p>
                          <div className="relative group cursor-pointer rounded-lg overflow-hidden border border-border" onClick={() => setPreviewImage(predUrl)}>
                            <SmartImg src={predUrl} alt="Prediction" className="w-full object-cover" loading="lazy" decoding="async" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between border-b border-border/30 py-1.5">
                    <span className="text-muted-foreground text-xs">Date</span>
                    <span className="text-xs font-medium">{formatDate(expandedTrade.date)} ({getDayOfWeek(expandedTrade.date)})</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 py-1.5">
                    <span className="text-muted-foreground text-xs">Session</span>
                    <span className="text-xs font-medium">{expandedTrade.session}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 py-1.5">
                    <span className="text-muted-foreground text-xs">Setup</span>
                    <span className="text-xs font-medium">{expandedTrade.setup}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 py-1.5">
                    <span className="text-muted-foreground text-xs">Condition</span>
                    <span className="text-xs font-medium">{expandedTrade.marketCondition}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/30 py-1.5">
                    <span className="text-muted-foreground text-xs">P/L</span>
                    <span className={cn('text-xs font-mono font-medium', expandedTrade.profitLoss >= 0 ? 'text-success' : 'text-destructive')}>
                      {expandedTrade.profitLoss >= 0 ? '+' : ''}{expandedTrade.profitLoss.toFixed(2)}
                    </span>
                  </div>
                  {expandedTrade.actualRR !== undefined && (
                    <div className="flex justify-between border-b border-border/30 py-1.5">
                      <span className="text-muted-foreground text-xs">Actual RR</span>
                      <span className="text-xs font-mono font-medium">{expandedTrade.actualRR.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Confluences / Key Levels */}
                {expandedTrade.confluences.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Key Levels & Confluences</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {expandedTrade.confluences.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {expandedTrade.notes && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Notes</h4>
                    <p className="text-sm text-foreground/80 leading-relaxed bg-muted/50 rounded-lg p-3">{expandedTrade.notes}</p>
                  </div>
                )}

                {/* Psychology */}
                {expandedTrade.psychology && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Psychology</h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{expandedTrade.psychology.emotion}</Badge>
                      <Badge variant="outline">Focus: {expandedTrade.psychology.focus}/5</Badge>
                      <Badge variant="outline">Discipline: {expandedTrade.psychology.discipline}/5</Badge>
                    </div>
                  </div>
                )}

                {/* Mistakes */}
                {expandedTrade.mistakes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Mistakes</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {expandedTrade.mistakes.map(m => <Badge key={m} variant="destructive" className="text-xs">{m}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-size image preview */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-black/95 border-none">
          <div className="relative flex items-center justify-center h-full">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10 text-white hover:bg-white/20" onClick={() => setPreviewImage(null)}>
              <X className="h-5 w-5" />
            </Button>
            {previewImage && (
              <>
                <SmartImg src={previewImage} alt="Full size" loading="lazy" decoding="async" className="max-w-full max-h-[85vh] object-contain rounded-md" />
                <Button variant="ghost" size="sm" className="absolute bottom-4 right-4 text-white hover:bg-white/20 gap-1.5" onClick={() => handleDownload(previewImage, 'trade-chart.png')}>
                  <Download className="h-4 w-4" /> Download
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
