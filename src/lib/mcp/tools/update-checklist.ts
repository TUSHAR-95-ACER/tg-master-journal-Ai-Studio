import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, round, supabaseForUser, unauthenticated } from "../lib/client";

interface Item { id?: string; label?: string; text?: string; title?: string; done?: boolean }
interface Section { id?: string; title?: string; name?: string; items?: Item[] }

const itemLabel = (i: Item) => String(i.label ?? i.text ?? i.title ?? "");
const sectionLabel = (s: Section) => String(s.title ?? s.name ?? "");

export default defineTool({
  name: "update_checklist",
  title: "Tick or untick checklist items",
  description:
    "Mark items on the signed-in user's daily trading checklist as done or not done. Match items by id or by (case-insensitive) label text. Use get_checklist first to see the available items.",
  inputSchema: {
    date: z.string().optional().describe("Checklist date in YYYY-MM-DD. Defaults to today."),
    items: z
      .array(
        z.object({
          match: z.string().min(1).describe("Item id or label text to match."),
          done: z.boolean().describe("New completion state for the item."),
          section: z.string().optional().describe("Optional section id or title to disambiguate."),
        }),
      )
      .min(1)
      .describe("Items to update."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, items }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const day = date ?? new Date().toISOString().slice(0, 10);

    const { data: row, error } = await sb
      .from("trading_checklists")
      .select("id,date,sections")
      .eq("user_id", uid)
      .eq("date", day)
      .maybeSingle();
    if (error) return failure(error.message);
    if (!row) return failure(`No checklist exists for ${day}. Open the Trading Checklist page for that day first.`);

    const sections = (Array.isArray(row.sections) ? row.sections : []) as Section[];
    const applied: Array<{ match: string; item: string; section: string; done: boolean }> = [];
    const missed: string[] = [];

    for (const req of items) {
      const needle = req.match.trim().toLowerCase();
      const scope = req.section
        ? sections.filter(
            (s) =>
              String(s.id ?? "").toLowerCase() === req.section!.trim().toLowerCase() ||
              sectionLabel(s).toLowerCase() === req.section!.trim().toLowerCase(),
          )
        : sections;
      let hit = false;
      for (const section of scope) {
        for (const item of section.items ?? []) {
          const matches =
            String(item.id ?? "").toLowerCase() === needle ||
            itemLabel(item).toLowerCase() === needle ||
            itemLabel(item).toLowerCase().includes(needle);
          if (!matches) continue;
          item.done = req.done;
          hit = true;
          applied.push({ match: req.match, item: itemLabel(item), section: sectionLabel(section), done: req.done });
          break;
        }
        if (hit) break;
      }
      if (!hit) missed.push(req.match);
    }

    if (applied.length === 0) return failure(`No checklist items matched: ${missed.join(", ")}.`);

    const { data: saved, error: saveError } = await sb
      .from("trading_checklists")
      .update({ sections })
      .eq("id", row.id)
      .eq("user_id", uid)
      .select("date,sections")
      .maybeSingle();
    if (saveError) return failure(saveError.message);

    const list = (Array.isArray(saved?.sections) ? saved!.sections : []) as Section[];
    const total = list.reduce((a, s) => a + (s.items?.length ?? 0), 0);
    const done = list.reduce((a, s) => a + (s.items ?? []).filter((i) => i.done).length, 0);

    return ok({
      date: day,
      updated: applied,
      unmatched: missed,
      progress: {
        total_items: total,
        completed_items: done,
        completion_pct: total ? round((done / total) * 100) : 0,
      },
    });
  },
});
