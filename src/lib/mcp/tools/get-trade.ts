import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { BUCKET, collectPaths, storagePath } from "../lib/media";

export default defineTool({
  name: "get_trade",
  title: "Get a trade by ID",
  description:
    "Fetch one full trade record (including notes, confluences, psychology, management and analysis) by its ID, scoped to the signed-in user. Any chart screenshots are returned as freshly signed, currently valid URLs in `media` (and the image fields are refreshed in place), because the URLs stored on the row expire.",
  inputSchema: {
    id: z.string().describe("The trade ID."),
    expires_in: z
      .number()
      .int()
      .min(60)
      .max(86400)
      .default(3600)
      .describe("Lifetime in seconds for the freshly signed media URLs (60-86400). Default 3600."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, expires_in }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("trades")
      .select("*")
      .eq("user_id", ctx.getUserId())
      .eq("id", id)
      .maybeSingle();
    if (error) return failure(error.message);
    if (!data) return failure(`No trade found with id "${id}".`);

    const trade = data as Record<string, any>;
    const ttl = expires_in ?? 3600;

    // Collect every journal-media path referenced anywhere on the row.
    const paths = Array.from(collectPaths(trade));
    let signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await sb.storage.from(BUCKET).createSignedUrls(paths, ttl);
      signed = new Map(
        (urls ?? []).filter((u: any) => u?.signedUrl).map((u: any) => [String(u.path), u.signedUrl as string]),
      );
    }

    // Refresh the primary image fields in place so clients never open a stale link.
    for (const field of ["prediction_image", "execution_image"]) {
      const p = storagePath(trade[field]);
      const fresh = p ? signed.get(p) : null;
      if (fresh) trade[field] = fresh;
    }

    return ok({
      trade,
      media: paths.map((p) => ({ path: p, signed_url: signed.get(p) ?? null })),
      media_expires_in: ttl,
    });
  },
});
