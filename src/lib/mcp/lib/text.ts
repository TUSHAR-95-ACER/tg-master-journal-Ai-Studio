/** Shared helpers for extracting searchable / analysable text from JSONB blobs. */

/** Flatten any nested JSON value into a single lowercase-searchable string. */
export function flattenText(value: unknown, depth = 0): string {
  if (value == null || depth > 8) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => flattenText(v, depth + 1)).join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((v) => flattenText(v, depth + 1))
      .join(" ");
  }
  return "";
}

/** Normalize a JSONB list that may hold strings or `{ label|name|text|value }` objects. */
export function labelList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : value
        ? [value]
        : [];
  const out: string[] = [];
  for (const item of raw) {
    if (item == null) continue;
    if (typeof item === "string" || typeof item === "number") {
      const s = String(item).trim();
      if (s) out.push(s);
      continue;
    }
    if (typeof item === "object") {
      const o = item as Record<string, unknown>;
      const label = o.label ?? o.name ?? o.text ?? o.title ?? o.value ?? o.mistake ?? o.emotion;
      if (typeof label === "string" && label.trim()) out.push(label.trim());
      else {
        const nested = flattenText(o).trim();
        if (nested) out.push(nested.slice(0, 80));
      }
    }
  }
  return out;
}

/** Short highlighted snippet around the first match of `term`. */
export function snippet(text: string, term: string, radius = 90): string | null {
  const haystack = text.replace(/\s+/g, " ").trim();
  if (!haystack) return null;
  const idx = haystack.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return haystack.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(haystack.length, idx + term.length + radius);
  return `${start > 0 ? "…" : ""}${haystack.slice(start, end)}${end < haystack.length ? "…" : ""}`;
}

export function countOccurrences(text: string, term: string): number {
  if (!term) return 0;
  const t = text.toLowerCase();
  const q = term.toLowerCase();
  let count = 0;
  let i = t.indexOf(q);
  while (i !== -1) {
    count += 1;
    i = t.indexOf(q, i + q.length);
  }
  return count;
}
