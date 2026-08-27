import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";

export default defineTool({
  name: "get_weekly_plan",
  title: "Get weekly plan and review",
  description:
    "Fetch the signed-in user's weekly plan (bias, markets, setups, key levels, risk, goals, per-pair analyses, news and review notes) for a given week start date. Defaults to the most recent week.",
  inputSchema: {
    week_start: z.string().optional().describe("Week start date in YYYY-MM-DD. Omit for the latest week."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ week_start }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    let q = sb.from("weekly_plans").select("*").eq("user_id", ctx.getUserId());
    if (week_start) q = q.eq("week_start", week_start);
    const { data, error } = await q.order("week_start", { ascending: false }).limit(1);
    if (error) return failure(error.message);
    const plan = (data ?? [])[0] ?? null;
    if (!plan)
      return ok({ week_start: week_start ?? null, plan: null, note: "No weekly plan found." });
    return ok({ week_start: plan.week_start, plan });
  },
});
