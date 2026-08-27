import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions<T> {
  /** Current value to persist. Compared by reference + JSON. */
  value: T;
  /** Async write to the backing store. May return the canonical persisted value. */
  onSave: (value: T) => Promise<T | void> | T | void;
  /** Debounce in ms (default 1200). */
  debounceMs?: number;
  /** When false, autosave is paused entirely (e.g. while loading initial data). */
  enabled?: boolean;
  /** Called after a successful save (useful for cleaning local drafts). */
  onSaved?: (value: T) => void;
}

/**
 * Notion/Google-Docs style autosave:
 *  - debounced background save while the value changes
 *  - flushes immediately on tab hide, window blur, and beforeunload
 *  - flushes on unmount so navigation never loses data
 *  - exposes a status pill (idle / dirty / saving / saved / error)
 */
export function useAutosave<T>({
  value,
  onSave,
  debounceMs = 1200,
  enabled = true,
  onSaved,
}: UseAutosaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const valueRef = useRef(value);
  const savedSnapshotRef = useRef<string>(JSON.stringify(value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(false);
  const pendingRef = useRef(false);
  const savedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  valueRef.current = value;

  const performSave = useCallback(async () => {
    if (!enabled) return;
    const snapshot = JSON.stringify(valueRef.current);
    if (snapshot === savedSnapshotRef.current) {
      setStatus((s) => (s === 'dirty' || s === 'saving' ? 'saved' : s));
      return;
    }
    if (inflightRef.current) {
      pendingRef.current = true;
      return;
    }
    inflightRef.current = true;
    setStatus('saving');
    try {
      const toSave = valueRef.current;
      const persistedValue = await onSave(toSave);
      const savedValue = (persistedValue === undefined ? toSave : persistedValue) as T;
      savedSnapshotRef.current = JSON.stringify(savedValue);
      onSaved?.(savedValue);
      setStatus('saved');
      // Flip back to idle after a beat so the indicator doesn't shout forever.
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
      savedResetRef.current = setTimeout(() => setStatus('idle'), 1800);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[useAutosave] save failed; Saved state was not shown', error);
      setStatus('error');
    } finally {
      inflightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        performSave();
      }
    }
  }, [enabled, onSave, onSaved]);

  // Debounced save on value change.
  useEffect(() => {
    if (!enabled) return;
    const snapshot = JSON.stringify(value);
    if (snapshot === savedSnapshotRef.current) return;
    setStatus('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs, enabled]);

  // Flush on tab hide / window blur / beforeunload — protects against tab kill.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      performSave();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('blur', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('blur', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, performSave]);

  // Flush on unmount (route change / dialog close).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedResetRef.current) clearTimeout(savedResetRef.current);
      const snapshot = JSON.stringify(valueRef.current);
      if (snapshot !== savedSnapshotRef.current) {
        // Fire-and-forget; component is gone so we can't await.
        try {
          Promise.resolve(onSave(valueRef.current)).catch(() => {});
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flushNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await performSave();
  }, [performSave]);

  /** Mark current value as freshly persisted (after an external save). */
  const markSaved = useCallback(() => {
    savedSnapshotRef.current = JSON.stringify(valueRef.current);
    setStatus('idle');
  }, []);

  return { status, flushNow, markSaved };
}
