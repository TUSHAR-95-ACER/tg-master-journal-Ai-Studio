import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { TRADE_LIST_FIELDS } from "./list-trades";

export default defineTool({
  name: "search_trades",
  title: "Search trades by text",
  description:
    "Free-text search across the signed-in user's trades. Matches notes, setup, asset, session and grade. Use for questions like 'losing XAUUSD trades' or 'trades where I mention FOMO'.",
  inputSchema: {
    query: z.string().describe("Text to search for in notes, setup, asset or session."),
    limit: z.number().int().min(1).max(100).default(25).describe("Max rows to return. Default 25."),
    offset: z.number().int().min(0).default(0).describe("Rows to skip for pagination."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit, offset }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const take = limit ?? 25;
    const skip = offset ?? 0;
    // Escape PostgREST `or` filter separators.
    const term = String(query).replace(/[,()]/g, " ").trim();
    if (!term) return failure("Query must not be empty.");
    const pattern = `%${term}%`;
    const sb = supabaseForUser(ctx);
    const { data, error, count } = await sb
      .from("trades")
      .select(`${TRADE_LIST_FIELDS},notes`, { count: "exact" })
      .eq("user_id", ctx.getUserId())
      .or(
        [
          `notes.ilike.${pattern}`,
          `setup.ilike.${pattern}`,
          `asset.ilike.${pattern}`,
          `session.ilike.${pattern}`,
          `grade.ilike.${pattern}`,
        ].join(","),
      )
      .order("date", { ascending: false })
      .range(skip, skip + take - 1);
    if (error) return failure(error.message);
    return ok({
      query: term,
      matches: data ?? [],
      pagination: { limit: take, offset: skip, returned: (data ?? []).length, total: count ?? null },
    });
  },
});
