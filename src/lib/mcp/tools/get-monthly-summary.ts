import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, isExecuted, num, ok, round, supabaseForUser, unauthenticated } from "../lib/client";
import { computeMetrics, equityCurve, groupPerformance } from "../lib/analytics";
import { labelList } from "../lib/text";

function monthBounds(month?: string) {
  const key = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [y, m] = key.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { month: key, from: `${key}-01`, to: end };
}

export default defineTool({
  name: "get_monthly_summary",
  title: "Get monthly trading summary",
  description:
    "Full synthesis of one calendar month for the signed-in user: metrics, equity curve, best/worst days, setup and session breakdowns, top mistakes, and plan/checklist adherence.",
  inputSchema: {
    month: z.string().optional().describe("Month in YYYY-MM. Defaults to the current month."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const { month: key, from, to } = monthBounds(month);

    const [tradesRes, plansRes, checklistRes] = await Promise.all([
      sb.from("trades")
        .select("id,date,asset,session,setup,grade,result,status,direction,profit_loss,actual_rr,planned_rr,mistakes,psychology,notes")
        .eq("user_id", uid).gte("date", from).lte("date", to).order("date", { ascending: true }),
      sb.from("daily_plans").select("date,reviewed,daily_bias,note").eq("user_id", uid).gte("date", from).lte("date", to),
      sb.from("trading_checklists").select("date,sections").eq("user_id", uid).gte("date", from).lte("date", to),
    ]);
    if (tradesRes.error) return failure(tradesRes.error.message);
    if (plansRes.error) return failure(plansRes.error.message);
    if (checklistRes.error) return failure(checklistRes.error.message);

    const rows = (tradesRes.data ?? []) as any[];
    const executed = rows.filter(isExecuted);

    const byDay = new Map<string, any[]>();
    for (const t of executed) byDay.set(String(t.date), [...(byDay.get(String(t.date)) ?? []), t]);
    const days = [...byDay.entries()]
      .map(([date, list]) => ({
        date,
        trades: list.length,
        net_profit_loss: round(list.reduce((s, r) => s + num(r.profit_loss), 0)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const sortedByPnl = [...days].sort((a, b) => b.net_profit_loss - a.net_profit_loss);

    const mistakeCounts = new Map<string, number>();
    for (const t of executed) {
      const psych = (t.psychology ?? {}) as Record<string, unknown>;
      for (const label of new Set([...labelList(t.mistakes), ...labelList(psych.mistakes)])) {
        mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
      }
    }

    let streakWin = 0, bestWinStreak = 0, streakLoss = 0, worstLossStreak = 0;
    for (const d of days) {
      if (d.net_profit_loss > 0) { streakWin += 1; streakLoss = 0; }
      else if (d.net_profit_loss < 0) { streakLoss += 1; streakWin = 0; }
      bestWinStreak = Math.max(bestWinStreak, streakWin);
      worstLossStreak = Math.max(worstLossStreak, streakLoss);
    }

    const checklists = (checklistRes.data ?? []) as any[];
    const checklistPct = checklists.map((c) => {
      const list = (Array.isArray(c.sections) ? c.sections : []) as any[];
      const total = list.reduce((a, s) => a + (s.items?.length ?? 0), 0);
      const done = list.reduce((a, s) => a + (s.items ?? []).filter((i: any) => i.done).length, 0);
      return total ? (done / total) * 100 : 0;
    });

    return ok({
      month: key,
      window: { from, to },
      metrics: computeMetrics(rows),
      equity: equityCurve(rows),
      trading_days: days.length,
      green_days: days.filter((d) => d.net_profit_loss > 0).length,
      red_days: days.filter((d) => d.net_profit_loss < 0).length,
      best_day: sortedByPnl[0] ?? null,
      worst_day: sortedByPnl[sortedByPnl.length - 1] ?? null,
      longest_green_streak_days: bestWinStreak,
      longest_red_streak_days: worstLossStreak,
      daily_pnl: days,
      by_setup: groupPerformance(rows, "setup"),
      by_session: groupPerformance(rows, "session"),
      by_asset: groupPerformance(rows, "asset"),
      top_mistakes: [...mistakeCounts.entries()]
        .map(([mistake, count]) => ({ mistake, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      routine: {
        plans_created: (plansRes.data ?? []).length,
        plans_reviewed: ((plansRes.data ?? []) as any[]).filter((p) => p.reviewed).length,
        checklist_days: checklists.length,
        checklist_average_pct: checklistPct.length
          ? round(checklistPct.reduce((a, b) => a + b, 0) / checklistPct.length)
          : 0,
      },
    });
  },
});
