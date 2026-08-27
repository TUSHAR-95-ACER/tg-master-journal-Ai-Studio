import { ExternalLink, Globe, Image as ImageIcon, Play, FileText, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UrlMetadata } from '@/hooks/useUrlPreview';

interface LinkPreviewProps {
  metadata: UrlMetadata;
  loading?: boolean;
  onRemove?: () => void;
  compact?: boolean;
}

export function LinkPreview({ metadata, loading, onRemove, compact }: LinkPreviewProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border/50 rounded-xl text-xs text-muted-foreground animate-pulse">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="truncate">Loading preview…</span>
      </div>
    );
  }

  if (!metadata?.success && !metadata?.url) return null;

  const { type, url, domain, title, description, image, youtubeId } = metadata;

  // ── Provider-specific embeds (check by host) ─────────────────────────
  let host = '';
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* ignore */ }

  // YouTube — extract a valid 11-char ID, never trust youtubeId blindly.
  const isYouTubeHost = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
  if (isYouTubeHost) {
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/);
    const ytId = ytMatch?.[1] || (youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId) ? youtubeId : null);
    if (ytId) {
      return (
        <div className="relative group rounded-xl overflow-hidden border border-border/50">
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
          {onRemove && <RemoveButton onRemove={onRemove} />}
        </div>
      );
    }
  }

  // Twitter / X — embed via publish.twitter.com (no script needed for blockquote, but we use iframe widget).
  const isTwitterHost = host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com');
  const tweetMatch = isTwitterHost ? url.match(/^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+\/status\/(\d+)/) : null;
  if (tweetMatch) {
    const tweetId = tweetMatch[1];
    return (
      <div className="relative group rounded-xl overflow-hidden border border-border/50 bg-card">
        <iframe
          src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark`}
          className="w-full"
          style={{ height: 520, border: 0 }}
          allow="clipboard-write"
          title="X post"
        />
        {onRemove && <RemoveButton onRemove={onRemove} />}
      </div>
    );
  }

  // Truth Social — extract status id, embed via official /embed route.
  const isTruthHost = host === 'truthsocial.com' || host.endsWith('.truthsocial.com');
  const truthMatch = isTruthHost ? url.match(/^https?:\/\/(?:www\.)?truthsocial\.com\/@[A-Za-z0-9_.-]+\/(?:posts\/)?(\d+)/) : null;
  if (truthMatch) {
    const postId = truthMatch[1];
    return (
      <div className="relative group rounded-xl overflow-hidden border border-border/50 bg-card">
        <iframe
          src={`https://truthsocial.com/embed/${postId}`}
          className="w-full"
          style={{ height: 560, border: 0 }}
          title="Truth Social post"
          sandbox="allow-scripts allow-popups allow-same-origin allow-popups-to-escape-sandbox"
        />
        {onRemove && <RemoveButton onRemove={onRemove} />}
      </div>
    );
  }

  // Image preview
  if (type === 'image') {
    return (
      <div className="relative group rounded-xl overflow-hidden border border-border/50 bg-muted/10">
        <img src={url} alt={title || 'Image'} className={cn('w-full object-contain', compact ? 'max-h-[150px]' : 'max-h-[300px]')} loading="lazy" />
        <PreviewOverlay url={url} domain={domain} onRemove={onRemove} />
      </div>
    );
  }

  // Generic video / YouTube preview (legacy fallback via metadata.youtubeId)
  if (type === 'video' && youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    return (
      <div className="relative group rounded-xl overflow-hidden border border-border/50">
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="w-full h-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
        {onRemove && <RemoveButton onRemove={onRemove} />}
      </div>
    );
  }

  // Article / rich link preview
  if (type === 'article' && (title || description)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="group block">
        <div className="flex overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all">
          {image && (
            <div className={cn('shrink-0 bg-muted/20', compact ? 'w-20 h-20' : 'w-28 h-28')}>
              <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              <Globe className="h-3 w-3" />
              {domain}
            </div>
            {title && <p className={cn('font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors', compact ? 'text-xs' : 'text-sm')}>{title}</p>}
            {description && !compact && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>}
          </div>
          <div className="shrink-0 flex items-center px-3">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
        {onRemove && <RemoveButton onRemove={onRemove} absolute />}
      </a>
    );
  }

  // Fallback: simple link card
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="group block">
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-sm transition-all">
        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{title || url}</p>
          {domain && <p className="text-[10px] text-muted-foreground">{domain}</p>}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
      {onRemove && <RemoveButton onRemove={onRemove} absolute />}
    </a>
  );
}

function PreviewOverlay({ url, domain, onRemove }: { url: string; domain: string; onRemove?: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="flex items-center justify-between">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/80 hover:text-white flex items-center gap-1">
          <Globe className="h-3 w-3" /> {domain} <ExternalLink className="h-2.5 w-2.5" />
        </a>
        {onRemove && (
          <button onClick={(e) => { e.preventDefault(); onRemove(); }} className="h-6 w-6 rounded-md bg-black/40 flex items-center justify-center hover:bg-destructive transition-colors">
            <X className="h-3 w-3 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

function RemoveButton({ onRemove, absolute }: { onRemove: () => void; absolute?: boolean }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
      className={cn(
        'h-6 w-6 rounded-md bg-background/90 border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-destructive-foreground',
        absolute ? 'absolute top-2 right-2' : 'absolute top-2 right-2'
      )}
    >
      <X className="h-3 w-3" />
    </button>
  );
}

/** Renders all previews for detected URLs in a text */
export function LinkPreviewList({ 
  previews, 
  loading, 
  onRemove 
}: { 
  previews: Map<string, UrlMetadata>; 
  loading: Set<string>;
  onRemove?: (url: string) => void;
}) {
  const entries = Array.from(previews.entries());
  const loadingUrls = Array.from(loading).filter(u => !previews.has(u));

  if (entries.length === 0 && loadingUrls.length === 0) return null;

  return (
    <div className="space-y-2 mt-2">
      {loadingUrls.map(url => (
        <LinkPreview key={url} metadata={{ success: false, type: 'link', url, domain: '', title: '', description: '', image: '' }} loading />
      ))}
      {entries.map(([url, meta]) => (
        <LinkPreview key={url} metadata={meta} onRemove={onRemove ? () => onRemove(url) : undefined} compact />
      ))}
    </div>
  );
}
