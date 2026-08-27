import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";

export default defineTool({
  name: "create_notebook_entry",
  title: "Create or update a notebook entry",
  description:
    "Write a journal / notebook entry for the signed-in user (analysis, reflection, lessons). Pass `entry_id` of an existing entry to update it instead of creating a new one.",
  inputSchema: {
    text: z.string().min(1).describe("The journal text to store."),
    date: z.string().optional().describe("Entry date in YYYY-MM-DD. Defaults to today."),
    pair: z.string().optional().describe("Related pair/asset, e.g. XAUUSD."),
    category: z.string().optional().describe("Notebook category, e.g. Analysis, Lesson, Review."),
    bias: z.string().optional().describe("Directional bias for the note."),
    entry_id: z.string().optional().describe("Existing entry_id to update instead of creating a new entry."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ text, date, pair, category, bias, entry_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const day = date ?? new Date().toISOString().slice(0, 10);
    // The app stores rich journal content as { text, media[] } (RichJournalValue).
    const journal = { text: String(text), media: [] as unknown[] };

    if (entry_id) {
      const { data, error } = await sb
        .from("notebook_entries")
        .update({
          journal,
          ...(date ? { date: day } : {}),
          ...(pair ? { pair } : {}),
          ...(category ? { category } : {}),
          ...(bias ? { bias } : {}),
        })
        .eq("entry_id", entry_id)
        .eq("user_id", uid)
        .select()
        .maybeSingle();
      if (error) return failure(error.message);
      if (!data) return failure(`No notebook entry found with entry_id "${entry_id}".`);
      return ok({ created: false, updated: true, entry: data });
    }

    const newId =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    // pair / category / bias are NOT NULL with '' defaults — never send null.
    const { data, error } = await sb
      .from("notebook_entries")
      .insert({
        user_id: uid,
        entry_id: newId,
        date: day,
        pair: pair ?? "",
        category: category ?? "",
        bias: bias ?? "",
        journal,
      })
      .select()
      .maybeSingle();
    if (error) return failure(error.message);
    return ok({ created: true, updated: false, entry: data });
  },

});
