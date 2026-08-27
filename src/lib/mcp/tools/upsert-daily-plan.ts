import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { compact } from "./create-trade";

export default defineTool({
  name: "upsert_daily_plan",
  title: "Create or update a daily plan",
  description:
    "Create or update the signed-in user's daily plan for a date. Only the fields you pass are written; existing pair analyses and journal content are preserved unless explicitly replaced.",
  inputSchema: {
    date: z.string().describe("Plan date in YYYY-MM-DD."),
    daily_bias: z.string().optional().describe("Directional bias for the day, e.g. Bullish, Bearish, Neutral."),
    session_focus: z.string().optional().describe("Session the user intends to trade."),
    max_trades: z.number().int().min(0).max(50).optional().describe("Maximum number of trades allowed for the day."),
    risk_limit: z.string().optional().describe("Risk limit for the day, e.g. '1%'."),
    note: z.string().optional().describe("Free-text plan note."),
    result_narrative: z.string().optional().describe("End-of-day narrative of what actually happened."),
    took_trades: z.boolean().optional().describe("Whether the user traded that day."),
    reviewed: z.boolean().optional().describe("Mark the plan as reviewed."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { date, ...rest } = input as Record<string, any>;
    const patch = compact(rest);
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();

    const { data: existing, error: readError } = await sb
      .from("daily_plans")
      .select("id")
      .eq("user_id", uid)
      .eq("date", date)
      .maybeSingle();
    if (readError) return failure(readError.message);

    if (existing) {
      if (Object.keys(patch).length === 0) return failure("Provide at least one field to update.");
      const { data, error } = await sb
        .from("daily_plans")
        .update(patch)
        .eq("id", existing.id)
        .eq("user_id", uid)
        .select()
        .maybeSingle();
      if (error) return failure(error.message);
      return ok({ created: false, updated: true, fields: Object.keys(patch), plan: data });
    }

    const id =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `plan-${date}-${Math.random().toString(36).slice(2, 10)}`;
    const { data, error } = await sb
      .from("daily_plans")
      .insert({ id, user_id: uid, date, ...patch })
      .select()
      .maybeSingle();
    if (error) return failure(error.message);
    return ok({ created: true, updated: false, plan: data });
  },
});
