export function getUserStorageKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`;
}

export function loadUserStorage<T>(baseKey: string, userId: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(getUserStorageKey(baseKey, userId));
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

export function saveUserStorage<T>(baseKey: string, userId: string, value: T) {
  localStorage.setItem(getUserStorageKey(baseKey, userId), JSON.stringify(value));
}

/**
 * Remove ALL localStorage keys associated with the given user id. Used on
 * sign-out so that trading notes, research strategies, rules, etc. don't
 * remain readable on a shared device after the user logs out.
 */
export function clearAllUserStorage(userId: string) {
  if (!userId) return;
  const suffix = `:${userId}`;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(suffix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage access errors
  }
}