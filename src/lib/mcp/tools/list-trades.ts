import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";

export const TRADE_LIST_FIELDS =
  "id,date,entry_time,exit_time,market,asset,direction,session,setup,grade,result,status,planned_rr,actual_rr,pips,profit_loss,market_condition,timeframe";

export default defineTool({
  name: "list_trades",
  title: "List and filter trades",
  description:
    "List the signed-in user's trades with optional filters (pair/asset, session, setup, grade, result, direction, market, date range) plus sorting and pagination. Returns core trade fields.",
  inputSchema: {
    asset: z.string().optional().describe("Filter by pair/asset symbol, e.g. XAUUSD."),
    session: z.string().optional().describe("Filter by session, e.g. London, New York."),
    setup: z.string().optional().describe("Filter by setup name."),
    grade: z.string().optional().describe("Filter by trade grade: A+, A, B, C."),
    result: z.string().optional().describe("Filter by result: Win, Loss, Breakeven, Untriggered Setup, Cancelled."),
    direction: z.string().optional().describe("Filter by direction: Long or Short."),
    market: z.string().optional().describe("Filter by market, e.g. Forex, Crypto, Indices."),
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    min_rr: z.number().optional().describe("Only trades whose actual RR is >= this value."),
    sort: z.string().optional().describe("Sort field: date, profit_loss, actual_rr, planned_rr. Default date."),
    order: z.string().optional().describe("Sort order: asc or desc. Default desc."),
    limit: z.number().int().min(1).max(200).default(50).describe("Page size (1-200). Default 50."),
    offset: z.number().int().min(0).default(0).describe("Rows to skip for pagination. Default 0."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const {
      asset, session, setup, grade, result, direction, market,
      from, to, min_rr, sort, order, limit, offset,
    } = input;
    const sortField = ["date", "profit_loss", "actual_rr", "planned_rr"].includes(String(sort))
      ? String(sort)
      : "date";
    const ascending = String(order ?? "desc").toLowerCase() === "asc";
    const take = limit ?? 50;
    const skip = offset ?? 0;

    const sb = supabaseForUser(ctx);
    let q = sb
      .from("trades")
      .select(TRADE_LIST_FIELDS, { count: "exact" })
      .eq("user_id", ctx.getUserId());

    if (asset) q = q.ilike("asset", asset);
    if (session) q = q.ilike("session", session);
    if (setup) q = q.ilike("setup", setup);
    if (grade) q = q.eq("grade", grade);
    if (result) q = q.ilike("result", result);
    if (direction) q = q.ilike("direction", direction);
    if (market) q = q.ilike("market", market);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    if (typeof min_rr === "number") q = q.gte("actual_rr", min_rr);

    const { data, error, count } = await q
      .order(sortField, { ascending })
      .range(skip, skip + take - 1);
    if (error) return failure(error.message);

    return ok({
      trades: data ?? [],
      pagination: {
        limit: take,
        offset: skip,
        returned: (data ?? []).length,
        total: count ?? null,
        has_more: count != null ? skip + (data ?? []).length < count : null,
      },
    });
  },
});
