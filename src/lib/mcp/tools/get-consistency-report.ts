import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, isExecuted, num, ok, round, supabaseForUser, unauthenticated } from "../lib/client";
import { labelList } from "../lib/text";

interface Section { items?: Array<{ done?: boolean }> }

function checklistPct(sections: unknown) {
  const list = (Array.isArray(sections) ? sections : []) as Section[];
  const total = list.reduce((a, s) => a + (s.items?.length ?? 0), 0);
  const done = list.reduce((a, s) => a + (s.items ?? []).filter((i) => i.done).length, 0);
  return total ? (done / total) * 100 : 0;
}

export default defineTool({
  name: "get_consistency_report",
  title: "Get consistency and discipline report",
  description:
    "Measure the signed-in user's process consistency: planning coverage (days planned vs traded), checklist completion, plan review rate, risk/size consistency, overtrading days and mistake-free rate.",
  inputSchema: {
    days: z.number().int().min(7).max(365).default(30).describe("Look-back window in days. Default 30."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const window = days ?? 30;
    const since = new Date(Date.now() - window * 86400_000).toISOString().slice(0, 10);

    const [tradesRes, plansRes, checklistRes] = await Promise.all([
      sb.from("trades")
        .select("id,date,result,status,profit_loss,quantity,actual_rr,planned_rr,mistakes,psychology,setup,grade")
        .eq("user_id", uid).gte("date", since),
      sb.from("daily_plans")
        .select("date,reviewed,max_trades,risk_limit,daily_bias,pair_count")
        .eq("user_id", uid).gte("date", since),
      sb.from("trading_checklists")
        .select("date,sections").eq("user_id", uid).gte("date", since),
    ]);
    if (tradesRes.error) return failure(tradesRes.error.message);
    if (plansRes.error) return failure(plansRes.error.message);
    if (checklistRes.error) return failure(checklistRes.error.message);

    const trades = ((tradesRes.data ?? []) as any[]).filter(isExecuted);
    const plans = (plansRes.data ?? []) as any[];
    const checklists = (checklistRes.data ?? []) as any[];

    const plannedDates = new Set(plans.map((p) => String(p.date)));
    const tradedDates = new Set(trades.map((t) => String(t.date)));
    const plannedAndTraded = [...tradedDates].filter((d) => plannedDates.has(d));

    const perDay = new Map<string, any[]>();
    for (const t of trades) perDay.set(String(t.date), [...(perDay.get(String(t.date)) ?? []), t]);
    const planLimit = new Map(plans.map((p) => [String(p.date), Number(p.max_trades) || null]));
    const overtradingDays = [...perDay.entries()]
      .filter(([date, list]) => (planLimit.get(date) ?? 2) < list.length)
      .map(([date, list]) => ({ date, trades: list.length, limit: planLimit.get(date) ?? 2 }));

    const sizes = trades.map((t) => num(t.quantity)).filter((v) => v > 0);
    const mean = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
    const variance = sizes.length ? sizes.reduce((a, b) => a + (b - mean) ** 2, 0) / sizes.length : 0;
    const stdev = Math.sqrt(variance);

    const cleanTrades = trades.filter((t) => {
      const psych = (t.psychology ?? {}) as Record<string, unknown>;
      return [...labelList(t.mistakes), ...labelList(psych.mistakes)].length === 0;
    });

    const checklistScores = checklists.map((c) => checklistPct(c.sections));
    const avgChecklist = checklistScores.length
      ? checklistScores.reduce((a, b) => a + b, 0) / checklistScores.length
      : 0;

    return ok({
      window: { days: window, from: since, to: new Date().toISOString().slice(0, 10) },
      planning: {
        days_planned: plannedDates.size,
        days_traded: tradedDates.size,
        traded_with_plan: plannedAndTraded.length,
        plan_coverage_pct: tradedDates.size ? round((plannedAndTraded.length / tradedDates.size) * 100) : 0,
        plans_reviewed: plans.filter((p) => p.reviewed).length,
        plan_review_rate_pct: plans.length ? round((plans.filter((p) => p.reviewed).length / plans.length) * 100) : 0,
      },
      checklist: {
        days_logged: checklists.length,
        logging_rate_pct: round((checklists.length / window) * 100),
        average_completion_pct: round(avgChecklist),
        perfect_days: checklistScores.filter((s) => s >= 99.9).length,
      },
      execution: {
        executed_trades: trades.length,
        trades_per_trading_day: tradedDates.size ? round(trades.length / tradedDates.size, 2) : 0,
        overtrading_days: overtradingDays.length,
        overtrading_detail: overtradingDays,
        mistake_free_trades: cleanTrades.length,
        mistake_free_rate_pct: trades.length ? round((cleanTrades.length / trades.length) * 100) : 0,
        graded_trades_pct: trades.length
          ? round((trades.filter((t) => t.grade).length / trades.length) * 100)
          : 0,
      },
      risk_consistency: {
        average_position_size: round(mean, 4),
        position_size_stdev: round(stdev, 4),
        size_variation_pct: mean ? round((stdev / mean) * 100) : 0,
        rr_discipline_pct: trades.length
          ? round((trades.filter((t) => Number(t.planned_rr) > 0).length / trades.length) * 100)
          : 0,
      },
      consistency_score: round(
        0.3 * (tradedDates.size ? (plannedAndTraded.length / tradedDates.size) * 100 : 0) +
        0.3 * avgChecklist +
        0.25 * (trades.length ? (cleanTrades.length / trades.length) * 100 : 0) +
        0.15 * Math.max(0, 100 - (mean ? (stdev / mean) * 100 : 0)),
      ),
    });
  },
});
