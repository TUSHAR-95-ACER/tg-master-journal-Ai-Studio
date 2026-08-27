import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, round, supabaseForUser, unauthenticated } from "../lib/client";

interface Section { id?: string; title?: string; name?: string; items?: Array<{ id?: string; label?: string; text?: string; done?: boolean }> }

function progress(sections: Section[]) {
  const list = Array.isArray(sections) ? sections : [];
  const total = list.reduce((a, s) => a + (s.items?.length ?? 0), 0);
  const done = list.reduce((a, s) => a + (s.items ?? []).filter((i) => i.done).length, 0);
  return {
    total_items: total,
    completed_items: done,
    completion_pct: total ? round((done / total) * 100) : 0,
    sections_completed: list.filter((s) => (s.items?.length ?? 0) > 0 && (s.items ?? []).every((i) => i.done)).length,
    sections_total: list.length,
  };
}

function streak(rows: Array<{ date: string; sections: Section[] }>) {
  const perfect = new Set(rows.filter((r) => progress(r.sections).completion_pct === 100).map((r) => r.date));
  let current = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (perfect.has(key)) { current += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); continue; }
    // Allow today to be incomplete without breaking the streak.
    if (current === 0 && key === new Date().toISOString().slice(0, 10)) { cursor.setUTCDate(cursor.getUTCDate() - 1); continue; }
    break;
  }
  let best = 0; let run = 0; let prev: string | null = null;
  for (const day of [...perfect].sort()) {
    if (prev) {
      const gap = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`)) / 86400_000;
      run = gap === 1 ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { current_streak_days: current, longest_streak_days: best, perfect_days: perfect.size };
}

export default defineTool({
  name: "get_checklist",
  title: "Get trading checklist, progress and streak",
  description:
    "Fetch the signed-in user's daily trading checklist for a date (defaults to today) with per-section progress, plus recent history and completion streaks.",
  inputSchema: {
    date: z.string().optional().describe("Checklist date in YYYY-MM-DD. Defaults to today."),
    history_days: z.number().int().min(0).max(365).default(30).describe("How many days of history to include. Default 30, 0 to skip."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, history_days }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const target = date ?? new Date().toISOString().slice(0, 10);
    const days = history_days ?? 30;

    const { data: today, error } = await sb
      .from("trading_checklists")
      .select("date,sections,updated_at")
      .eq("user_id", uid)
      .eq("date", target)
      .maybeSingle();
    if (error) return failure(error.message);

    let history: any[] = [];
    if (days > 0) {
      const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
      const res = await sb
        .from("trading_checklists")
        .select("date,sections")
        .eq("user_id", uid)
        .gte("date", since)
        .order("date", { ascending: false });
      if (res.error) return failure(res.error.message);
      history = res.data ?? [];
    }

    return ok({
      date: target,
      checklist: today ?? null,
      progress: today ? progress((today.sections as Section[]) ?? []) : null,
      history: history.map((h) => ({ date: h.date, ...progress((h.sections as Section[]) ?? []) })),
      streaks: streak(history as any[]),
    });
  },
});
