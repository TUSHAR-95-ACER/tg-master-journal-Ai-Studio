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
  name: "list_recent_trades",
  title: "List recent trades",
  description:
    "List the signed-in user's most recent trades from TG Master Journal, ordered by date. Returns core fields (asset, direction, session, setup, grade, planned/actual RR, P/L, result).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("Max trades to return (1-100). Default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("trades")
      .select(
        "id,date,asset,market,direction,session,setup,grade,planned_rr,actual_rr,profit_loss,result,status",
      )
      .eq("user_id", ctx.getUserId())
      .order("date", { ascending: false })
      .limit(limit ?? 20);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { trades: data ?? [] },
    };
  },
});
