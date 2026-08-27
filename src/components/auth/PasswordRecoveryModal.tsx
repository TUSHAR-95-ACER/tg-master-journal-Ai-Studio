import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';

export function PasswordRecoveryModal() {
  const { isPasswordRecovery, setIsPasswordRecovery, updatePassword } = useAuth();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // If the user is on the dedicated /reset-password page, do not show duplicate modal
  if (location.pathname === '/reset-password') {
    return null;
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      toast({
        title: 'Password updated successfully!',
        description: 'You can now sign in with your new password on any device.',
      });
      setTimeout(() => {
        setIsPasswordRecovery(false);
        setSuccess(false);
        setPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please try again.');
      toast({
        title: 'Failed to update password',
        description: err?.message || 'Please check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    setIsPasswordRecovery(false);
    setError(null);
    setPassword('');
    setConfirmPassword('');
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  return (
    <Dialog open={isPasswordRecovery} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md p-6 bg-card border-border shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-heading font-bold text-center">
            Set Your New Password
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground text-center">
            You arrived via a verified password reset link. Enter your new password below to finish updating your account.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-3 text-center animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-foreground">Password successfully set!</p>
            <p className="text-xs text-muted-foreground">Redirecting to your journal workspace...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
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
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-new-password"
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

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="submit"
                className="w-full h-10 font-semibold"
                disabled={submitting || !password || !confirmPassword}
              >
                {submitting ? 'Updating Password...' : 'Save New Password'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto h-10 text-xs text-muted-foreground"
                onClick={handleDismiss}
                disabled={submitting}
              >
                Skip for now
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
