import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { weekStart } from "../lib/analytics";
import { compact } from "./create-trade";

export default defineTool({
  name: "upsert_weekly_plan",
  title: "Create or update a weekly plan",
  description:
    "Create or update the signed-in user's weekly plan. Only the fields you pass are written; pair analyses and news items are preserved unless explicitly replaced.",
  inputSchema: {
    week_start: z.string().optional().describe("Monday of the week in YYYY-MM-DD. Defaults to the current week."),
    bias: z.string().optional().describe("Weekly directional bias."),
    levels: z.string().optional().describe("Key levels to watch."),
    risk: z.string().optional().describe("Risk plan for the week."),
    goals: z.string().optional().describe("Goals for the week."),
    news_result: z.string().optional().describe("How the week's news events played out."),
    reviewed: z.boolean().optional().describe("Mark the weekly plan as reviewed."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { week_start, ...rest } = input as Record<string, any>;
    const start = weekStart(week_start ?? new Date().toISOString().slice(0, 10));
    const patch = compact(rest);
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();

    const { data: existing, error: readError } = await sb
      .from("weekly_plans")
      .select("id")
      .eq("user_id", uid)
      .eq("week_start", start)
      .maybeSingle();
    if (readError) return failure(readError.message);

    if (existing) {
      if (Object.keys(patch).length === 0) return failure("Provide at least one field to update.");
      const { data, error } = await sb
        .from("weekly_plans")
        .update(patch)
        .eq("id", existing.id)
        .eq("user_id", uid)
        .select()
        .maybeSingle();
      if (error) return failure(error.message);
      return ok({ week_start: start, created: false, updated: true, fields: Object.keys(patch), plan: data });
    }

    const id =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `weekly-${start}-${Math.random().toString(36).slice(2, 10)}`;
    const { data, error } = await sb
      .from("weekly_plans")
      .insert({ id, user_id: uid, week_start: start, ...patch })
      .select()
      .maybeSingle();
    if (error) return failure(error.message);
    return ok({ week_start: start, created: true, updated: false, plan: data });
  },
});
