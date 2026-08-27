import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { BUCKET, storagePath } from "../lib/media";

export default defineTool({
  name: "get_media_url",
  title: "Get a fresh signed media URL",
  description:
    "Mint short-lived signed URLs for the signed-in user's journal media (chart screenshots, attachments). Accepts storage paths or stale/expired journal-media URLs and returns currently valid links a client can open or fetch.",
  inputSchema: {
    paths: z
      .array(z.string().min(1))
      .min(1)
      .max(50)
      .describe("Storage paths or existing journal-media URLs (e.g. from list_media or a trade's prediction_image)."),
    expires_in: z
      .number()
      .int()
      .min(60)
      .max(86400)
      .default(3600)
      .describe("Signed URL lifetime in seconds (60-86400). Default 3600."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ paths, expires_in }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const ttl = expires_in ?? 3600;

    const resolved = paths.map((p) => ({ input: p, path: storagePath(p) }));
    const valid = resolved.filter((r) => r.path) as Array<{ input: string; path: string }>;
    if (valid.length === 0) return failure("None of the supplied values point at journal media.");

    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrls(valid.map((v) => v.path), ttl);
    if (error) return failure(error.message);

    const byPath = new Map((data ?? []).map((d: any) => [String(d.path), d]));
    return ok({
      expires_in: ttl,
      media: valid.map((v) => {
        const entry: any = byPath.get(v.path);
        return {
          input: v.input,
          path: v.path,
          signed_url: entry?.signedUrl ?? null,
          error: entry?.error ?? (entry?.signedUrl ? null : "Could not sign this path."),
        };
      }),
      skipped: resolved.filter((r) => !r.path).map((r) => r.input),
    });
  },
});
