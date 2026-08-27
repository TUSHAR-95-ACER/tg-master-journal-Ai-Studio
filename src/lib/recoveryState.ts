// Synchronous, immediate recovery state detection before GoTrueClient clears location.hash

const RECOVERY_STORAGE_KEY = 'tg_password_recovery_active';
const RECOVERY_TIMESTAMP_KEY = 'tg_password_recovery_time';
const MAX_RECOVERY_AGE_MS = 60 * 60 * 1000; // 1 hour validity

function logDiagnostic(msg: string, details?: Record<string, unknown>) {
  try {
    console.info(`[auth-recovery] ${msg}`, details ?? {});
  } catch {}
}

// Check immediately on module evaluation
function checkInitialRecovery(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const pathname = window.location.pathname || '';
    const href = window.location.href || '';

    logDiagnostic('Checking initial URL state', {
      pathname,
      hasHash: Boolean(hash),
      hasSearch: Boolean(search),
      hasTypeRecovery: hash.includes('type=recovery') || search.includes('type=recovery') || href.includes('type=recovery'),
      isResetPasswordPath: pathname === '/reset-password',
    });
    
    // Check if recovery parameter exists in URL
    if (
      hash.includes('type=recovery') ||
      search.includes('type=recovery') ||
      href.includes('type=recovery') ||
      (hash.includes('access_token=') && hash.includes('recovery'))
    ) {
      logDiagnostic('Recovery token detected in URL, activating recovery state');
      markRecoveryInStorage();
      if (typeof window !== 'undefined' && window.location.pathname !== '/reset-password') {
        const newUrl = window.location.origin + '/reset-password' + search + hash;
        window.history.replaceState(null, '', newUrl);
      }
      return true;
    }

    // Check if storage has an active, unexpired recovery session
    const stored = sessionStorage.getItem(RECOVERY_STORAGE_KEY) || localStorage.getItem(RECOVERY_STORAGE_KEY);
    const storedTime = Number(sessionStorage.getItem(RECOVERY_TIMESTAMP_KEY) || localStorage.getItem(RECOVERY_TIMESTAMP_KEY) || 0);
    const now = Date.now();

    if (stored === 'true' && storedTime && (now - storedTime < MAX_RECOVERY_AGE_MS)) {
      logDiagnostic('Active recovery state found in storage', { ageSeconds: Math.round((now - storedTime) / 1000) });
      return true;
    }

    // If on /reset-password path directly
    if (pathname === '/reset-password') {
      logDiagnostic('User landed directly on /reset-password');
      return true;
    }

    return false;
  } catch (err) {
    logDiagnostic('Error checking initial recovery', { err });
    return false;
  }
}

function markRecoveryInStorage() {
  try {
    const now = String(Date.now());
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, 'true');
    sessionStorage.setItem(RECOVERY_TIMESTAMP_KEY, now);
    localStorage.setItem(RECOVERY_STORAGE_KEY, 'true');
    localStorage.setItem(RECOVERY_TIMESTAMP_KEY, now);
  } catch {}
}

function wipeRecoveryFromStorage() {
  try {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    sessionStorage.removeItem(RECOVERY_TIMESTAMP_KEY);
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    localStorage.removeItem(RECOVERY_TIMESTAMP_KEY);
  } catch {}
}

let recoveryActive = checkInitialRecovery();
const listeners = new Set<(active: boolean) => void>();

export function isRecoveryActive(): boolean {
  if (recoveryActive) return true;
  try {
    const stored = sessionStorage.getItem(RECOVERY_STORAGE_KEY) || localStorage.getItem(RECOVERY_STORAGE_KEY);
    const storedTime = Number(sessionStorage.getItem(RECOVERY_TIMESTAMP_KEY) || localStorage.getItem(RECOVERY_TIMESTAMP_KEY) || 0);
    const now = Date.now();
    if (stored === 'true' && storedTime && (now - storedTime < MAX_RECOVERY_AGE_MS)) {
      recoveryActive = true;
      return true;
    }
  } catch {}
  return false;
}

export function setRecoveryActive(active: boolean) {
  logDiagnostic('setRecoveryActive called', { active, prev: recoveryActive });
  recoveryActive = active;
  if (active) {
    markRecoveryInStorage();
  } else {
    wipeRecoveryFromStorage();
  }
  listeners.forEach((listener) => {
    try {
      listener(active);
    } catch (e) {
      console.error('[auth-recovery] Error in recovery listener', e);
    }
  });
}

export function clearRecoveryState() {
  logDiagnostic('clearRecoveryState called');
  setRecoveryActive(false);
}

export function subscribeToRecovery(callback: (active: boolean) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
