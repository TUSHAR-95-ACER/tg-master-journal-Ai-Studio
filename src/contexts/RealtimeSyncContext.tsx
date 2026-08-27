import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Cross-client realtime synchronization.
 *
 * Subscribes to every user-facing table so edits made on ONE client (desktop
 * or web) appear on the OTHER client without a manual refresh — Notion /
 * Google-Docs style.
 *
 * How it works:
 *   1. Reads the current session's user_id.
 *   2. Opens one Postgres-changes channel filtered by `user_id=eq.<uid>`
 *      for each table below.
 *   3. On any INSERT / UPDATE / DELETE, invalidates React Query caches so
 *      any mounted page refetches the fresh row.
 *   4. Also emits a lightweight window event `mj:realtime` that individual
 *      screens (e.g. planning) can listen to and merge into local state.
 *
 * We NEVER mutate the save pipeline. Stale-write conflicts are handled by
 * the existing RPC guards; realtime just keeps the *read* view fresh so
 * the desktop doesn't submit an outdated snapshot in the first place.
 */
const SYNCED_TABLES = [
  'trades',
  'trading_accounts',
  'transactions',
  'scale_events',
  'weekly_plans',
  'daily_plans',
  'user_settings',
  'profiles',
  'macro_events',
  'macro_analyses',
  'macro_predictions',
  'macro_cycles',
  'notebook_entries',
  'trading_checklists',
  'trading_checklist_templates',
  'chat_threads',
  'chat_messages',
] as const;

export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const start = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;

      channel = supabase.channel(`mj-sync-${uid}`);

      for (const table of SYNCED_TABLES) {
        channel.on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table, filter: `user_id=eq.${uid}` },
          (payload: any) => {
            // Broad invalidation: any query key that includes the table name.
            qc.invalidateQueries({
              predicate: (q) => {
                const key = q.queryKey;
                return Array.isArray(key) && key.some((k) => k === table);
              },
            });
            // Broadcast so non-React-Query screens can react too.
            try {
              window.dispatchEvent(new CustomEvent('mj:realtime', {
                detail: { table, event: payload.eventType, new: payload.new, old: payload.old },
              }));
            } catch { /* ignore */ }
          },
        );
      }

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.info('[realtime-sync] connected for', uid);
        }
      });
    };

    start();

    // Restart the subscription when the user logs in/out.
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, _session) => {
      if (channel) { supabase.removeChannel(channel); channel = null; }
      start();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      authSub.subscription.unsubscribe();
    };
  }, [qc]);

  return <>{children}</>;
}
