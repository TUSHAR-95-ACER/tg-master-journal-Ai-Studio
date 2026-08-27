import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";

export default defineTool({
  name: "search_notebook",
  title: "Search and list notebook entries",
  description:
    "List or free-text search the signed-in user's notebook/journal entries (pair, category, bias, journal text). Use for questions like 'notes about liquidity' or 'entries mentioning FOMO'.",
  inputSchema: {
    query: z.string().optional().describe("Text to match in journal text, pair, category or bias. Omit to list all."),
    pair: z.string().optional().describe("Filter by pair, e.g. XAUUSD."),
    category: z.string().optional().describe("Filter by notebook category."),
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    limit: z.number().int().min(1).max(100).default(25).describe("Page size. Default 25."),
    offset: z.number().int().min(0).default(0).describe("Rows to skip for pagination."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, pair, category, from, to, limit, offset }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const take = limit ?? 25;
    const skip = offset ?? 0;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("notebook_entries")
      .select("id,entry_id,date,pair,category,bias,journal,legacy_notes,legacy_key_levels,updated_at", { count: "exact" })
      .eq("user_id", ctx.getUserId());
    if (pair) q = q.ilike("pair", pair);
    if (category) q = q.ilike("category", category);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    if (query) {
      const term = String(query).replace(/[,()]/g, " ").trim();
      if (term) {
        const p = `%${term}%`;
        q = q.or([`pair.ilike.${p}`, `category.ilike.${p}`, `bias.ilike.${p}`, `legacy_notes.ilike.${p}`].join(","));
      }
    }
    const { data, error, count } = await q.order("date", { ascending: false }).range(skip, skip + take - 1);
    if (error) return failure(error.message);

    // Journal bodies live in JSONB, so text matching happens after fetch.
    const term = (query ?? "").trim().toLowerCase();
    const rows = term
      ? (data ?? []).filter((r: any) =>
          JSON.stringify(r.journal ?? {}).toLowerCase().includes(term) ||
          String(r.legacy_notes ?? "").toLowerCase().includes(term) ||
          String(r.pair ?? "").toLowerCase().includes(term) ||
          String(r.category ?? "").toLowerCase().includes(term))
      : data ?? [];

    return ok({
      query: query ?? null,
      entries: rows,
      pagination: { limit: take, offset: skip, returned: rows.length, total: count ?? null },
    });
  },
});
