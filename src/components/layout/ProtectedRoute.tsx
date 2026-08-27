import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isRecoveryActive } from '@/lib/recoveryState';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isPasswordRecovery } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading session...</div>
      </div>
    );
  }

  // Password recovery MUST take priority over journal / dashboard access
  if (isPasswordRecovery || isRecoveryActive()) {
    console.info('[auth-recovery] ProtectedRoute intercepting recovery session - redirecting to /reset-password', {
      currentPath: location.pathname,
    });
    return <Navigate to="/reset-password" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
