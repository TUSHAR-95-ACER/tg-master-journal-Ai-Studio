// Helpers for encoding URL link previews into a single string slot so that
// preview metadata persists in the database alongside the URL itself.
//
// Encoded form:
//   urlmeta:<base64-url-json>
// Decoded shape: { url, title?, description?, image?, domain?, siteName?,
//                  favicon?, youtubeId?, type?, publishedAt? }

export interface LinkMeta {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  siteName?: string;
  favicon?: string;
  youtubeId?: string;
  type?: 'image' | 'video' | 'article' | 'link';
  publishedAt?: string;
}

const PREFIX = 'urlmeta:';

function b64encode(s: string): string {
  // unicode-safe base64
  return btoa(unescape(encodeURIComponent(s)));
}
function b64decode(s: string): string {
  try { return decodeURIComponent(escape(atob(s))); } catch { return ''; }
}

export function encodeLinkMeta(meta: LinkMeta): string {
  return PREFIX + b64encode(JSON.stringify(meta));
}

export function decodeLinkMeta(value: string): LinkMeta | null {
  if (!value || !value.startsWith(PREFIX)) return null;
  const json = b64decode(value.slice(PREFIX.length));
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.url === 'string') return parsed as LinkMeta;
  } catch {}
  return null;
}

/** Returns the underlying raw URL for any slot value (data URL, blob, plain URL, or encoded meta). */
export function getRawUrl(value: string): string {
  const meta = decodeLinkMeta(value);
  return meta ? meta.url : value;
}

export function isEncodedLink(value: string): boolean {
  return !!value && value.startsWith(PREFIX);
}

/** Domain → favicon URL (Google s2 service, no auth required). */
export function faviconFor(domain: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Domains that aggressively block headless screenshot services (mshots, etc).
 * The fallback service returns an anti-bot page for these — never useful, so we
 * skip it and surface a clean "Screenshot unavailable" state instead.
 */
const SCREENSHOT_BLOCKED_DOMAINS = [
  'reuters.com', 'wsj.com', 'bloomberg.com', 'ft.com',
  'nytimes.com', 'economist.com', 'barrons.com', 'cnbc.com',
];

export function isScreenshotBlocked(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return SCREENSHOT_BLOCKED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

/** Fallback page screenshot service (no auth) for sites without OG images. Returns '' for blocked domains. */
export function screenshotFor(url: string, width = 800): string {
  if (isScreenshotBlocked(url)) return '';
  // Cache-bust query so retry actually re-requests the service.
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=${width}`;
}
