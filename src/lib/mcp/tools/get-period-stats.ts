import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { computeMetrics, monthKey, weekStart } from "../lib/analytics";

export default defineTool({
  name: "get_period_stats",
  title: "Get monthly or weekly statistics",
  description:
    "Break the signed-in user's performance down by month or by week (net P/L, win rate, profit factor, trade count per period). Useful for month-over-month comparison and weekly reporting.",
  inputSchema: {
    period: z.string().optional().describe("Bucket size: 'month' (default) or 'week'."),
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    limit: z.number().int().min(1).max(60).default(12).describe("Max periods returned, most recent first. Default 12."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ period, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("trades")
      .select("date,result,status,profit_loss,actual_rr,planned_rr")
      .eq("user_id", ctx.getUserId());
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) return failure(error.message);

    const bucketBy = String(period ?? "month").toLowerCase() === "week" ? weekStart : monthKey;
    const buckets = new Map<string, any[]>();
    for (const row of (data ?? []) as any[]) {
      const key = bucketBy(row.date);
      if (!key) continue;
      buckets.set(key, [...(buckets.get(key) ?? []), row]);
    }
    const periods = [...buckets.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, limit ?? 12)
      .map(([key, rows]) => ({ period: key, ...computeMetrics(rows) }));

    return ok({ granularity: String(period ?? "month").toLowerCase() === "week" ? "week" : "month", periods });
  },
});
