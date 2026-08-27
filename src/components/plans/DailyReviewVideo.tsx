import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, ExternalLink, Trash2, Video } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { DailyReviewVideo as DailyReviewVideoMeta } from '@/types/trading';

/**
 * Extract a Google Drive file id from any common Drive URL pattern.
 * Supports:
 *   /file/d/{id}/...
 *   /open?id={id}
 *   ?id={id}
 *   /uc?id={id}
 *   bare 25+ char id
 */
export function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const u = url.trim();
  const m1 = u.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m1) return m1[1];
  const m2 = u.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m2) return m2[1];
  const m3 = u.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m3) return m3[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(u)) return u;
  return null;
}

const driveEmbed = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
const driveOpen = (id: string) => `https://drive.google.com/file/d/${id}/view`;
const driveThumb = (id: string) => `https://lh3.googleusercontent.com/d/${id}=s1280`;

interface Props {
  value: DailyReviewVideoMeta | null | undefined;
  onChange: (next: DailyReviewVideoMeta | null) => void;
}

export function DailyReviewVideo({ value, onChange }: Props) {
  const [linkInput, setLinkInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [playing, setPlaying] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const [embedBroken, setEmbedBroken] = useState(false);

  const fileId = useMemo(
    () => value?.file_id || (value?.video_url ? extractDriveFileId(value.video_url) : null),
    [value],
  );

  const handleSave = () => {
    const id = extractDriveFileId(linkInput);
    if (!id) {
      toast({ title: 'Invalid link', description: 'Paste a Google Drive video link.', variant: 'destructive' });
      return;
    }
    onChange({
      video_url: linkInput.trim(),
      video_title: titleInput.trim() || undefined,
      provider: 'google_drive',
      added_at: new Date().toISOString(),
      file_id: id,
    });
    setLinkInput('');
    setTitleInput('');
    setPlaying(false);
    setThumbBroken(false);
    setEmbedBroken(false);
    toast({ title: 'Video saved' });
  };

  const handleRemove = () => {
    onChange(null);
    setPlaying(false);
  };

  if (!value || !fileId) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Paste a Google Drive video link. Only the URL is stored — the video stays on Drive.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="https://drive.google.com/file/d/…/view"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Title (optional)"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            className="sm:max-w-[220px]"
          />
          <Button onClick={handleSave} disabled={!linkInput.trim()}>
            Save Video
          </Button>
        </div>
      </div>
    );
  }

  const dateLabel = (() => {
    try {
      return new Date(value.added_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch { return ''; }
  })();

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      {/* Player area */}
      <div className="relative w-full bg-black aspect-video">
        {playing ? (
          embedBroken ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
              <p className="text-sm text-muted-foreground">Unable to embed this video.</p>
              <a href={driveOpen(fileId)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary" className="gap-2">
                  <ExternalLink className="h-4 w-4" /> Open in Google Drive
                </Button>
              </a>
            </div>
          ) : (
            <iframe
              src={driveEmbed(fileId)}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setEmbedBroken(true)}
              title={value.video_title || 'Daily Review Video'}
            />
          )
        ) : (
          <>
            {!thumbBroken ? (
              <img
                src={driveThumb(fileId)}
                alt={value.video_title || 'Daily review video thumbnail'}
                className="absolute inset-0 w-full h-full object-cover opacity-80"
                loading="lazy"
                decoding="async"
                onError={() => setThumbBroken(true)}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-amber-900/20 flex items-center justify-center">
                <Video className="h-12 w-12 text-emerald-400/50" />
              </div>
            )}
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="absolute inset-0 flex items-center justify-center group"
              aria-label="Play video"
            >
              <span className="h-16 w-16 rounded-full bg-emerald-500/90 group-hover:bg-emerald-400 flex items-center justify-center shadow-2xl transition">
                <Play className="h-7 w-7 text-black fill-black ml-1" />
              </span>
            </button>
          </>
        )}
      </div>

      {/* Meta + actions */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {value.video_title || 'Daily Review Video'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Google Drive · added {dateLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!playing && (
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setPlaying(true)}>
              <Play className="h-3.5 w-3.5" /> Play
            </Button>
          )}
          <a href={driveOpen(fileId)} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Open in Drive
            </Button>
          </a>
          <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
