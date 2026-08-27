/** Media helpers shared by the MCP media tools (Deno-safe: no DOM APIs). */

const PREFIX = "urlmeta:";

function b64decode(value: string): string {
  try {
    // Deno/Node-safe base64 decode without DOM `atob`/`escape`.
    const bytes = Uint8Array.from(
      // eslint-disable-next-line no-restricted-globals
      (globalThis as any).atob
        ? (globalThis as any).atob(value)
        : Buffer.from(value, "base64").toString("binary"),
      (c: string) => c.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

/** Unwrap the app's `urlmeta:` slot encoding to the raw URL. */
export function rawUrl(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  if (!s.startsWith(PREFIX)) return s;
  const json = b64decode(s.slice(PREFIX.length));
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.url === "string") return parsed.url;
  } catch {
    /* fall through */
  }
  return s;
}

export const BUCKET = "journal-media";

/** Extract the storage path from any journal-media Supabase URL, or accept a bare path. */
export function storagePath(value: unknown): string | null {
  const url = rawUrl(value);
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/journal-media\/([^?#]+)/);
  if (m) {
    try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }
  if (/^https?:|^data:|^blob:/i.test(url)) return null;
  return url.replace(/^\/*/, "").replace(/^journal-media\//, "") || null;
}

/** Walk any JSON value and collect journal-media storage paths it references. */
export function collectPaths(value: unknown, out = new Set<string>(), depth = 0): Set<string> {
  if (value == null || depth > 8) return out;
  if (typeof value === "string") {
    const p = storagePath(value);
    if (p) out.add(p);
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectPaths(v, out, depth + 1);
    return out;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectPaths(v, out, depth + 1);
  }
  return out;
}
