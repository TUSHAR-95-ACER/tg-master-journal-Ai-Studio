import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Per-request Supabase client that forwards the caller's verified OAuth token,
 * so RLS runs as the signed-in user. Never uses a service-role key.
 */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function unauthenticated() {
  return {
    content: [{ type: "text" as const, text: "Not authenticated. Sign in to TG Master Journal first." }],
    isError: true,
  };
}

export function failure(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function ok(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

/** Normalized result buckets — stored values are capitalized ("Win", "Loss"). */
export const isWin = (r: unknown) => String(r ?? "").toLowerCase() === "win";
export const isLoss = (r: unknown) => String(r ?? "").toLowerCase() === "loss";
export const isBreakeven = (r: unknown) => String(r ?? "").toLowerCase() === "breakeven";
/** Trades that actually executed (exclude untriggered/cancelled and non-complete rows). */
export const isExecuted = (row: { result?: unknown; status?: unknown }) =>
  (isWin(row.result) || isLoss(row.result) || isBreakeven(row.result)) &&
  String(row.status ?? "Complete").toLowerCase() !== "draft";

export const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const round = (v: number, d = 2) => +v.toFixed(d);
