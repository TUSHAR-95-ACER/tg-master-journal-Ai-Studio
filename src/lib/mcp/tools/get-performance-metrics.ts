import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { computeMetrics, groupPerformance } from "../lib/analytics";

export default defineTool({
  name: "get_performance_metrics",
  title: "Get performance metrics",
  description:
    "Compute the signed-in user's performance metrics: win rate, net P/L, profit factor, expectancy, average win/loss and average R. Optionally scoped to a date range, and optionally broken down by session, asset, setup or grade.",
  inputSchema: {
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    days: z.number().int().min(1).max(3650).optional().describe("Alternative to from/to: last N days."),
    group_by: z.string().optional().describe("Optional breakdown dimension: session, asset, setup or grade."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, days, group_by }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("trades")
      .select("date,asset,session,setup,grade,result,status,profit_loss,actual_rr,planned_rr")
      .eq("user_id", ctx.getUserId());
    const start = from ?? (days ? new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10) : undefined);
    if (start) q = q.gte("date", start);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) return failure(error.message);
    const rows = (data ?? []) as any[];
    const dim = ["session", "asset", "setup", "grade"].includes(String(group_by)) ? String(group_by) : null;
    return ok({
      window: { from: start ?? null, to: to ?? null },
      metrics: computeMetrics(rows),
      breakdown: dim ? { dimension: dim, groups: groupPerformance(rows, dim as any) } : null,
    });
  },
});
