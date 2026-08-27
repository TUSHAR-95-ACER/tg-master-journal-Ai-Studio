import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function QuickActionBar() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case 't': navigate('/trades?new=true'); break;
        case 'd': navigate('/daily-plan'); break;
        case 'w': navigate('/weekly-plan'); break;
        case 'n': navigate('/notebook'); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-6 py-2.5 flex items-center gap-2">
      <Button
        onClick={() => navigate('/trades?new=true')}
        size="sm"
        className="gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold shadow-sm"
      >
        <Plus className="h-3.5 w-3.5" /> Log Trade
        <kbd className="ml-1.5 text-[9px] opacity-60 bg-primary-foreground/20 rounded px-1 py-0.5">T</kbd>
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/daily-plan')}>
        <Calendar className="h-3.5 w-3.5" /> Daily Plan
        <kbd className="ml-1 text-[9px] opacity-50 bg-muted rounded px-1 py-0.5">D</kbd>
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/weekly-plan')}>
        <BookOpen className="h-3.5 w-3.5" /> Weekly Plan
        <kbd className="ml-1 text-[9px] opacity-50 bg-muted rounded px-1 py-0.5">W</kbd>
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/notebook')}>
        <FileText className="h-3.5 w-3.5" /> Notebook
        <kbd className="ml-1 text-[9px] opacity-50 bg-muted rounded px-1 py-0.5">N</kbd>
      </Button>
    </div>
  );
}
