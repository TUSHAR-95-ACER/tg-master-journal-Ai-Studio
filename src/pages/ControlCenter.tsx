import { useState } from 'react';
import { useTrading } from '@/contexts/TradingContext';
import { PageHeader } from '@/components/shared/MetricCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Check, X, Search, TrendingUp, Globe, Clock, BarChart3, Award, Crosshair, Settings2, Brain, AlertTriangle, BookOpen, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EditableListProps {
  title: string;
  icon: LucideIcon;
  items: string[];
  onAdd: (item: string) => void;
  onUpdate: (prev: string, next: string) => void;
  onDelete: (item: string) => void;
  accentColor?: string;
}

function EditableCard({ title, icon: Icon, items, onAdd, onUpdate, onDelete, accentColor }: EditableListProps) {
  const [newItem, setNewItem] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  return (
    <div className="group/card bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-muted/20">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors", accentColor || "bg-primary/10")}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-foreground">{title}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">{items.length} {items.length === 1 ? 'item' : 'items'} configured</p>
        </div>
        <div className="h-7 min-w-[28px] rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <span className="text-[11px] font-bold">{items.length}</span>
        </div>
      </div>

      {/* Items List */}
      <div className="px-4 py-3 space-y-1.5 max-h-[320px] overflow-y-auto scrollbar-hide">
        {items.map((item, idx) => (
          <div key={item} className="flex items-center gap-2 rounded-xl border border-transparent bg-muted/30 px-3 py-2.5 group/item hover:bg-accent/50 hover:border-border/50 transition-all duration-200">
            {editing === item ? (
              <>
                <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="h-8 text-xs flex-1 rounded-lg"
                  onKeyDown={e => { if (e.key === 'Enter') { onUpdate(item, editValue); setEditing(null); } }} autoFocus />
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-success hover:bg-success/10" onClick={() => { onUpdate(item, editValue); setEditing(null); }}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setEditing(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-[10px] font-mono text-muted-foreground/50 w-4 text-center">{idx + 1}</span>
                <span className="flex-1 text-sm font-medium text-foreground">{item}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10" onClick={() => { setEditing(item); setEditValue(item); }}>
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10" onClick={() => onDelete(item)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-6 text-muted-foreground/60 text-xs">
            No items yet. Add your first one below.
          </div>
        )}
      </div>

      {/* Add New */}
      <div className="px-4 pb-4 pt-2 border-t border-border/30">
        <div className="flex gap-2">
          <Input
            placeholder={`Add new ${title.toLowerCase().replace(/s$/, '')}...`}
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            className="h-9 text-xs rounded-xl bg-background"
            onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { onAdd(newItem.trim()); setNewItem(''); } }}
          />
          <Button
            variant="default"
            size="sm"
            className="h-9 gap-1.5 text-xs shrink-0 rounded-xl px-4"
            onClick={() => { if (newItem.trim()) { onAdd(newItem.trim()); setNewItem(''); } }}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ControlCenter() {
  const {
    customSetups, addCustomSetup, updateCustomSetup, deleteCustomSetup,
    customConfluences, addCustomConfluence, updateCustomConfluence, deleteCustomConfluence,
    markets, addMarket, updateMarket, deleteMarket,
    sessions, addSession, updateSession, deleteSession,
    conditions, addCondition, updateCondition, deleteCondition,
    gradesList, addGrade, updateGrade, deleteGrade,
    managementOptions, addManagement, updateManagement, deleteManagement,
    psychTags, addPsychTag, updatePsychTag, deletePsychTag,
    violations, addViolation, updateViolation, deleteViolation,
    notebookCategories, addNotebookCategory, updateNotebookCategory, deleteNotebookCategory,
  } = useTrading();

  const [search, setSearch] = useState('');

  const sections = [
    { title: 'Markets', icon: Globe, items: markets, onAdd: addMarket, onUpdate: updateMarket, onDelete: deleteMarket },
    { title: 'Setups', icon: TrendingUp, items: customSetups, onAdd: addCustomSetup, onUpdate: updateCustomSetup, onDelete: deleteCustomSetup },
    { title: 'Technical Points', icon: Crosshair, items: customConfluences, onAdd: addCustomConfluence, onUpdate: updateCustomConfluence, onDelete: deleteCustomConfluence },
    { title: 'Sessions', icon: Clock, items: sessions, onAdd: addSession, onUpdate: updateSession, onDelete: deleteSession },
    { title: 'Market Conditions', icon: BarChart3, items: conditions, onAdd: addCondition, onUpdate: updateCondition, onDelete: deleteCondition },
    { title: 'Grades', icon: Award, items: gradesList, onAdd: addGrade, onUpdate: updateGrade, onDelete: deleteGrade },
    { title: 'Trade Management', icon: Settings2, items: managementOptions, onAdd: addManagement, onUpdate: updateManagement, onDelete: deleteManagement },
    { title: 'Psychology Tags', icon: Brain, items: psychTags, onAdd: addPsychTag, onUpdate: updatePsychTag, onDelete: deletePsychTag },
    { title: 'Rule Violations', icon: AlertTriangle, items: violations, onAdd: addViolation, onUpdate: updateViolation, onDelete: deleteViolation },
    { title: 'Notebook Categories', icon: BookOpen, items: notebookCategories, onAdd: addNotebookCategory, onUpdate: updateNotebookCategory, onDelete: deleteNotebookCategory },
  ];

  const filtered = search
    ? sections.filter(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.items.some(i => i.toLowerCase().includes(search.toLowerCase())))
    : sections;

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="p-6 w-full">
      <PageHeader title="Control Center" subtitle="Master control for all system dropdowns & selectable fields">
      </PageHeader>

      {/* Summary Bar */}
      <div className="flex items-center gap-6 mb-6 px-5 py-3.5 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Categories</p>
            <p className="text-sm font-bold">{sections.length}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Items</p>
          <p className="text-sm font-bold">{totalItems}</p>
        </div>
        <div className="flex-1" />
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search categories or items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-9 text-sm rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map(s => (
          <EditableCard key={s.title} {...s} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No categories match your search.
        </div>
      )}
    </div>
  );
}
