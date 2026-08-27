/**
 * Regression guard: every image in the app must be uploaded to the
 * `journal-media` Storage bucket and persisted as a URL. Inline
 * `data:image/...;base64,...` payloads bloat list queries and broke
 * Daily/Weekly Plan performance — never let them reach the database again.
 *
 * Wrap every DB write payload with `assertNoBase64(payload, 'context')`.
 * - In development: throws loudly so the regression is caught immediately.
 * - In production: logs a warning and strips the offending values so the
 *   write still succeeds (avoids hard-breaking the user's save).
 */

const BASE64_IMAGE_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/;

function isDev(): boolean {
  try {
    // Vite injects this; fall back to NODE_ENV when running in tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta: any = (import.meta as any);
    if (meta && meta.env) return meta.env.DEV === true || meta.env.MODE !== 'production';
  } catch { /* noop */ }
  return false;
}

function walk(node: unknown, path: string, hits: string[], strip: boolean): unknown {
  if (node == null) return node;
  if (typeof node === 'string') {
    if (BASE64_IMAGE_RE.test(node)) {
      hits.push(path);
      return strip ? '' : node;
    }
    // Strings can themselves be JSON-encoded (jsonb-as-text columns).
    if (node.length > 32 && (node[0] === '[' || node[0] === '{')) {
      try {
        const parsed = JSON.parse(node);
        const before = hits.length;
        const cleaned = walk(parsed, path, hits, strip);
        if (hits.length > before) {
          return strip ? JSON.stringify(cleaned) : node;
        }
      } catch { /* not JSON, leave as-is */ }
    }
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((c, i) => walk(c, `${path}[${i}]`, hits, strip));
  }
  if (typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = walk(v, path ? `${path}.${k}` : k, hits, strip);
    }
    return out;
  }
  return node;
}

export function assertNoBase64<T>(payload: T, context: string): T {
  const dev = isDev();
  const hits: string[] = [];
  const cleaned = walk(payload, '', hits, !dev) as T;

  if (hits.length === 0) return payload;

  const msg =
    `[noBase64Guard] Attempted to write base64 image(s) to DB from "${context}". ` +
    `Every image must be uploaded via uploadJournalMedia() first. Offending paths: ${hits.join(', ')}`;

  if (dev) {
    // Hard fail in dev so the regression is impossible to miss.
    // eslint-disable-next-line no-console
    console.error(msg);
    throw new Error(msg);
  }

  // eslint-disable-next-line no-console
  console.warn(msg);
  return cleaned;
}
