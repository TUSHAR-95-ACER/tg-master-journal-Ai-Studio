import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { isRecoveryActive, clearRecoveryState } from '@/lib/recoveryState';

export default function ResetPassword() {
  const { user, loading: authLoading, updatePassword, setIsPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    console.info('[auth-recovery] ResetPassword mounted', {
      userPresent: Boolean(user),
      isRecoveryActive: isRecoveryActive(),
      hash: window.location.hash ? window.location.hash.substring(0, 30) + '...' : 'empty',
    });

    const verifySession = async () => {
      try {
        if (user) {
          if (mounted) {
            setHasValidSession(true);
            setSessionChecking(false);
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          const valid = Boolean(session?.user) || isRecoveryActive();
          setHasValidSession(valid);
          setSessionChecking(false);
          console.info('[auth-recovery] verifySession result', { hasSession: Boolean(session), valid });
        }
      } catch (err) {
        console.error('[auth-recovery] Error checking session in ResetPassword', err);
        if (mounted) {
          setHasValidSession(isRecoveryActive());
          setSessionChecking(false);
        }
      }
    };

    if (!authLoading) {
      verifySession();
    } else {
      // Also check immediately if recovery is active
      if (isRecoveryActive()) {
        setHasValidSession(true);
      }
    }
    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    console.info('[auth-recovery] Submitting new password update...');
    try {
      await updatePassword(password);
      clearRecoveryState();
      setIsPasswordRecovery(false);
      setSuccess(true);
      toast({
        title: 'Password updated successfully!',
        description: 'You can now use your new password on all devices.',
      });
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error('[auth-recovery] Failed to update password', err);
      const errMsg = err?.message || 'Failed to update password. Please try again.';
      setError(errMsg);
      toast({
        title: 'Update failed',
        description: errMsg,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || sessionChecking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-heading font-semibold">Verifying Recovery Link...</h2>
          <p className="text-xs text-muted-foreground">Authenticating your secure recovery token with the server.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Set New Password</h1>
          <p className="text-sm text-muted-foreground">
            {hasValidSession
              ? 'Create a secure new password for your trading journal account'
              : 'Password reset link expired or invalid'}
          </p>
        </div>

        <Card className="border-border/60 shadow-lg bg-card">
          <CardContent className="pt-6">
            {!hasValidSession ? (
              <div className="py-4 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Session Not Found</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    The reset link may have expired, or was already used. Please request a fresh password reset email from the login page.
                  </p>
                </div>
                <Button onClick={() => { clearRecoveryState(); navigate('/login', { replace: true }); }} className="w-full mt-2">
                  Back to Login
                </Button>
              </div>
            ) : success ? (
              <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">Password Changed!</h3>
                  <p className="text-xs text-muted-foreground">
                    Your new credentials are now active. Taking you to your dashboard...
                  </p>
                </div>
                <Button onClick={() => { clearRecoveryState(); setIsPasswordRecovery(false); navigate('/', { replace: true }); }} className="w-full mt-2">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="page-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="page-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      minLength={6}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="page-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="page-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      className="pl-9"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 rounded-xl font-semibold" disabled={submitting || !password || !confirmPassword}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {submitting ? 'Updating Password...' : 'Save New Password'}
                </Button>

                <div className="text-center pt-2">
                  <Link to="/login" onClick={() => clearRecoveryState()} className="text-xs text-muted-foreground hover:text-foreground">
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
