import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_trade_stats",
  title: "Get trade performance stats",
  description:
    "Compute aggregate performance stats (trade count, win rate, total P/L, average R) across the signed-in user's trades, optionally filtered to the last N days.",
  inputSchema: {
    days: z.number().int().min(1).max(3650).optional()
      .describe("Only include trades from the last N days. Omit for all-time stats."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("trades")
      .select("profit_loss,actual_rr,result,date")
      .eq("user_id", ctx.getUserId());
    if (days) {
      const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
      q = q.gte("date", since);
    }
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const count = rows.length;
    const wins = rows.filter((r: any) => r.result === "win").length;
    const losses = rows.filter((r: any) => r.result === "loss").length;
    const pnl = rows.reduce((s: number, r: any) => s + (Number(r.profit_loss) || 0), 0);
    const rValues = rows.map((r: any) => Number(r.actual_rr)).filter((v: number) => Number.isFinite(v));
    const avgR = rValues.length ? rValues.reduce((a, b) => a + b, 0) / rValues.length : 0;
    const stats = {
      window: days ? `last ${days} days` : "all time",
      trades: count,
      wins,
      losses,
      win_rate_pct: count ? +((wins / count) * 100).toFixed(2) : 0,
      total_profit_loss: +pnl.toFixed(2),
      average_r: +avgR.toFixed(3),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      structuredContent: stats,
    };
  },
});
