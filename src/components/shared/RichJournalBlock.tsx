import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Video, X, Loader2, AlertCircle, RefreshCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { RichTextEditor } from './RichTextEditor';
import {
  uploadJournalMedia,
  refreshSignedUrls,
  deleteJournalMedia,
  type UploadedMedia,
} from '@/lib/journalUpload';
import { isAcceptedImage, isAcceptedVideo, isAcceptedMedia, VIDEO_ACCEPT_ATTR, IMAGE_VIDEO_ACCEPT_ATTR } from '@/lib/mediaTypes';
import { toast } from '@/hooks/use-toast';
import { SmartImg } from '@/components/shared/SmartImg';

export interface MediaAsset {
  id: string;
  path?: string;       // storage path (new uploads)
  url: string;         // displayable URL (signed) OR legacy data URL
  type: 'image' | 'video';
  name?: string;
  legacy?: boolean;    // true for base64/data-URL items kept for back-compat
}

export interface RichJournalValue {
  text: string;
  media: MediaAsset[];
}

interface RichJournalBlockProps {
  title: string;
  scope: string; // storage path scope, e.g. 'weekly/observation'
  value: RichJournalValue;
  onChange: (v: RichJournalValue) => void;
  placeholder?: string;
  accept?: 'image' | 'video' | 'both';
  className?: string;
}

interface PendingUpload {
  id: string;
  name: string;
  progress: number;
  error?: string;
  file: File;
}

export function RichJournalBlock({
  title,
  scope,
  value,
  onChange,
  placeholder = 'Write your thoughts… paste screenshots, drop charts, attach video.',
  accept = 'both',
  className,
}: RichJournalBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [lightbox, setLightbox] = useState<MediaAsset | null>(null);

  // Refresh expiring signed URLs once on mount / value change of paths
  useEffect(() => {
    const stale = value.media.filter((m) => m.path && !m.legacy);
    if (!stale.length) return;
    let cancelled = false;
    refreshSignedUrls(stale).then((refreshed) => {
      if (cancelled) return;
      const map = new Map(refreshed.map((r) => [r.id, r.url]));
      const next = value.media.map((m) => (map.has(m.id) ? { ...m, url: map.get(m.id)! } : m));
      // shallow compare URLs
      if (next.some((n, i) => n.url !== value.media[i].url)) {
        onChange({ ...value, media: next });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.media.map((m) => m.path).join('|')]);

  const acceptAttr =
    accept === 'image' ? 'image/*' : accept === 'video' ? VIDEO_ACCEPT_ATTR : IMAGE_VIDEO_ACCEPT_ATTR;

  const validate = (file: File): string | null => {
    if (accept === 'image' && !isAcceptedImage(file)) return `Unsupported image: ${file.name}`;
    if (accept === 'video' && !isAcceptedVideo(file)) return `Unsupported video: ${file.name}. Try MP4, WebM, MOV, AVI, MKV, or MPEG.`;
    if (accept === 'both' && !isAcceptedMedia(file)) return `Unsupported file: ${file.name}`;
    return null;
  };

  const startUpload = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID();
      setPending((p) => [...p, { id, name: file.name, progress: 0, file }]);
      try {
        const uploaded: UploadedMedia = await uploadJournalMedia(file, scope, (pct) => {
          setPending((p) => p.map((x) => (x.id === id ? { ...x, progress: pct } : x)));
        });
        const asset: MediaAsset = {
          id: crypto.randomUUID(),
          path: uploaded.path,
          url: uploaded.url,
          type: uploaded.type,
          name: uploaded.name,
        };
        onChange({ ...value, media: [...value.media, asset] });
        setPending((p) => p.filter((x) => x.id !== id));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setPending((p) => p.map((x) => (x.id === id ? { ...x, error: msg, progress: 0 } : x)));
      }
    },
    [onChange, scope, value],
  );

  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((f) => {
      const err = validate(f);
      if (err) {
        toast({ title: 'Upload blocked', description: err, variant: 'destructive' });
        return;
      }
      startUpload(f);
    });
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files: File[] = [];
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeAsset = async (asset: MediaAsset) => {
    onChange({ ...value, media: value.media.filter((m) => m.id !== asset.id) });
    if (asset.path && !asset.legacy) {
      try {
        await deleteJournalMedia(asset.path);
      } catch {
        /* best effort */
      }
    }
  };

  const retry = (p: PendingUpload) => {
    setPending((cur) => cur.filter((x) => x.id !== p.id));
    startUpload(p.file);
  };

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            {accept === 'video' ? <Video className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Add media
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptAttr}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </div>

      <RichTextEditor
        value={value.text}
        onChange={(html) => onChange({ ...value, text: html })}
        placeholder={placeholder}
        onPaste={onPaste}
        onDrop={onDrop}
        className="font-journal"
      />

      {(value.media.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {value.media.map((m) => (
            <div
              key={m.id}
              className="group relative rounded-xl overflow-hidden border border-border bg-muted/20"
            >
              {m.type === 'image' ? (
                <button
                  type="button"
                  onClick={() => setLightbox(m)}
                  className="block w-full"
                >
                  <SmartImg
                    src={m.url}
                    alt={m.name || 'media'}
                    className="w-full h-32 object-contain bg-muted/20"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ) : (
                <div className="relative">
                  <video src={m.url} className="w-full h-32 object-contain bg-muted/20" controls preload="metadata" />
                  <div className="absolute top-2 left-2 bg-background/80 backdrop-blur rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-foreground flex items-center gap-1">
                    <Play className="h-3 w-3" /> Video
                  </div>
                </div>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-7 w-7 absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded-lg"
                onClick={() => removeAsset(m)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {pending.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-dashed border-border bg-muted/30 p-3 flex flex-col justify-center gap-2 h-32"
            >
              <div className="flex items-center gap-2 text-xs text-foreground truncate">
                {p.error ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                )}
                <span className="truncate">{p.name}</span>
              </div>
              {p.error ? (
                <>
                  <p className="text-[11px] text-destructive line-clamp-2">{p.error}</p>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => retry(p)}>
                    <RefreshCw className="h-3 w-3" /> Retry
                  </Button>
                </>
              ) : (
                <>
                  <Progress value={p.progress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">{Math.round(p.progress)}%</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-background/90 backdrop-blur flex items-center justify-center p-6"
          onClick={() => setLightbox(null)}
        >
          <SmartImg src={lightbox.url} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
