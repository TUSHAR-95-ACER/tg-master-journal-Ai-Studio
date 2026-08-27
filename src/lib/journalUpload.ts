import { supabase } from '@/integrations/supabase/client';
import { effectiveContentType } from '@/lib/mediaTypes';

const BUCKET = 'journal-media';

export type UploadProgress = (pct: number) => void;

export interface UploadedMedia {
  path: string;       // storage path inside bucket
  url: string;        // signed URL for display
  type: 'image' | 'video';
  name: string;
  size: number;
}

/**
 * Upload a file to private journal-media bucket with progress.
 * Path: <user_id>/<scope>/<timestamp>_<safe-name>
 */
export async function uploadJournalMedia(
  file: File,
  scope: string,
  onProgress?: UploadProgress,
): Promise<UploadedMedia> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw new Error('Not authenticated');

  const userId = userData.user.id;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const path = `${userId}/${scope}/${Date.now()}_${safe}`;

  // supabase-js doesn't expose progress; emulate start/end ticks
  onProgress?.(5);
  const ticker = onProgress
    ? setInterval(() => onProgress(Math.min(90, (Math.random() * 10) + 30)), 250)
    : null;

  const contentType = effectiveContentType(file);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  });
  if (ticker) clearInterval(ticker);
  if (error) {
    onProgress?.(0);
    throw error;
  }

  onProgress?.(95);
  const url = await getSignedUrl(path);
  onProgress?.(100);

  return {
    path,
    url,
    type: contentType.startsWith('video/') ? 'video' : 'image',
    name: file.name,
    size: file.size,
  };
}

export async function getSignedUrl(path: string, expiresIn = 60 * 60 * 24 * 7): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) throw error ?? new Error('Failed to sign URL');
  return data.signedUrl;
}

export async function deleteJournalMedia(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * Refresh signed URLs for stored MediaAsset[]. Handles both:
 *  - items that already carry a `path` (modern uploads), and
 *  - legacy/migrated items whose `url` embeds the storage path (extracted
 *    via extractJournalPath) so historical Notebook/Plan media doesn't 400.
 */
export async function refreshSignedUrls<T extends { path?: string; url?: string }>(items: T[]): Promise<T[]> {
  const { extractJournalPath } = await import('@/lib/mediaUrl');
  return Promise.all(
    items.map(async (it) => {
      const path = it.path ?? extractJournalPath(it.url);
      if (!path) return it;
      try {
        const url = await getSignedUrl(path);
        return { ...it, path, url };
      } catch {
        return it;
      }
    }),
  );
}
