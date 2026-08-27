import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { BUCKET, collectPaths, storagePath } from "../lib/media";

export default defineTool({
  name: "list_media",
  title: "List journal media attachments",
  description:
    "List the media (chart screenshots and attachments) referenced by the signed-in user's trades, daily plans and notebook entries, optionally within a date range or for one trade. Set `sign: true` to also return short-lived signed URLs.",
  inputSchema: {
    trade_id: z.string().optional().describe("Only media attached to this trade."),
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    sources: z.string().optional().describe("Comma-separated subset of: trades, notebook, daily_plans. Defaults to all."),
    sign: z.boolean().default(false).describe("Also mint signed URLs for each item. Default false."),
    expires_in: z.number().int().min(60).max(86400).default(3600).describe("Signed URL lifetime in seconds when sign is true."),
    limit: z.number().int().min(1).max(100).default(50).describe("Max media items to return. Default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ trade_id, from, to, sources, sign, expires_in, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const wanted = new Set(
      (sources ? String(sources).split(",").map((s) => s.trim()) : ["trades", "notebook", "daily_plans"]).filter((s) =>
        ["trades", "notebook", "daily_plans"].includes(s),
      ),
    );
    if (wanted.size === 0) for (const s of ["trades", "notebook", "daily_plans"]) wanted.add(s);

    const items: Array<{ source: string; id: string; date: string | null; field: string; path: string }> = [];

    if (wanted.has("trades")) {
      let q = sb
        .from("trades")
        .select("id,date,asset,prediction_image,execution_image,trade_journey,trade_analysis")
        .eq("user_id", uid);
      if (trade_id) q = q.eq("id", trade_id);
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const { data, error } = await q.order("date", { ascending: false }).limit(500);
      if (error) return failure(error.message);
      for (const row of (data ?? []) as any[]) {
        for (const field of ["prediction_image", "execution_image"]) {
          const p = storagePath(row[field]);
          if (p) items.push({ source: "trade", id: row.id, date: row.date, field, path: p });
        }
        for (const p of collectPaths([row.trade_journey, row.trade_analysis])) {
          items.push({ source: "trade", id: row.id, date: row.date, field: "journey", path: p });
        }
      }
    }

    if (!trade_id && wanted.has("notebook")) {
      let q = sb.from("notebook_entries").select("id,entry_id,date,pair,journal,legacy_image").eq("user_id", uid);
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const { data, error } = await q.order("date", { ascending: false }).limit(500);
      if (error) return failure(error.message);
      for (const row of (data ?? []) as any[]) {
        const p = storagePath(row.legacy_image);
        if (p) items.push({ source: "notebook", id: row.entry_id ?? row.id, date: row.date, field: "legacy_image", path: p });
        for (const path of collectPaths(row.journal)) {
          items.push({ source: "notebook", id: row.entry_id ?? row.id, date: row.date, field: "journal", path });
        }
      }
    }

    if (!trade_id && wanted.has("daily_plans")) {
      let q = sb.from("daily_plans").select("id,date,result_chart_image,pairs,notes_journal,review_video").eq("user_id", uid);
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const { data, error } = await q.order("date", { ascending: false }).limit(500);
      if (error) return failure(error.message);
      for (const row of (data ?? []) as any[]) {
        const p = storagePath(row.result_chart_image);
        if (p) items.push({ source: "daily_plan", id: row.id, date: row.date, field: "result_chart_image", path: p });
        for (const path of collectPaths([row.pairs, row.notes_journal, row.review_video])) {
          items.push({ source: "daily_plan", id: row.id, date: row.date, field: "content", path });
        }
      }
    }

    const seen = new Set<string>();
    const unique = items.filter((i) => (seen.has(i.path) ? false : (seen.add(i.path), true)));
    const take = limit ?? 50;
    const page = unique.slice(0, take);

    let signed = new Map<string, string>();
    if (sign && page.length) {
      const { data, error } = await sb.storage
        .from(BUCKET)
        .createSignedUrls(page.map((i) => i.path), expires_in ?? 3600);
      if (error) return failure(error.message);
      signed = new Map((data ?? []).filter((d: any) => d.signedUrl).map((d: any) => [String(d.path), d.signedUrl]));
    }

    return ok({
      total_found: unique.length,
      returned: page.length,
      signed: !!sign,
      expires_in: sign ? (expires_in ?? 3600) : null,
      media: page.map((i) => ({ ...i, signed_url: signed.get(i.path) ?? null })),
    });
  },
});
