import { useRef, useState, useEffect } from 'react';
import { Upload, Video, X, Loader2, AlertCircle, RefreshCw, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { uploadJournalMedia, deleteJournalMedia, getSignedUrl } from '@/lib/journalUpload';
import { isAcceptedVideo, VIDEO_ACCEPT_ATTR, MAX_VIDEO_BYTES } from '@/lib/mediaTypes';

interface JournalVideoUploadProps {
  url?: string;
  path?: string;
  scope: string;
  onChange: (next: { url?: string; path?: string }) => void;
}

/** Real upload pipeline for Weekly/Daily analysis video. Supports local upload OR external URL. */
export function JournalVideoUpload({ url, path, scope, onChange }: JournalVideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [signed, setSigned] = useState<string | undefined>(url);

  // Re-sign on mount if we have a path
  useEffect(() => {
    let cancelled = false;
    if (path) {
      getSignedUrl(path).then((u) => !cancelled && setSigned(u)).catch(() => setSigned(url));
    } else {
      setSigned(url);
    }
    return () => {
      cancelled = true;
    };
  }, [path, url]);

  const start = async (file: File) => {
    setError(null);
    if (!isAcceptedVideo(file)) {
      setPendingFile(file);
      setError(`Unsupported video format: ${file.name}. Try MP4, WebM, MOV, AVI, MKV, or MPEG.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setPendingFile(file);
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 50 MB.`);
      return;
    }
    setPendingFile(file);
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadJournalMedia(file, scope, setProgress);
      onChange({ url: res.url, path: res.path });
      setSigned(res.url);
      setUploading(false);
      setPendingFile(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setUploading(false);
    }
  };

  const remove = async () => {
    if (path) {
      try { await deleteJournalMedia(path); } catch { /* ignore */ }
    }
    onChange({ url: undefined, path: undefined });
    setSigned(undefined);
  };

  const isExternal = !!url && !path && /^https?:/.test(url);

  return (
    <div className="space-y-3">
      {signed && !uploading && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
          {isExternal && /youtube|youtu\.be|vimeo/.test(signed) ? (
            <div className="aspect-video flex items-center justify-center text-sm text-muted-foreground">
              <a href={signed} target="_blank" rel="noreferrer" className="text-primary underline flex items-center gap-1.5">
                <Link2 className="h-4 w-4" /> Open external video
              </a>
            </div>
          ) : (
            <video src={signed} controls className="w-full max-h-[420px]" preload="metadata" />
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-7 w-7 absolute top-2 right-2 rounded-lg"
            onClick={remove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {uploading && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="truncate">Uploading {pendingFile?.name}…</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground">{Math.round(progress)}%</p>
        </div>
      )}

      {error && !uploading && pendingFile && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {error}</span>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => start(pendingFile)}>
            <RefreshCw className="h-3 w-3" /> Retry
          </Button>
        </div>
      )}

      {!signed && !uploading && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-xl gap-2"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Upload analysis video
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={VIDEO_ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && start(e.target.files[0])}
          />
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or paste URL</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="https://youtube.com/…"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v) onChange({ url: v, path: undefined });
              }}
              className="h-9 text-xs rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
