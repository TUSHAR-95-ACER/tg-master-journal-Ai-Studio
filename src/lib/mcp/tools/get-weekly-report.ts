import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, isExecuted, num, ok, round, supabaseForUser, unauthenticated } from "../lib/client";
import { computeMetrics, groupPerformance, weekStart } from "../lib/analytics";
import { labelList } from "../lib/text";

export default defineTool({
  name: "get_weekly_report",
  title: "Get weekly trading report",
  description:
    "Synthesis of one trading week for the signed-in user: metrics, day-by-day P/L, setup/session breakdown, mistakes, plus the weekly plan (bias, goals, pair analyses) and its review status.",
  inputSchema: {
    week_start: z.string().optional().describe("Monday of the week in YYYY-MM-DD. Defaults to the current week."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ week_start }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const start = weekStart(week_start ?? new Date().toISOString().slice(0, 10));
    const end = new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 86400_000).toISOString().slice(0, 10);

    const [tradesRes, weeklyRes, plansRes, checklistRes] = await Promise.all([
      sb.from("trades")
        .select("id,date,asset,session,setup,grade,result,status,direction,profit_loss,actual_rr,planned_rr,mistakes,psychology,notes")
        .eq("user_id", uid).gte("date", start).lte("date", end).order("date", { ascending: true }),
      sb.from("weekly_plans").select("*").eq("user_id", uid).eq("week_start", start).maybeSingle(),
      sb.from("daily_plans").select("date,daily_bias,reviewed,note").eq("user_id", uid).gte("date", start).lte("date", end),
      sb.from("trading_checklists").select("date,sections").eq("user_id", uid).gte("date", start).lte("date", end),
    ]);
    if (tradesRes.error) return failure(tradesRes.error.message);
    if (plansRes.error) return failure(plansRes.error.message);
    if (checklistRes.error) return failure(checklistRes.error.message);

    const rows = (tradesRes.data ?? []) as any[];
    const executed = rows.filter(isExecuted);

    const byDay = new Map<string, any[]>();
    for (const t of executed) byDay.set(String(t.date), [...(byDay.get(String(t.date)) ?? []), t]);
    const days = [...Array(7)].map((_, i) => {
      const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400_000).toISOString().slice(0, 10);
      const list = byDay.get(date) ?? [];
      return {
        date,
        weekday: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i],
        trades: list.length,
        net_profit_loss: round(list.reduce((s, r) => s + num(r.profit_loss), 0)),
      };
    });

    const mistakeCounts = new Map<string, number>();
    for (const t of executed) {
      const psych = (t.psychology ?? {}) as Record<string, unknown>;
      for (const label of new Set([...labelList(t.mistakes), ...labelList(psych.mistakes)])) {
        mistakeCounts.set(label, (mistakeCounts.get(label) ?? 0) + 1);
      }
    }

    const checklists = (checklistRes.data ?? []) as any[];

    return ok({
      week_start: start,
      week_end: end,
      metrics: computeMetrics(rows),
      days,
      by_setup: groupPerformance(rows, "setup"),
      by_session: groupPerformance(rows, "session"),
      by_asset: groupPerformance(rows, "asset"),
      top_mistakes: [...mistakeCounts.entries()]
        .map(([mistake, count]) => ({ mistake, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      weekly_plan: weeklyRes.error ? null : (weeklyRes.data ?? null),
      daily_plans: plansRes.data ?? [],
      checklist_days: checklists.length,
      notable_trades: executed
        .slice()
        .sort((a, b) => Math.abs(num(b.profit_loss)) - Math.abs(num(a.profit_loss)))
        .slice(0, 5)
        .map((t) => ({
          id: t.id, date: t.date, asset: t.asset, setup: t.setup, result: t.result,
          profit_loss: round(num(t.profit_loss)), actual_rr: t.actual_rr, grade: t.grade,
        })),
    });
  },
});
