import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";

export const TRADE_WRITE_FIELDS = {
  date: z.string().describe("Trade date in YYYY-MM-DD."),
  asset: z.string().describe("Pair/asset symbol, e.g. XAUUSD."),
  direction: z.string().optional().describe("Long or Short."),
  market: z.string().optional().describe("Market, e.g. Forex, Crypto, Indices."),
  session: z.string().optional().describe("Session, e.g. London, New York."),
  setup: z.string().optional().describe("Setup name."),
  timeframe: z.string().optional().describe("Execution timeframe, e.g. 5m, 15m, 1H."),
  market_condition: z.string().optional().describe("Market condition, e.g. Trending, Ranging."),
  order_type: z.string().optional().describe("Order type, e.g. Market, Limit, Stop."),
  entry_time: z.string().optional().describe("Entry time, e.g. 09:35."),
  exit_time: z.string().optional().describe("Exit time, e.g. 11:05."),
  quantity: z.number().optional().describe("Position size / lots."),
  entry_price: z.number().optional().describe("Entry price."),
  stop_loss: z.number().optional().describe("Stop-loss price."),
  take_profit: z.number().optional().describe("Take-profit price."),
  exit_price: z.number().optional().describe("Exit price."),
  result: z.string().optional().describe("Win, Loss, Breakeven, Untriggered Setup or Cancelled."),
  status: z.string().optional().describe("Complete or Draft. Defaults to Complete."),
  planned_rr: z.number().optional().describe("Planned risk/reward."),
  actual_rr: z.number().optional().describe("Achieved risk/reward."),
  pips: z.number().optional().describe("Pips gained or lost."),
  profit_loss: z.number().optional().describe("Net P/L in account currency."),
  fees: z.number().optional().describe("Fees/commission."),
  grade: z.string().optional().describe("Execution grade: A+, A, B, C."),
  notes: z.string().optional().describe("Free-text notes about the trade."),
  chart_link: z.string().optional().describe("External chart link (e.g. TradingView)."),
  mistakes: z.array(z.string()).optional().describe("List of mistakes / rule violations."),
  confluences: z.array(z.string()).optional().describe("List of confluences supporting the trade."),
};

/** Strip undefined keys so partial updates never null out existing columns. */
export function compact(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export default defineTool({
  name: "create_trade",
  title: "Create a trade",
  description:
    "Log a new trade in the signed-in user's journal. Only `date` and `asset` are required; every other field is optional. Returns the created trade record including its generated id.",
  inputSchema: TRADE_WRITE_FIELDS,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { mistakes, confluences, ...rest } = input as Record<string, any>;
    const id =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `trade-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const payload = compact({
      ...rest,
      id,
      user_id: ctx.getUserId(),
      status: rest.status ?? "Complete",
      mistakes: mistakes ?? undefined,
      confluences: confluences ?? undefined,
    });

    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("trades").insert(payload).select().maybeSingle();
    if (error) return failure(error.message);
    return ok({ created: true, trade: data });
  },
});
