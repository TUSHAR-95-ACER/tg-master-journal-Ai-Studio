import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Strategy, STRATEGY_TYPES, STRATEGY_ICONS, STRATEGY_COLORS, StrategyStatus, StrategyType,
  StrategyTemplate, TEMPLATE_PRESETS, TEMPLATE_SECTIONS, CustomSection, CustomField,
  createStrategy,
} from '@/types/research';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

const STATUSES: StrategyStatus[] = ['Testing', 'Promising', 'Validated', 'Failed'];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Strategy | null;
  onSave: (s: Strategy) => void;
}

export function StrategyDialog({ open, onOpenChange, initial, onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<StrategyType>('Custom');
  const [icon, setIcon] = useState('🧪');
  const [color, setColor] = useState<string>('blue');
  const [status, setStatus] = useState<StrategyStatus>('Testing');
  const [template, setTemplate] = useState<StrategyTemplate>('blank');
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setType(initial?.type || 'Custom');
    setIcon(initial?.icon || '🧪');
    setColor(initial?.color || 'blue');
    setStatus(initial?.status || 'Testing');
    setTemplate(initial?.template || 'blank');
    setCustomSections(initial?.customSections || []);
  }, [open, initial]);

  const handleSave = () => {
    if (!name.trim()) return;
    const base = initial || createStrategy();
    onSave({
      ...base,
      name: name.trim(),
      description,
      type,
      icon,
      color,
      status,
      template,
      customSections: template === 'custom' ? customSections : (base.customSections || []),
      updatedAt: new Date().toISOString(),
    });
    onOpenChange(false);
  };

  const addSection = () => setCustomSections((p) => [...p, { id: crypto.randomUUID(), title: 'New Section', fields: [] }]);
  const updateSection = (id: string, patch: Partial<CustomSection>) =>
    setCustomSections((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
  const removeSection = (id: string) => setCustomSections((p) => p.filter((s) => s.id !== id));
  const addField = (sectionId: string) =>
    updateSection(sectionId, {
      fields: [...(customSections.find((s) => s.id === sectionId)?.fields || []),
        { id: crypto.randomUUID(), label: 'New field', type: 'text', placeholder: '' }],
    });
  const updateField = (sectionId: string, fieldId: string, patch: Partial<CustomField>) => {
    const sec = customSections.find((s) => s.id === sectionId);
    if (!sec) return;
    updateSection(sectionId, { fields: sec.fields.map((f) => f.id === fieldId ? { ...f, ...patch } : f) });
  };
  const removeField = (sectionId: string, fieldId: string) => {
    const sec = customSections.find((s) => s.id === sectionId);
    if (!sec) return;
    updateSection(sectionId, { fields: sec.fields.filter((f) => f.id !== fieldId) });
  };

  // Preview the field count when an existing template is chosen
  const templateFieldCount = template === 'custom'
    ? customSections.reduce((n, s) => n + s.fields.length, 0)
    : (TEMPLATE_SECTIONS[template]?.reduce((n, s) => n + s.fields.length, 0) ?? (template === 'dr' ? 14 : 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Strategy' : 'New Strategy'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>Strategy Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ICT Session Narrative Model" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="One-line thesis" />
          </div>

          {/* Template chooser */}
          <div>
            <Label>Test Template</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Each strategy has its own form. DR layout will NOT be applied to ADC, EBP, etc.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEMPLATE_PRESETS.map((tp) => (
                <button
                  key={tp.id}
                  type="button"
                  onClick={() => setTemplate(tp.id)}
                  className={cn(
                    'text-left p-3 rounded-lg border-2 transition-all',
                    template === tp.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-accent',
                  )}
                >
                  <div className="font-semibold text-sm">{tp.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{tp.description}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {template === 'custom' ? `${templateFieldCount} custom field${templateFieldCount === 1 ? '' : 's'}` : `${templateFieldCount} template fields`}
            </p>
          </div>

          {/* Custom field builder */}
          {template === 'custom' && (
            <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Custom Sections</Label>
                <Button size="sm" variant="outline" onClick={addSection}><Plus className="h-3 w-3 mr-1" /> Section</Button>
              </div>
              {customSections.length === 0 && (
                <p className="text-xs text-muted-foreground">No sections yet. Add at least one to begin.</p>
              )}
              {customSections.map((sec) => (
                <div key={sec.id} className="border border-border rounded-md p-3 bg-background space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={sec.title} onChange={(e) => updateSection(sec.id, { title: e.target.value })} className="h-8 font-semibold" />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeSection(sec.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="space-y-2 pl-2 border-l-2 border-border">
                    {sec.fields.map((f) => (
                      <div key={f.id} className="grid grid-cols-12 gap-2 items-center">
                        <Input className="col-span-4 h-8" value={f.label} placeholder="Label" onChange={(e) => updateField(sec.id, f.id, { label: e.target.value })} />
                        <Select value={f.type} onValueChange={(v) => updateField(sec.id, f.id, { type: v as CustomField['type'] })}>
                          <SelectTrigger className="col-span-3 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Single line</SelectItem>
                            <SelectItem value="textarea">Multi-line</SelectItem>
                            <SelectItem value="rich">Rich text</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input className="col-span-4 h-8" value={f.placeholder || ''} placeholder="Placeholder" onChange={(e) => updateField(sec.id, f.id, { placeholder: e.target.value })} />
                        <Button size="icon" variant="ghost" className="h-8 w-8 col-span-1" onClick={() => removeField(sec.id, f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addField(sec.id)} className="h-7"><Plus className="h-3 w-3 mr-1" /> Field</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as StrategyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StrategyStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {STRATEGY_ICONS.map((i) => (
                <button key={i} type="button" onClick={() => setIcon(i)}
                  className={cn('w-9 h-9 rounded-md border text-lg flex items-center justify-center',
                    icon === i ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent')}>{i}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {STRATEGY_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn('w-8 h-8 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent')}
                >
                  <span className={cn('block w-full h-full rounded-full',
                    c === 'blue' && 'bg-blue-500',
                    c === 'emerald' && 'bg-emerald-500',
                    c === 'amber' && 'bg-amber-500',
                    c === 'purple' && 'bg-purple-500',
                    c === 'rose' && 'bg-rose-500',
                    c === 'cyan' && 'bg-cyan-500',
                    c === 'orange' && 'bg-orange-500',
                    c === 'slate' && 'bg-slate-500',
                  )} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Save Strategy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
