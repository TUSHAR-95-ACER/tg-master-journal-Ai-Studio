import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const GATE_ITEMS = [
  { id: 'mind_ready', label: 'Mind is ready and focused' },
  { id: 'following_system', label: 'Following my trading system' },
  { id: 'risk_defined', label: 'Risk per trade is defined' },
  { id: 'setup_valid', label: 'Setup is valid (A+ quality)' },
  { id: 'no_emotional', label: 'No emotional trading (no FOMO/revenge)' },
];

interface Props {
  open: boolean;
  onPass: () => void;
  onCancel: () => void;
}

export function TradeEntryGate({ open, onPass, onCancel }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const allChecked = GATE_ITEMS.every(item => checked[item.id]);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePass = () => {
    setChecked({});
    onPass();
  };

  const handleCancel = () => {
    setChecked({});
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold uppercase tracking-wider">
            <Shield className="h-5 w-5 text-primary" />
            Pre-Trade Checklist Required
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete all items before logging a trade
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {GATE_ITEMS.map(item => (
            <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
              <Checkbox
                checked={!!checked[item.id]}
                onCheckedChange={() => toggle(item.id)}
                className="h-5 w-5"
              />
              <span className={cn(
                'text-sm transition-all',
                checked[item.id] ? 'text-muted-foreground line-through' : 'text-foreground'
              )}>
                {item.label}
              </span>
            </label>
          ))}
        </div>

        {/* Status */}
        <div className={cn(
          'rounded-lg p-3 text-center text-sm font-semibold',
          allChecked ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        )}>
          {allChecked ? (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Ready to trade
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {checkedCount}/{GATE_ITEMS.length} — Trading blocked
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleCancel}>Cancel</Button>
          <Button
            className="flex-1 gap-1.5"
            disabled={!allChecked}
            onClick={handlePass}
          >
            <CheckCircle className="h-4 w-4" /> Continue to Log Trade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
