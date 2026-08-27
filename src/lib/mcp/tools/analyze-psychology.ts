import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, isExecuted, isWin, num, ok, round, supabaseForUser, unauthenticated } from "../lib/client";
import { labelList } from "../lib/text";

function bucketStats(group: any[]) {
  const wins = group.filter((r) => isWin(r.result)).length;
  const net = group.reduce((s, r) => s + num(r.profit_loss), 0);
  return {
    trades: group.length,
    wins,
    win_rate_pct: group.length ? round((wins / group.length) * 100) : 0,
    net_profit_loss: round(net),
    average_profit_loss: group.length ? round(net / group.length) : 0,
  };
}

export default defineTool({
  name: "analyze_psychology",
  title: "Analyze psychology and discipline",
  description:
    "Correlate the signed-in user's emotional state, discipline flags, trade grades and market sentiment with trading outcomes: which emotions precede wins or losses, and how discipline affects P/L.",
  inputSchema: {
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    days: z.number().int().min(1).max(3650).optional().describe("Alternative to from/to: last N days."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, days }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const start = from ?? (days ? new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10) : undefined);
    let q = sb
      .from("trades")
      .select("id,date,asset,setup,grade,result,status,profit_loss,actual_rr,psychology,mistakes,market_sentiment,day_tags")
      .eq("user_id", ctx.getUserId());
    if (start) q = q.gte("date", start);
    if (to) q = q.lte("date", to);
    const { data, error } = await q.order("date", { ascending: false });
    if (error) return failure(error.message);

    const rows = ((data ?? []) as any[]).filter(isExecuted);

    const emotions = new Map<string, any[]>();
    const tags = new Map<string, any[]>();
    const grades = new Map<string, any[]>();
    const disciplined: any[] = [];
    const undisciplined: any[] = [];

    for (const row of rows) {
      const psych = (row.psychology ?? {}) as Record<string, unknown>;
      const labels = [
        ...labelList(psych.emotions),
        ...labelList(psych.emotion),
        ...labelList(psych.state),
        ...labelList(psych.feelings),
        ...labelList(psych.tags),
      ];
      for (const label of [...new Set(labels)]) emotions.set(label, [...(emotions.get(label) ?? []), row]);
      for (const tag of [...new Set(labelList(row.day_tags))]) tags.set(tag, [...(tags.get(tag) ?? []), row]);
      const g = String(row.grade ?? "Ungraded");
      grades.set(g, [...(grades.get(g) ?? []), row]);

      const hasMistake = [...labelList(row.mistakes), ...labelList(psych.mistakes)].length > 0;
      const followedPlan = psych.followedPlan ?? psych.followed_plan ?? psych.discipline;
      const brokeRules = followedPlan === false || hasMistake;
      (brokeRules ? undisciplined : disciplined).push(row);
    }

    const rank = (m: Map<string, any[]>) =>
      [...m.entries()]
        .map(([label, group]) => ({ label, ...bucketStats(group) }))
        .sort((a, b) => b.net_profit_loss - a.net_profit_loss);

    const sentiment = rows.filter((r) => Number.isFinite(Number(r.market_sentiment)));
    const sentimentBuckets = new Map<string, any[]>();
    for (const row of sentiment) {
      const v = Number(row.market_sentiment);
      const key = v >= 7 ? "high (7-10)" : v >= 4 ? "neutral (4-6)" : "low (0-3)";
      sentimentBuckets.set(key, [...(sentimentBuckets.get(key) ?? []), row]);
    }

    return ok({
      window: { from: start ?? null, to: to ?? null },
      executed_trades: rows.length,
      emotions: rank(emotions),
      best_emotional_states: rank(emotions).slice(0, 3),
      worst_emotional_states: rank(emotions).slice(-3).reverse(),
      day_tags: rank(tags),
      by_grade: rank(grades),
      market_sentiment: [...sentimentBuckets.entries()].map(([label, group]) => ({ label, ...bucketStats(group) })),
      discipline: {
        followed_plan: bucketStats(disciplined),
        broke_rules: bucketStats(undisciplined),
        discipline_rate_pct: rows.length ? round((disciplined.length / rows.length) * 100) : 0,
      },
    });
  },
});
