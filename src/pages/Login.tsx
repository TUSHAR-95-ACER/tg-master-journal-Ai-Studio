import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Mail, Lock, User, LogIn } from 'lucide-react';
import { RouteSeo } from '@/components/seo/RouteSeo';
import { savePostLoginNext } from '@/components/auth/PostLoginRedirect';
import { isRecoveryActive } from '@/lib/recoveryState';

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export default function Login() {
  const { user, loading, isPasswordRecovery, signInWithGoogle, signInWithEmail, signUpWithEmail, sendMagicLink, resetPasswordForEmail, signInAsDemo } = useAuth();
  const [params] = useSearchParams();
  const nextPath = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'magic'>('signin');
  const authBusy = loading || submitting;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (isPasswordRecovery || isRecoveryActive()) {
    return <Navigate to="/reset-password" replace />;
  }

  if (user) {
    return <Navigate to={nextPath} replace />;
  }


  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setAuthError(null);
    savePostLoginNext(nextPath);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const msg = err?.message || String(err || '');
      if (/cancelled|canceled|closed|dismissed/i.test(msg)) {
        return;
      }
      if (/missing OAuth secret|validation_failed|Unsupported provider/i.test(msg)) {
        toast({
          title: 'Google OAuth not enabled on backend',
          description: 'Please sign in with Email & Password or Instant Magic Link below to access your account.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Google sign in failed', description: msg || 'Please try again', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setAuthError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      const msg = err?.message || '';
      if (/invalid login credentials|invalid_credentials/i.test(msg)) {
        setAuthError('invalid_credentials');
        toast({
          title: 'Invalid email or password',
          description: 'No password found for this account or password was incorrect. You can sign in instantly with a Magic Link or create a password.',
          variant: 'destructive',
        });
      } else {
        setAuthError(msg || 'Sign in failed');
        toast({ title: 'Sign in failed', description: msg || 'Please check your credentials', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMagicLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      toast({ title: 'Email required', description: 'Please enter your email address first', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setAuthError(null);
    try {
      await sendMagicLink(email);
      setMagicLinkSent(true);
      toast({ title: 'Magic link sent!', description: `Check your inbox at ${email} to sign in instantly.` });
    } catch (err: any) {
      toast({ title: 'Could not send link', description: err?.message || 'Please try email & password', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: 'Email required', description: 'Please enter your email above to reset password', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await resetPasswordForEmail(email);
      setResetSent(true);
      toast({ title: 'Password reset link sent', description: `Check your inbox at ${email} for password reset instructions.` });
    } catch (err: any) {
      toast({ title: 'Reset request failed', description: err?.message || 'Please try magic link instead', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Minimum 6 characters', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    setAuthError(null);
    savePostLoginNext(nextPath);
    try {
      await signUpWithEmail(email, password, fullName);
      toast({ title: 'Check your email', description: 'We sent a confirmation link to verify your account.' });
    } catch (err: any) {
      toast({ title: 'Sign up failed', description: err?.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <RouteSeo />
      <div className="w-full max-w-md mx-auto px-6">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
          {/* Brand */}
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <span className="text-2xl font-black text-primary tracking-tighter">TG</span>
            </div>
            <h1 className="text-2xl font-heading font-bold uppercase tracking-wider text-foreground">
              TG Master Journal
            </h1>
            <p className="text-sm text-muted-foreground">
              Your professional trading journal
            </p>
          </div>

          <div className="border-t border-border" />

          {/* Google Sign In */}
          <Button
            onClick={handleGoogleSignIn}
            size="lg"
            className="w-full gap-3 h-12 text-sm font-semibold rounded-xl"
            disabled={authBusy}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {submitting ? 'Signing in...' : 'Continue with Google'}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
            </div>
          </div>

          {/* Email/Password / Magic Link */}
          <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'signin' | 'signup' | 'magic')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="magic">Magic Link</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleEmailSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-primary hover:underline"
                      disabled={authBusy}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-9"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      required
                    />
                  </div>
                </div>

                {authError === 'invalid_credentials' && (
                  <div className="p-3.5 text-xs bg-destructive/10 border border-destructive/20 rounded-xl space-y-2 text-foreground">
                    <p className="font-semibold text-destructive">Invalid email or password</p>
                    <p className="text-muted-foreground">
                      If you haven't set a password or originally used Google, you can log in instantly or create a new password:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs font-semibold"
                        onClick={() => handleMagicLink()}
                        disabled={authBusy}
                      >
                        Send Magic Link
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => setAuthTab('signup')}
                        disabled={authBusy}
                      >
                        Go to Sign Up
                      </Button>
                    </div>
                  </div>
                )}

                {resetSent && (
                  <div className="p-3 text-xs bg-primary/10 border border-primary/20 rounded-lg space-y-1 text-foreground">
                    <p className="font-semibold text-primary">Password reset link requested</p>
                    <p className="text-muted-foreground">
                      If an account with a password exists for <strong>{email}</strong>, instructions were sent to your inbox.
                    </p>
                    <p className="text-muted-foreground pt-1">
                      <em>Tip:</em> If you originally registered with Google or Magic Link without a password, use the <strong>Magic Link</strong> tab to sign in instantly.
                    </p>
                  </div>
                )}

                <Button type="submit" className="w-full h-11 rounded-xl" disabled={authBusy}>
                  <LogIn className="h-4 w-4 mr-2" />
                  {submitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="magic">
              <form onSubmit={handleMagicLink} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="magic-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We will send a one-click login link to your inbox. No password required.
                  </p>
                </div>
                {magicLinkSent && (
                  <div className="p-3 text-xs bg-primary/10 border border-primary/20 rounded-lg text-foreground">
                    Check your email inbox for your secure login link.
                  </div>
                )}
                <Button type="submit" className="w-full h-11 rounded-xl" disabled={authBusy}>
                  {submitting ? 'Sending link...' : 'Send Magic Link'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleEmailSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Your name"
                      className="pl-9"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Min 6 characters"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl" disabled={authBusy}>
                  {submitting ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => signInAsDemo()}
              className="w-full h-10 text-xs font-medium rounded-xl border-dashed hover:bg-muted/50"
              disabled={authBusy}
            >
              Explore as Demo Trader
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Sign in with Google, Email, or test with Demo Access
          </p>
        </div>
      </div>
    </main>
  );
}
