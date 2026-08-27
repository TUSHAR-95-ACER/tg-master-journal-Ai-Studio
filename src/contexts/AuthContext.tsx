import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearAllUserStorage } from '@/lib/userStorage';
import { isRecoveryActive, setRecoveryActive, subscribeToRecovery } from '@/lib/recoveryState';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (value: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signInAsDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecoveryState] = useState<boolean>(() => isRecoveryActive());
  const authEventSeenRef = useRef(false);

  const setIsPasswordRecovery = (value: boolean) => {
    setRecoveryActive(value);
    setIsPasswordRecoveryState(value);
  };

  useEffect(() => {
    const unsubscribe = subscribeToRecovery((active) => {
      setIsPasswordRecoveryState(active);
    });
    return unsubscribe;
  }, []);

  const authDebug = (stage: string, details: Record<string, unknown> = {}) => {
    console.info(`[auth] ${stage}`, {
      origin: window.location.origin,
      path: window.location.pathname,
      inIframe: window.self !== window.top,
      ...details,
    });
  };

  useEffect(() => {
    let mounted = true;
    console.info('[auth] init', {
      hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
      hasKey: Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
      origin: window.location.origin,
    });

    if (isRecoveryActive()) {
      setIsPasswordRecoveryState(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventSeenRef.current = true;
      console.info('[auth] state change', { event, signedIn: Boolean(nextSession?.user) });
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    // Hard timeout so the UI never gets stuck on "Loading..." if the auth
    // server is unreachable or the stored refresh token is bad.
    const failsafe = setTimeout(() => {
      console.warn('[auth] init timeout - showing login instead of blocking UI');
      if (mounted) setLoading(false);
    }, 8000);

    // Retry getSession once on transient network failure before giving up.
    const tryGetSession = async (attempt = 1): Promise<void> => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (!mounted || authEventSeenRef.current) return;
        if (error) {
          // Auth-level error (bad/expired refresh token) → clear local session.
          console.warn('[auth] getSession returned error; clearing local session', error);
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
        setSession(currentSession ?? null);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      } catch (error) {
        if (!mounted || authEventSeenRef.current) return;
        // Network/transport failure — retry once after short backoff before
        // assuming the stored session is bad.
        if (attempt < 2) {
          console.warn(`[auth] getSession transient failure (attempt ${attempt}); retrying`, error);
          await new Promise((r) => setTimeout(r, 1200));
          return tryGetSession(attempt + 1);
        }
        console.warn('[auth] getSession failed after retry; continuing without session', error);
        // Do NOT signOut on pure network failure — preserve token for next load.
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    tryGetSession().finally(() => clearTimeout(failsafe));

    return () => {
      mounted = false;
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const clearLocalAuthCache = () => {
    Object.keys(localStorage)
      .filter((key) => /^sb-.+-auth-token$/.test(key) || key === 'supabase.auth.token')
      .forEach((key) => localStorage.removeItem(key));
  };

  const signInWithGoogle = async () => {
    try {
      authDebug('google oauth start', { callbackOrigin: window.location.origin });
      clearLocalAuthCache();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (err: any) {
      setLoading(false);
      const errMsg = err?.message || String(err || '');
      if (/cancelled|canceled|closed|dismissed/i.test(errMsg)) {
        console.info('[auth] google sign-in cancelled');
        return;
      }
      console.warn('[auth] google sign-in error', {
        message: errMsg,
        origin: window.location.origin,
      });
      throw err;
    }
  };

  const signInAsDemo = () => {
    const demoUser: User = {
      id: 'demo-user-vista',
      app_metadata: { provider: 'demo' },
      user_metadata: { full_name: 'Demo Trader' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: 'demo@vistaschedule.com',
      phone: '',
      role: 'authenticated',
      updated_at: new Date().toISOString(),
    };
    const demoSession: Session = {
      access_token: 'demo-access-token',
      token_type: 'bearer',
      expires_in: 3600 * 24 * 365,
      refresh_token: 'demo-refresh-token',
      user: demoUser,
    };
    setSession(demoSession);
    setUser(demoUser);
    setLoading(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    console.info('[auth] email sign-in start', { emailDomain: email.split('@')[1] ?? 'unknown' });
    try {
      clearLocalAuthCache();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('[auth] email sign-in failed', error);
        throw error;
      }
      if (!data.session) {
        const noSessionError = new Error('Sign in completed but no session was returned. Please verify your email and try again.');
        console.error('[auth] email sign-in returned no session', noSessionError);
        throw noSessionError;
      }
      setSession(data.session);
      setUser(data.user ?? data.session.user);
      console.info('[auth] email sign-in request accepted');
    } catch (err) {
      console.error('[auth] email sign-in failed', err);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || '' },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const sendMagicLink = async (email: string) => {
    clearLocalAuthCache();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setIsPasswordRecovery(false);
    // Clear URL hash parameters cleanly without page reload
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const signOut = async () => {
    const currentUserId = user?.id;
    await supabase.auth.signOut();
    if (currentUserId) clearAllUserStorage(currentUserId);
    setUser(null);
    setSession(null);
    setIsPasswordRecovery(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isPasswordRecovery,
      setIsPasswordRecovery,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendMagicLink,
      resetPasswordForEmail,
      updatePassword,
      signInAsDemo,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
