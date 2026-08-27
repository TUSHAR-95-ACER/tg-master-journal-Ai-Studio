/**
 * Shared journal-media URL resolver.
 *
 * Historical DB records store *full signed URLs* pointing at
 *   /storage/v1/object/sign/journal-media/<user>/<...>?token=<jwt>
 *
 * Those tokens expire after 7 days, so migrated URLs eventually return
 * HTTP 400. This helper:
 *   1. Detects any URL that references our private journal-media bucket
 *      (signed, public, or authenticated form) and extracts the storage
 *      path.
 *   2. Re-signs it via the Supabase client with a fresh 7-day token,
 *      cached in-memory to avoid per-render network calls.
 *   3. Exposes a React hook `useResolvedMediaUrl` used by every image
 *      component so we never render a stale token.
 *
 * All other URLs (data:, blob:, http(s) to other hosts, empty) pass
 * through unchanged. Encoded `urlmeta:` values are decoded first via
 * `getRawUrl` at the call site.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'journal-media';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string>>();

/** Extract the storage path from any journal-media Supabase URL (sign/public/authenticated). */
export function extractJournalPath(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/journal-media\/([^?#]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

export function isJournalMediaUrl(url: string | null | undefined): boolean {
  return !!extractJournalPath(url);
}

/** Re-sign (or return cached) a URL for a bucket path. */
export async function resignJournalPath(path: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.exp > now + 5 * 60 * 1000) return cached.url;

  const existing = inflight.get(path);
  if (existing) return existing;

  const p = supabase.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS).then(({ data, error }) => {
    inflight.delete(path);
    if (error || !data?.signedUrl) throw error ?? new Error('sign failed');
    cache.set(path, { url: data.signedUrl, exp: now + (TTL_SECONDS - 3600) * 1000 });
    return data.signedUrl;
  }).catch((e) => {
    inflight.delete(path);
    throw e;
  });
  inflight.set(path, p);
  return p;
}

/**
 * Resolve any media URL to a currently-valid form. If the URL is not a
 * journal-media Supabase URL it is returned as-is.
 */
export async function resolveMediaUrl(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  const path = extractJournalPath(src);
  if (!path) return src;
  try { return await resignJournalPath(path); } catch { return src; }
}

/**
 * React hook — takes the raw src stored in the DB, returns a currently
 * valid src. Renders the original URL immediately, upgrades to the
 * fresh signed URL as soon as it's available.
 */
export function useResolvedMediaUrl(src: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(src ?? null);
  useEffect(() => {
    if (!src) { setResolved(null); return; }
    const path = extractJournalPath(src);
    if (!path) { setResolved(src); return; }
    // Optimistic: show the DB value while we re-sign.
    setResolved(src);
    let cancelled = false;
    resignJournalPath(path).then((u) => { if (!cancelled) setResolved(u); }).catch(() => { /* keep original */ });
    return () => { cancelled = true; };
  }, [src]);
  return resolved;
}

/** Invalidate one cached entry (called on <img> onError to force a re-sign). */
export function invalidateResolvedMediaUrl(src: string | null | undefined): void {
  const path = extractJournalPath(src);
  if (path) cache.delete(path);
}
