import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { computeMetrics, groupPerformance } from "../lib/analytics";

const DIMENSIONS = ["setup", "asset", "session", "grade", "direction", "market_condition", "timeframe"] as const;

export default defineTool({
  name: "analyze_setups",
  title: "Rank strongest and weakest setups",
  description:
    "Rank the signed-in user's setups (and optionally assets, sessions, grades, direction, market condition or timeframe) by net P/L, win rate, profit factor and expectancy, highlighting the strongest and weakest performers.",
  inputSchema: {
    dimension: z.string().optional().describe("What to rank: setup (default), asset, session, grade, direction, market_condition or timeframe."),
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    days: z.number().int().min(1).max(3650).optional().describe("Alternative to from/to: last N days."),
    min_trades: z.number().int().min(1).max(100).default(3).describe("Ignore buckets with fewer trades than this. Default 3."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ dimension, from, to, days, min_trades }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const dim = (DIMENSIONS as readonly string[]).includes(String(dimension)) ? String(dimension) : "setup";
    const sb = supabaseForUser(ctx);
    const start = from ?? (days ? new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10) : undefined);
    let q = sb
      .from("trades")
      .select("date,asset,session,setup,grade,direction,market_condition,timeframe,result,status,profit_loss,actual_rr,planned_rr")
      .eq("user_id", ctx.getUserId());
    if (start) q = q.gte("date", start);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) return failure(error.message);

    const rows = (data ?? []) as any[];
    const threshold = min_trades ?? 3;
    const all = groupPerformance(rows, dim as any);
    const qualified = all.filter((g) => g.trades >= threshold);
    const ranked = qualified.length ? qualified : all;

    return ok({
      dimension: dim,
      window: { from: start ?? null, to: to ?? null },
      min_trades: threshold,
      overall: computeMetrics(rows),
      ranking: all,
      strongest: ranked.slice(0, 3),
      weakest: ranked.slice(-3).reverse(),
      excluded_low_sample: all.filter((g) => g.trades < threshold).map((g) => g.label),
    });
  },
});
