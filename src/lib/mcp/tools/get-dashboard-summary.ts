import { defineTool } from "@lovable.dev/mcp-js";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { computeMetrics, groupPerformance } from "../lib/analytics";

export default defineTool({
  name: "get_dashboard_summary",
  title: "Get dashboard summary",
  description:
    "High-level snapshot of the signed-in user's journal: all-time and last-30-day performance, top sessions and pairs, account balances, and the most recent trades.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();

    const [tradesRes, accountsRes, recentRes] = await Promise.all([
      sb
        .from("trades")
        .select("date,asset,session,setup,grade,result,status,profit_loss,actual_rr,planned_rr")
        .eq("user_id", uid),
      sb
        .from("trading_accounts")
        .select("id,name,broker,type,currency,starting_balance,current_size,status,stage")
        .eq("user_id", uid),
      sb
        .from("trades")
        .select("id,date,asset,direction,session,setup,grade,result,profit_loss,actual_rr")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .limit(10),
    ]);

    if (tradesRes.error) return failure(tradesRes.error.message);
    const rows = (tradesRes.data ?? []) as any[];
    const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const last30 = rows.filter((r) => String(r.date ?? "") >= since);

    return ok({
      all_time: computeMetrics(rows),
      last_30_days: computeMetrics(last30),
      top_sessions: groupPerformance(rows, "session").slice(0, 5),
      top_pairs: groupPerformance(rows, "asset").slice(0, 5),
      accounts: accountsRes.error ? [] : accountsRes.data ?? [],
      recent_trades: recentRes.error ? [] : recentRes.data ?? [],
    });
  },
});
