import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { equityCurve } from "../lib/analytics";

export default defineTool({
  name: "get_equity_curve",
  title: "Get equity curve",
  description:
    "Return the signed-in user's cumulative P/L curve over time, with peak equity and max drawdown. Optionally scoped to a date range and offset by a starting balance.",
  inputSchema: {
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    starting_balance: z.number().optional().describe("Balance the curve starts from. Default 0."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, starting_balance }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("trades")
      .select("date,result,status,profit_loss")
      .eq("user_id", ctx.getUserId());
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error) return failure(error.message);
    return ok(equityCurve((data ?? []) as any[], starting_balance ?? 0));
  },
});
