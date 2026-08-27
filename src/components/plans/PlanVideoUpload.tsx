import { useState, useRef, useCallback } from 'react';
import { Video, X, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isAcceptedVideo, VIDEO_ACCEPT_ATTR } from '@/lib/mediaTypes';

interface PlanVideoUploadProps {
  value?: string;
  onChange: (v: string) => void;
  label: string;
}

export function PlanVideoUpload({ value, onChange, label }: PlanVideoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFile = (file: File) => {
    const url = URL.createObjectURL(file);
    onChange(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isAcceptedVideo(file)) {
      const url = URL.createObjectURL(file);
      onChange(url);
    }
  }, [onChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }, []);

  const isBlob = value?.startsWith('blob:');
  const getYouTubeId = (url: string): string | null => {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  };
  const ytId = value ? getYouTubeId(value) : null;
  const youtubeEmbed = ytId ? `https://www.youtube.com/embed/${ytId}` : '';

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</Label>
      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-border/50">
          {isBlob ? (
            <video src={value} controls className="w-full max-h-[360px] rounded-xl bg-black" />
          ) : ytId ? (
            <iframe src={youtubeEmbed} className="w-full aspect-video rounded-xl" allowFullScreen />
          ) : (
            <video src={value} controls className="w-full max-h-[360px] rounded-xl bg-black" />
          )}
          <button
            onClick={() => onChange('')}
            className="absolute top-3 right-3 h-8 w-8 rounded-lg bg-background/90 border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          tabIndex={0}
          className={cn(
            'relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 focus:outline-none focus:border-primary/50',
            dragging
              ? 'border-primary bg-primary/10 scale-[1.01]'
              : 'border-border/50 hover:border-primary/40 hover:bg-primary/[0.02]'
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <Video className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dragging ? 'Drop video here!' : 'Drag & drop video file'}
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">MP4, WebM supported</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg text-xs font-semibold gap-1.5"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            >
              <Upload className="h-3.5 w-3.5" /> Choose File
            </Button>
          </div>
          <input ref={fileRef} type="file" accept={VIDEO_ACCEPT_ATTR} onChange={handleFile} className="hidden" />
        </div>
      )}
    </div>
  );
}
