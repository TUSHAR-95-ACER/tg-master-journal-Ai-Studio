import { useState, useRef, useCallback } from 'react';
import { ImagePlus, X, Upload, ZoomIn, ZoomOut, Maximize2, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { uploadJournalMedia } from '@/lib/journalUpload';
import { toast } from '@/hooks/use-toast';

interface PlanImageUploadProps {
  value?: string;
  onChange: (v: string) => void;
  label: string;
  /** Storage subfolder for organization. */
  scope?: string;
}

export function PlanImageUpload({ value, onChange, label, scope = 'plans' }: PlanImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [uploading, setUploading] = useState(false);

  // PERF: New uploads go straight to Supabase Storage (URL only), instead of
  // base64 in the database row. Existing base64 values still display fine.
  const readFile = async (file: File) => {
    setUploading(true);
    try {
      const m = await uploadJournalMedia(file, scope);
      onChange(m.url);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not upload image', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { readFile(file); e.preventDefault(); break; }
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) readFile(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</Label>
      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-border/50 bg-background w-full">
          <img
            src={value}
            alt={label}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', maxWidth: 'none', height: 'auto' }}
            className="block object-contain cursor-pointer"
            onClick={() => { setZoom(1); setViewerOpen(true); }}
          />
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
            <button
              onClick={() => { setZoom(1); setViewerOpen(true); }}
              className="h-8 w-8 rounded-lg bg-background/90 border border-border/50 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onChange('')}
              className="h-8 w-8 rounded-lg bg-background/90 border border-border/50 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

      ) : (
        <div
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          tabIndex={0}
          className={cn(
            'relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 focus:outline-none focus:border-primary/50 focus:bg-primary/[0.02] group/upload',
            dragging
              ? 'border-primary bg-primary/10 scale-[1.01]'
              : 'border-border/50 hover:border-primary/40 hover:bg-primary/[0.02]'
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center group-hover/upload:bg-primary/10 transition-colors">
              {uploading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <ImagePlus className="h-5 w-5 text-muted-foreground group-hover/upload:text-primary transition-colors" />}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {uploading ? 'Uploading…' : (dragging ? 'Drop here!' : 'Drag & drop or paste image')}
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">PNG, JPG up to 10MB</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs font-semibold gap-1.5"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              disabled={uploading}
            >
              <Upload className="h-3.5 w-3.5" /> Choose File
            </Button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
      )}

      {/* Full-screen image viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono text-muted-foreground min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setZoom(z => Math.min(5, z + 0.25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setZoom(1)}>Reset</Button>
          </div>
          <div className="overflow-auto max-h-[80vh] flex items-center justify-center">
            <img
              src={value}
              alt={label}
              loading="lazy"
              decoding="async"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="max-w-full transition-transform duration-200"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
