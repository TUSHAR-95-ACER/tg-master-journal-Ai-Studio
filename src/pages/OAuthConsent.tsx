import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

// Supabase's OAuth 2.1 authorization server redirects users to this route
// with ?authorization_id=... so they can approve or deny an external client
// (e.g. ChatGPT / Claude / Cursor) that wants to connect to TG Master Journal
// as themselves via MCP.
type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scopes?: string[];
};

// Minimal typed shim over the beta supabase.auth.oauth namespace so this
// route compiles even if @types haven't caught up yet.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

function isSafeRelativePath(p: string): boolean {
  return p.startsWith("/") && !p.startsWith("//");
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const { user, loading } = useAuth();
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id in URL.");
      if (!user) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data ?? null);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Could not load authorization details.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, user, loading]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("The authorization server did not return a redirect URL.");
        setBusy(false);
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (loading || (!details && !error)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading authorization…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl space-y-4 text-center">
          <h1 className="text-xl font-heading font-bold uppercase tracking-wider">Authorization error</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => (window.location.href = "/")} variant="secondary" className="w-full">
            Return home
          </Button>
        </div>
      </main>
    );
  }

  const clientName = details?.client?.name ?? "An external app";

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-2xl font-black text-primary tracking-tighter">TG</span>
          </div>
          <h1 className="text-xl font-heading font-bold uppercase tracking-wider text-foreground">
            Connect {clientName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {clientName} is requesting access to your TG Master Journal account. It will be able to use
            the app's MCP tools as you.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm space-y-2">
          <div className="font-semibold text-foreground">Tools it can use:</div>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>Read your recent trades</li>
            <li>Read your performance stats</li>
            <li>Read your daily trading plans</li>
          </ul>
          <div className="text-xs text-muted-foreground pt-2">
            These tools are read-only. You can revoke access at any time.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve"}
          </Button>
        </div>
      </div>
    </main>
  );
}

export { isSafeRelativePath };
