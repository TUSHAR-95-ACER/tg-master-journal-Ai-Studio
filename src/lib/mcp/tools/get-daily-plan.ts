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
  name: "get_daily_plan",
  title: "Get daily trading plan",
  description:
    "Fetch the signed-in user's daily trading plan for a specific date (YYYY-MM-DD). Defaults to today when no date is supplied.",
  inputSchema: {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      .describe("Plan date in YYYY-MM-DD. Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const target = date ?? new Date().toISOString().slice(0, 10);
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("daily_plans")
      .select("*")
      .eq("user_id", ctx.getUserId())
      .eq("date", target)
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return {
        content: [{ type: "text", text: `No daily plan found for ${target}.` }],
        structuredContent: { date: target, plan: null },
      };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { date: target, plan: data },
    };
  },
});
