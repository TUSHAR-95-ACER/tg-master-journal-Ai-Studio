import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, isExecuted, isLoss, isWin, num, ok, round, supabaseForUser, unauthenticated } from "../lib/client";
import { labelList } from "../lib/text";

export default defineTool({
  name: "analyze_mistakes",
  title: "Analyze recurring mistakes",
  description:
    "Find the signed-in user's most frequent trading mistakes / rule violations and quantify their cost: occurrences, win rate and net P/L of trades where each mistake appeared, plus recent examples.",
  inputSchema: {
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    days: z.number().int().min(1).max(3650).optional().describe("Alternative to from/to: last N days."),
    limit: z.number().int().min(1).max(50).default(15).describe("How many distinct mistakes to return. Default 15."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, days, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const start = from ?? (days ? new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10) : undefined);
    let q = sb
      .from("trades")
      .select("id,date,asset,session,setup,grade,result,status,profit_loss,actual_rr,mistakes,psychology")
      .eq("user_id", ctx.getUserId());
    if (start) q = q.gte("date", start);
    if (to) q = q.lte("date", to);
    const { data, error } = await q.order("date", { ascending: false });
    if (error) return failure(error.message);

    const rows = ((data ?? []) as any[]).filter(isExecuted);
    const buckets = new Map<string, any[]>();
    let cleanTrades = 0;
    let cleanPnl = 0;

    for (const row of rows) {
      const psych = (row.psychology ?? {}) as Record<string, unknown>;
      const labels = [...labelList(row.mistakes), ...labelList(psych.mistakes)];
      const unique = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
      if (unique.length === 0) {
        cleanTrades += 1;
        cleanPnl += num(row.profit_loss);
        continue;
      }
      for (const label of unique) buckets.set(label, [...(buckets.get(label) ?? []), row]);
    }

    const mistakes = [...buckets.entries()]
      .map(([mistake, group]) => {
        const wins = group.filter((r) => isWin(r.result)).length;
        const losses = group.filter((r) => isLoss(r.result)).length;
        const netPnl = group.reduce((s, r) => s + num(r.profit_loss), 0);
        return {
          mistake,
          occurrences: group.length,
          wins,
          losses,
          win_rate_pct: group.length ? round((wins / group.length) * 100) : 0,
          net_profit_loss: round(netPnl),
          average_profit_loss: round(netPnl / group.length),
          last_seen: group[0]?.date ?? null,
          examples: group.slice(0, 3).map((r) => ({
            id: r.id, date: r.date, asset: r.asset, setup: r.setup, result: r.result,
            profit_loss: round(num(r.profit_loss)),
          })),
        };
      })
      .sort((a, b) => a.net_profit_loss - b.net_profit_loss || b.occurrences - a.occurrences)
      .slice(0, limit ?? 15);

    const dirtyTrades = rows.length - cleanTrades;
    const dirtyPnl = rows.reduce((s, r) => s + num(r.profit_loss), 0) - cleanPnl;

    return ok({
      window: { from: start ?? null, to: to ?? null },
      executed_trades: rows.length,
      trades_with_mistakes: dirtyTrades,
      clean_trades: cleanTrades,
      mistake_rate_pct: rows.length ? round((dirtyTrades / rows.length) * 100) : 0,
      net_profit_loss_clean: round(cleanPnl),
      net_profit_loss_with_mistakes: round(dirtyPnl),
      estimated_cost_of_mistakes: round(
        (cleanTrades ? (cleanPnl / cleanTrades) * dirtyTrades : 0) - dirtyPnl,
      ),
      mistakes,
    });
  },
});
