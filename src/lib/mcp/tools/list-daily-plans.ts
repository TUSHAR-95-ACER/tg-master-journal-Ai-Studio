import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";

export default defineTool({
  name: "list_daily_plans",
  title: "List daily plans",
  description:
    "List the signed-in user's daily plans with bias, session focus, risk limits, review status and pair count. Use `get_daily_plan` for the full detail of one day.",
  inputSchema: {
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    reviewed: z.boolean().optional().describe("Filter by whether the plan has been reviewed."),
    limit: z.number().int().min(1).max(100).default(20).describe("Page size. Default 20."),
    offset: z.number().int().min(0).default(0).describe("Rows to skip for pagination."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, reviewed, limit, offset }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const take = limit ?? 20;
    const skip = offset ?? 0;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("daily_plans")
      .select("id,date,daily_bias,session_focus,max_trades,risk_limit,pair_count,took_trades,reviewed,updated_at", {
        count: "exact",
      })
      .eq("user_id", ctx.getUserId());
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    if (typeof reviewed === "boolean") q = q.eq("reviewed", reviewed);
    const { data, error, count } = await q.order("date", { ascending: false }).range(skip, skip + take - 1);
    if (error) return failure(error.message);
    return ok({
      plans: data ?? [],
      pagination: { limit: take, offset: skip, returned: (data ?? []).length, total: count ?? null },
    });
  },
});
