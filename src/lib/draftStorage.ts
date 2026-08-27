/**
 * User-scoped draft persistence for in-progress journal/form edits.
 * Keys are always prefixed with the user_id so drafts never leak across accounts.
 */

const DRAFT_PREFIX = 'tg_draft';

function key(scope: string, userId: string, id?: string) {
  return id ? `${DRAFT_PREFIX}:${scope}:${id}:${userId}` : `${DRAFT_PREFIX}:${scope}:${userId}`;
}

export interface DraftEnvelope<T> {
  data: T;
  savedAt: number;
}

export function saveDraft<T>(scope: string, userId: string, data: T, id?: string) {
  if (!userId) return;
  try {
    const envelope: DraftEnvelope<T> = { data, savedAt: Date.now() };
    localStorage.setItem(key(scope, userId, id), JSON.stringify(envelope));
  } catch {
    /* quota / unavailable — ignore */
  }
}

export function loadDraft<T>(scope: string, userId: string, id?: string): DraftEnvelope<T> | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(scope, userId, id));
    if (!raw) return null;
    return JSON.parse(raw) as DraftEnvelope<T>;
  } catch {
    return null;
  }
}

export function clearDraft(scope: string, userId: string, id?: string) {
  if (!userId) return;
  try {
    localStorage.removeItem(key(scope, userId, id));
  } catch {
    /* ignore */
  }
}

/** List every draft id for a given scope (useful for "you have N unsaved drafts" UIs). */
export function listDrafts(scope: string, userId: string): string[] {
  if (!userId) return [];
  const prefix = `${DRAFT_PREFIX}:${scope}:`;
  const suffix = `:${userId}`;
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && k.endsWith(suffix)) {
        const middle = k.slice(prefix.length, -suffix.length);
        if (middle) out.push(middle);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}
