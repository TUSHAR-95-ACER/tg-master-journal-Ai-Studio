import { useState, useRef, useCallback, useEffect } from 'react';
import { ImagePlus, X, Upload, ZoomIn, ZoomOut, Maximize2, Video, Link2, Loader2, Globe, ExternalLink, CalendarDays } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { uploadJournalMedia } from '@/lib/journalUpload';
import { toast } from '@/hooks/use-toast';
import { decodeLinkMeta, encodeLinkMeta, faviconFor, screenshotFor, isScreenshotBlocked, type LinkMeta } from '@/lib/mediaSlot';
import { SmartImg } from '@/components/shared/SmartImg';

export interface MediaItem {
  type: 'image' | 'video' | 'url';
  value: string; // data URL, blob URL, or external URL
  meta?: { title?: string; description?: string; image?: string; domain?: string; youtubeId?: string };
}

interface UnifiedMediaBoxProps {
  /** For backward compat: single string value (image data URL or video blob) */
  value?: string;
  onChange: (value: string) => void;
  label: string;
  /** Accept types: defaults to all */
  accept?: ('image' | 'video' | 'url')[];
  /** Max image height in preview */
  maxPreviewHeight?: string;
  /** Force a fixed aspect ratio on the image preview (uses object-cover) */
  forceAspect?: '16/9' | '4/3' | '1/1';
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
}

export function UnifiedMediaBox({ value, onChange, label, accept = ['image', 'video', 'url'], maxPreviewHeight = '336px', forceAspect }: UnifiedMediaBoxProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlMeta, setUrlMeta] = useState<LinkMeta | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'url' | null>(null);
  const [ogImageFailed, setOgImageFailed] = useState(false);
  const [screenshotFailed, setScreenshotFailed] = useState(false);

  // Real URL to use for opening / embedding (strips meta encoding).
  const decoded = value ? decodeLinkMeta(value) : null;
  const rawUrl = decoded ? decoded.url : value || '';

  // Detect type from current value
  useEffect(() => {
    setOgImageFailed(false);
    setScreenshotFailed(false);
    if (!value) { setMediaType(null); setUrlMeta(null); return; }
    if (decoded) { setMediaType('url'); setUrlMeta(decoded); return; }
    if (value.startsWith('data:image')) { setMediaType('image'); setUrlMeta(null); return; }
    if (value.startsWith('data:video') || value.startsWith('blob:')) { setMediaType('video'); setUrlMeta(null); return; }
    if (isImageUrl(value)) { setMediaType('image'); setUrlMeta(null); return; }
    if (isVideoUrl(value)) { setMediaType('video'); setUrlMeta(null); return; }
    if (value.startsWith('http')) {
      setMediaType('url');
      // Build minimal meta immediately so we never render a naked URL row.
      let domain = '';
      try { domain = new URL(value).hostname.replace(/^www\./, ''); } catch { /* noop */ }
      const minimalMeta: LinkMeta = {
        url: value, domain, siteName: domain,
        favicon: domain ? faviconFor(domain) : undefined,
        type: /truthsocial\.com/i.test(domain) ? 'article' : 'link',
      };
      setUrlMeta(minimalMeta);
      // Try to enrich and persist; on any failure, still persist the minimal meta
      // so reload doesn't keep re-fetching and the card stays consistent.
      (async () => {
        try {
          const { data } = await supabase.functions.invoke('fetch-url-metadata', { body: { url: value } });
          if (data?.success) {
            const meta: LinkMeta = {
              url: data.url || value,
              title: data.title || undefined,
              description: data.description || undefined,
              image: data.image || undefined,
              domain: data.domain || domain,
              siteName: data.siteName || data.domain || domain,
              favicon: data.favicon || minimalMeta.favicon,
              youtubeId: data.youtubeId,
              type: data.type || minimalMeta.type,
              publishedAt: data.publishedAt,
            };
            setUrlMeta(meta);
            onChange(encodeLinkMeta(meta));
            return;
          }
        } catch { /* fall through */ }
        // Persist minimal meta so we don't refetch on every reload.
        onChange(encodeLinkMeta(minimalMeta));
      })();
      return;
    }
    setMediaType('image'); // fallback for any other data URLs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const file = files instanceof FileList ? files[0] : files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') && accept.includes('image');
    const isVideo = file.type.startsWith('video/') && accept.includes('video');
    if (!isImage && !isVideo) return;

    setUploading(true);
    try {
      const m = await uploadJournalMedia(file, isVideo ? 'unified/video' : 'unified/image');
      onChange(m.url);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not upload file', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [accept, onChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Check for images in clipboard
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/') && accept.includes('image')) {
        const file = item.getAsFile();
        if (file) { handleFiles([file]); e.preventDefault(); return; }
      }
    }
    // Check for URL text
    const text = e.clipboardData.getData('text/plain').trim();
    if (text && /^https?:\/\//i.test(text) && accept.includes('url')) {
      e.preventDefault();
      handleUrlSubmit(text);
    }
  }, [accept, handleFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFiles([file]);
      return;
    }
    // Check for dropped URL
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && /^https?:\/\//i.test(url.trim()) && accept.includes('url')) {
      handleUrlSubmit(url.trim());
    }
  }, [accept, handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }, []);

  const handleUrlSubmit = async (url?: string) => {
    const finalUrl = (url || urlInput).trim();
    if (!finalUrl) return;

    // Direct image URL
    if (isImageUrl(finalUrl)) {
      onChange(finalUrl);
      setUrlInput('');
      setShowUrlInput(false);
      return;
    }

    // Direct video / YouTube
    if (isVideoUrl(finalUrl)) {
      onChange(finalUrl);
      setUrlInput('');
      setShowUrlInput(false);
      return;
    }

    // Fetch metadata for article URLs — always persist as urlmeta so we never store a raw URL.
    setUrlLoading(true);
    let domain = '';
    try { domain = new URL(finalUrl).hostname.replace(/^www\./, ''); } catch { /* noop */ }
    const minimalMeta: LinkMeta = {
      url: finalUrl, domain, siteName: domain,
      favicon: domain ? faviconFor(domain) : undefined,
      type: /truthsocial\.com/i.test(domain) ? 'article' : 'link',
    };
    try {
      const { data } = await supabase.functions.invoke('fetch-url-metadata', { body: { url: finalUrl } });
      if (data?.success) {
        const meta: LinkMeta = {
          url: data.url || finalUrl,
          title: data.title || undefined,
          description: data.description || undefined,
          image: data.image || undefined,
          domain: data.domain || domain,
          siteName: data.siteName || data.domain || domain,
          favicon: data.favicon || minimalMeta.favicon,
          youtubeId: data.youtubeId,
          type: data.type || minimalMeta.type,
          publishedAt: data.publishedAt,
        };
        setUrlMeta(meta);
        onChange(encodeLinkMeta(meta));
      } else {
        setUrlMeta(minimalMeta);
        onChange(encodeLinkMeta(minimalMeta));
      }
    } catch {
      setUrlMeta(minimalMeta);
      onChange(encodeLinkMeta(minimalMeta));
    } finally {
      setUrlLoading(false);
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  const fileAccept = [
    ...(accept.includes('image') ? ['image/*'] : []),
    ...(accept.includes('video') ? ['video/mp4', 'video/webm'] : []),
  ].join(',');

  const ytId = rawUrl ? getYouTubeId(rawUrl) : null;
  const isTruthSocial = !!urlMeta?.domain && /truthsocial\.com$/i.test(urlMeta.domain);

  // Decide what image to show in the news card hero area.
  // Priority: real OG image (if not failed) -> page screenshot (if not failed/blocked) -> none.
  const screenshotUrl = urlMeta ? screenshotFor(urlMeta.url) : '';
  const heroImage = urlMeta
    ? (urlMeta.image && !ogImageFailed
        ? urlMeta.image
        : (!screenshotFailed && screenshotUrl ? screenshotUrl : ''))
    : '';
  const hasHero = !!heroImage;
  // Show explicit "Screenshot unavailable" state when we have no OG image AND
  // screenshot is either blocked (anti-bot domain) or has failed to load.
  const showUnavailable = !!urlMeta && !urlMeta.image && !heroImage &&
    (isScreenshotBlocked(urlMeta.url) || screenshotFailed);

  // Validate loaded image is not microscopic (e.g. NYTimes generic placeholder)
  // and detect anti-bot pages (mshots returns a tiny grey thumbnail for blocked sites).
  const handleHeroLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalWidth < 200 && img.naturalHeight < 200) {
      if (urlMeta?.image && !ogImageFailed) setOgImageFailed(true);
      else if (!screenshotFailed) setScreenshotFailed(true);
    }
  };
  const handleHeroError = () => {
    if (urlMeta?.image && !ogImageFailed) setOgImageFailed(true);
    else if (!screenshotFailed) setScreenshotFailed(true);
  };

  const retryScreenshot = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOgImageFailed(false);
    setScreenshotFailed(false);
  };


  // ── PREVIEW ──────────────────────────────────
  if (value) {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</Label>
        <div className="relative group rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm">

          {/* YouTube embed */}
          {ytId ? (
            <div className="aspect-video">
              <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
            </div>
          ) : mediaType === 'video' || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:video') ? (
            <video src={rawUrl} controls className="mx-auto block w-4/5 max-w-full rounded-xl bg-black" style={{ maxHeight: maxPreviewHeight }} />
          ) : mediaType === 'url' && urlMeta ? (
            /* Rich news / link card — institutional research board aesthetic */
            <a href={urlMeta.url} target="_blank" rel="noopener noreferrer" className="block hover:bg-muted/10 transition-colors">
              {hasHero ? (
                <div className="relative w-full bg-muted/20 border-b border-border/40 overflow-hidden flex items-center justify-center" style={{ aspectRatio: '16 / 9' }}>
                  <img
                    src={heroImage}
                    alt={urlMeta.title || urlMeta.domain || ''}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                    onLoad={handleHeroLoad}
                    onError={handleHeroError}
                  />
                  {isTruthSocial && (
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-background/90 text-[10px] font-semibold tracking-wide border border-border/60">
                      TRUTH SOCIAL
                    </div>
                  )}
                </div>
              ) : showUnavailable ? (
                <div className="relative w-full bg-muted/30 border-b border-border/40 h-[140px] sm:h-[160px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Globe className="h-6 w-6 opacity-50" />
                  <p className="text-[11px] font-semibold uppercase tracking-wider">Screenshot unavailable</p>
                  {!isScreenshotBlocked(urlMeta.url) && (
                    <button
                      type="button"
                      onClick={retryScreenshot}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-background border border-border/60 hover:bg-muted hover:text-foreground transition-colors"
                    >
                      Retry screenshot
                    </button>
                  )}
                </div>
              ) : null}
              <div className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  {urlMeta.favicon ? (
                    <img src={urlMeta.favicon} alt="" loading="lazy" decoding="async" className="h-3.5 w-3.5 rounded-sm" />
                  ) : (
                    <Globe className="h-3 w-3" />
                  )}
                  <span>{urlMeta.siteName || urlMeta.domain}</span>
                  {urlMeta.publishedAt && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <CalendarDays className="h-3 w-3" />
                      <span className="font-normal normal-case tracking-normal">
                        {(() => { try { return new Date(urlMeta.publishedAt!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return urlMeta.publishedAt; } })()}
                      </span>
                    </>
                  )}
                </div>
                {urlMeta.title ? (
                  <p className="text-base font-bold text-foreground leading-snug line-clamp-3">{urlMeta.title}</p>
                ) : (() => {
                  // Derive a human title from the URL slug when scraping returned nothing.
                  let derived = '';
                  try {
                    const u = new URL(urlMeta.url);
                    const seg = u.pathname.split('/').filter(Boolean).pop() || '';
                    derived = decodeURIComponent(seg)
                      .replace(/[-_]+/g, ' ')
                      .replace(/\.(html?|php|aspx?)$/i, '')
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                      .trim();
                  } catch { /* noop */ }
                  return (
                    <p className="text-base font-bold text-foreground leading-snug line-clamp-3">
                      {derived || `Article on ${urlMeta.siteName || urlMeta.domain || 'this site'}`}
                    </p>
                  );
                })()}
                {urlMeta.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{urlMeta.description}</p>
                )}
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline">
                    Open article <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </a>
          ) : mediaType === 'url' ? (
            /* Loading / fallback — favicon + clickable URL while metadata hydrates */
            <a href={rawUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-5 hover:bg-muted/10 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                {(() => {
                  try {
                    const d = new URL(rawUrl).hostname.replace(/^www\./, '');
                    return <img src={faviconFor(d)} alt="" loading="lazy" decoding="async" className="h-7 w-7" />;
                  } catch {
                    return <Link2 className="h-4 w-4 text-muted-foreground" />;
                  }
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{(() => { try { return new URL(rawUrl).hostname.replace(/^www\./, ''); } catch { return rawUrl; } })()}</p>
                <p className="text-[11px] text-muted-foreground truncate">{rawUrl}</p>
              </div>
              <Loader2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 animate-spin" />
            </a>
          ) : forceAspect ? (
            /* Image preview — fixed aspect ratio with object-contain to preserve full screenshot */
            <div
              className="w-full overflow-hidden rounded-lg bg-muted/10 cursor-pointer flex items-center justify-center"
              style={{ aspectRatio: forceAspect.replace('/', ' / ') }}
              onClick={() => { setZoom(1); setViewerOpen(true); }}
            >
              <SmartImg
                src={rawUrl}
                alt={label}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            /* Image preview — intrinsic aspect ratio, capped at 80% of legacy display height */
            <SmartImg
              src={rawUrl}
              alt={label}
              style={{ width: '80%', maxWidth: '100%', height: 'auto', maxHeight: maxPreviewHeight, objectFit: 'contain' }}
              className="block bg-muted/10 cursor-pointer mx-auto"
              onClick={() => { setZoom(1); setViewerOpen(true); }}
              loading="lazy"
              decoding="async"
            />
          )}

          {/* Overlay controls */}
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
            {(mediaType === 'image' || (!ytId && mediaType !== 'video' && mediaType !== 'url')) && (
              <button onClick={() => { setZoom(1); setViewerOpen(true); }} className="h-8 w-8 rounded-lg bg-background/90 border border-border/50 flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-colors">
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={() => { onChange(''); setUrlMeta(null); }} className="h-8 w-8 rounded-lg bg-background/90 border border-border/50 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Image viewer dialog */}
        {mediaType === 'image' && (
          <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                <span className="text-xs font-mono text-muted-foreground min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setZoom(z => Math.min(5, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setZoom(1)}>Reset</Button>
              </div>
              <div className="overflow-auto max-h-[80vh] flex items-center justify-center">
                <SmartImg src={rawUrl} alt={label} loading="lazy" decoding="async" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }} className="max-w-full transition-transform duration-200" />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // ── EMPTY STATE / UPLOAD ─────────────────────
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</Label>
      <div
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        tabIndex={0}
        className={cn(
          'relative border-2 border-dashed rounded-xl text-center transition-all duration-300 focus:outline-none focus:border-primary/50 focus:bg-primary/[0.02]',
          dragging ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-border/50 hover:border-primary/40 hover:bg-primary/[0.02]'
        )}
      >
        {urlLoading ? (
          <div className="flex items-center justify-center gap-2 p-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading preview…</span>
          </div>
        ) : showUrlInput ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleUrlSubmit(); } }}
                placeholder="https://example.com or YouTube link..."
                className="h-9 text-xs rounded-lg flex-1"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" className="text-xs h-8 rounded-lg" onClick={() => setShowUrlInput(false)}>Cancel</Button>
              <Button type="button" size="sm" className="text-xs h-8 rounded-lg gap-1" onClick={() => handleUrlSubmit()}>
                <ExternalLink className="h-3 w-3" /> Embed
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-3">
            <div className="flex justify-center gap-3">
              {accept.includes('image') && (
                <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              {accept.includes('video') && (
                <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Video className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              {accept.includes('url') && (
                <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dragging ? 'Drop here!' : 'Drop, paste, or upload'}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {[
                  accept.includes('image') && 'Images',
                  accept.includes('video') && 'Videos',
                  accept.includes('url') && 'URLs',
                ].filter(Boolean).join(' · ')}
                {' · Ctrl+V to paste'}
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs font-semibold gap-1.5"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                <Upload className="h-3.5 w-3.5" /> Choose File
              </Button>
              {accept.includes('url') && (
                <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs font-semibold gap-1.5"
                  onClick={(e) => { e.stopPropagation(); setShowUrlInput(true); }}>
                  <Link2 className="h-3.5 w-3.5" /> Paste URL
                </Button>
              )}
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept={fileAccept} onChange={handleFileInput} className="hidden" />
      </div>
    </div>
  );
}
