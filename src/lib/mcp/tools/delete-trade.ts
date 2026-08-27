import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";

export default defineTool({
  name: "delete_trade",
  title: "Delete a trade",
  description:
    "Permanently delete one of the signed-in user's trades. Requires `confirm: true` so it can never happen by accident. Ask the user before calling this.",
  inputSchema: {
    id: z.string().min(1).describe("Id of the trade to delete."),
    confirm: z.boolean().describe("Must be true. Explicit confirmation that the trade should be deleted."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, confirm }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    if (!confirm) return failure("Deletion not confirmed. Call again with confirm: true after the user agrees.");

    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("trades")
      .delete()
      .eq("id", id)
      .eq("user_id", ctx.getUserId())
      .select("id,date,asset,result,profit_loss")
      .maybeSingle();
    if (error) return failure(error.message);
    if (!data) return failure(`No trade found with id "${id}".`);
    return ok({ deleted: true, trade: data });
  },
});
