import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UnifiedMediaBox } from './UnifiedMediaBox';
import { cn } from '@/lib/utils';

interface MultiMediaBoxProps {
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
  accept?: ('image' | 'video' | 'url')[];
  maxItems?: number;
  maxPreviewHeight?: string;
  gridCols?: 1 | 2;
  forceAspect?: '16/9' | '4/3' | '1/1';
}

export function MultiMediaBox({ values, onChange, label, accept = ['image', 'video', 'url'], maxItems = 5, maxPreviewHeight = '300px', gridCols = 1, forceAspect }: MultiMediaBoxProps) {
  // Track number of slots separately so empty slots persist
  const [slotCount, setSlotCount] = useState(Math.max(1, values.length));

  // Ensure we always have at least slotCount entries
  const slots = Array.from({ length: Math.max(slotCount, values.length) }, (_, i) => values[i] || '');

  const updateItem = (index: number, value: string) => {
    const updated = [...slots];
    updated[index] = value;
    onChange(updated);
  };

  const removeItem = (index: number) => {
    const updated = slots.filter((_, i) => i !== index);
    setSlotCount(Math.max(1, updated.length));
    onChange(updated.length === 0 ? [''] : updated);
  };

  const addItem = () => {
    const filledCount = slots.filter(Boolean).length;
    if (filledCount < maxItems) {
      const newSlots = [...slots, ''];
      setSlotCount(newSlots.length);
      onChange(newSlots);
    }
  };

  const filledCount = slots.filter(Boolean).length;
  const canAdd = filledCount > 0 && filledCount < maxItems;

  // Adaptive layout for 2-column mode:
  //   1 item  -> full width
  //   2 items -> 50/50
  //   3 items -> 50/50 + full-width row
  //   4 items -> 2x2 grid
  const useGrid = gridCols === 2 && slots.length >= 2;
  const containerClass = useGrid
    ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
    : 'space-y-3';

  const itemSpanClass = (idx: number) => {
    if (!useGrid) return '';
    // 3 items: last one spans both columns
    if (slots.length === 3 && idx === 2) return 'md:col-span-2';
    return '';
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</Label>}

      <div className={containerClass}>
        {slots.map((item, idx) => (
          <div key={idx} className={cn('relative', itemSpanClass(idx))}>
            {filledCount > 1 && item && (
              <div className="absolute -top-1.5 -left-1.5 z-10 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                {idx + 1}
              </div>
            )}
            {slots.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <UnifiedMediaBox
              value={item}
              onChange={v => updateItem(idx, v)}
              label=""
              accept={accept}
              maxPreviewHeight={maxPreviewHeight}
              forceAspect={forceAspect}
            />
          </div>
        ))}
      </div>

      {canAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-9 rounded-xl text-xs font-semibold gap-1.5 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/[0.03] text-muted-foreground hover:text-primary transition-all"
          onClick={addItem}
        >
          <Plus className="h-3.5 w-3.5" />
          Add More ({filledCount}/{maxItems})
        </Button>
      )}
    </div>
  );
}
