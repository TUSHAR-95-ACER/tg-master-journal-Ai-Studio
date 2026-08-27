import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { TRADE_WRITE_FIELDS, compact } from "./create-trade";

const { date, asset, ...optionalFields } = TRADE_WRITE_FIELDS;

export default defineTool({
  name: "update_trade",
  title: "Update a trade",
  description:
    "Update fields on an existing trade owned by the signed-in user. Only the fields you pass are changed; omitted fields keep their current values.",
  inputSchema: {
    id: z.string().min(1).describe("Id of the trade to update (from list_trades / search_trades)."),
    date: date.optional(),
    asset: asset.optional(),
    ...optionalFields,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { id, ...rest } = input as Record<string, any>;
    const patch = compact(rest);
    if (Object.keys(patch).length === 0) return failure("Provide at least one field to update.");

    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("trades")
      .update(patch)
      .eq("id", id)
      .eq("user_id", ctx.getUserId())
      .select()
      .maybeSingle();
    if (error) return failure(error.message);
    if (!data) return failure(`No trade found with id "${id}".`);
    return ok({ updated: true, fields: Object.keys(patch), trade: data });
  },
});
