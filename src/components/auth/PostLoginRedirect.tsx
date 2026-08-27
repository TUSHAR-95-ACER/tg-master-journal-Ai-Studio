import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isRecoveryActive } from '@/lib/recoveryState';

const STORAGE_KEY = 'tg_post_login_next';

/**
 * Persists a "return to" destination across a full-page OAuth round trip
 * (e.g. Google sign-in) and consumes it once the user is authenticated.
 *
 * Google OAuth's `redirect_uri` is fixed to the app origin, so any deep-link
 * intent (like the MCP consent route) would otherwise be lost after the
 * provider redirect. Callers save the intent with `savePostLoginNext(...)`
 * before starting the OAuth flow.
 */
export function savePostLoginNext(next: string) {
  if (!next || next === '/') return;
  if (!next.startsWith('/') || next.startsWith('//')) return;
  try { sessionStorage.setItem(STORAGE_KEY, next); } catch {}
}

export function PostLoginRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    if (location.pathname === '/reset-password' || isRecoveryActive()) return;

    let target: string | null = null;
    try { target = sessionStorage.getItem(STORAGE_KEY); } catch {}
    if (!target) return;
    if (!target.startsWith('/') || target.startsWith('//')) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    }
    if (location.pathname + location.search === target) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      return;
    }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    navigate(target, { replace: true });
  }, [user, loading, navigate, location.pathname, location.search]);
  return null;
}

