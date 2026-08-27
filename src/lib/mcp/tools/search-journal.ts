import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failure, ok, supabaseForUser, unauthenticated } from "../lib/client";
import { countOccurrences, flattenText, snippet } from "../lib/text";

const SOURCES = ["trades", "notebook", "daily_plans", "weekly_plans"] as const;

export default defineTool({
  name: "search_journal",
  title: "Search the whole journal",
  description:
    "Free-text search across everything the signed-in user has written: trade notes and analysis, notebook entries, daily plans and weekly plans. Returns ranked results with snippets showing where the term matched.",
  inputSchema: {
    query: z.string().min(1).describe("Text to search for, e.g. 'liquidity sweep' or 'revenge trade'."),
    sources: z.string().optional().describe("Comma-separated subset of: trades, notebook, daily_plans, weekly_plans. Defaults to all."),
    from: z.string().optional().describe("Start date (inclusive) in YYYY-MM-DD."),
    to: z.string().optional().describe("End date (inclusive) in YYYY-MM-DD."),
    limit: z.number().int().min(1).max(50).default(20).describe("Max results to return. Default 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, sources, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const term = String(query ?? "").trim();
    if (!term) return failure("Query must not be empty.");
    const wanted = new Set(
      (sources ? String(sources).split(",").map((s) => s.trim()) : [...SOURCES]).filter((s) =>
        (SOURCES as readonly string[]).includes(s),
      ),
    );
    if (wanted.size === 0) for (const s of SOURCES) wanted.add(s);

    const sb = supabaseForUser(ctx);
    const uid = ctx.getUserId();
    const scope = <T extends { gte: any; lte: any }>(q: T, column: string) => {
      let out: any = q;
      if (from) out = out.gte(column, from);
      if (to) out = out.lte(column, to);
      return out;
    };

    const results: any[] = [];

    if (wanted.has("trades")) {
      const { data, error } = await scope(
        sb.from("trades")
          .select("id,date,asset,setup,session,result,grade,profit_loss,notes,psychology,trade_analysis,confluences,mistakes,trade_journey")
          .eq("user_id", uid) as any,
        "date",
      ).order("date", { ascending: false }).limit(1000);
      if (error) return failure(error.message);
      for (const row of (data ?? []) as any[]) {
        const text = [row.notes, flattenText(row.psychology), flattenText(row.trade_analysis), flattenText(row.confluences), flattenText(row.mistakes), flattenText(row.trade_journey)].join(" ");
        const hits = countOccurrences(text, term);
        if (hits) results.push({
          source: "trade", id: row.id, date: row.date,
          title: `${row.asset ?? "Trade"} · ${row.setup ?? "—"} · ${row.result ?? ""}`.trim(),
          matches: hits, snippet: snippet(text, term),
          meta: { asset: row.asset, session: row.session, grade: row.grade, profit_loss: row.profit_loss },
        });
      }
    }

    if (wanted.has("notebook")) {
      const { data, error } = await scope(
        sb.from("notebook_entries")
          .select("id,entry_id,date,pair,category,bias,journal,legacy_notes,legacy_key_levels")
          .eq("user_id", uid) as any,
        "date",
      ).order("date", { ascending: false }).limit(1000);
      if (error) return failure(error.message);
      for (const row of (data ?? []) as any[]) {
        const text = [flattenText(row.journal), row.legacy_notes, row.legacy_key_levels, row.pair, row.category, row.bias].join(" ");
        const hits = countOccurrences(text, term);
        if (hits) results.push({
          source: "notebook", id: row.id, date: row.date,
          title: `${row.pair ?? "Note"} · ${row.category ?? ""}`.trim(),
          matches: hits, snippet: snippet(text, term),
          meta: { pair: row.pair, category: row.category, bias: row.bias },
        });
      }
    }

    if (wanted.has("daily_plans")) {
      const { data, error } = await scope(
        sb.from("daily_plans")
          .select("id,date,daily_bias,session_focus,note,result_narrative,pairs,notes_journal,day_summary,reviewed")
          .eq("user_id", uid) as any,
        "date",
      ).order("date", { ascending: false }).limit(1000);
      if (error) return failure(error.message);
      for (const row of (data ?? []) as any[]) {
        const text = [row.daily_bias, row.session_focus, row.note, row.result_narrative, flattenText(row.pairs), flattenText(row.notes_journal), flattenText(row.day_summary)].join(" ");
        const hits = countOccurrences(text, term);
        if (hits) results.push({
          source: "daily_plan", id: row.id, date: row.date,
          title: `Daily plan ${row.date}`,
          matches: hits, snippet: snippet(text, term),
          meta: { bias: row.daily_bias, reviewed: row.reviewed },
        });
      }
    }

    if (wanted.has("weekly_plans")) {
      const { data, error } = await scope(
        sb.from("weekly_plans")
          .select("id,week_start,bias,levels,risk,goals,pair_analyses,news_result,observation,reviewed")
          .eq("user_id", uid) as any,
        "week_start",
      ).order("week_start", { ascending: false }).limit(500);
      if (error) return failure(error.message);
      for (const row of (data ?? []) as any[]) {
        const text = [row.bias, row.levels, row.risk, row.goals, row.news_result, flattenText(row.pair_analyses), flattenText(row.observation)].join(" ");
        const hits = countOccurrences(text, term);
        if (hits) results.push({
          source: "weekly_plan", id: row.id, date: row.week_start,
          title: `Weekly plan ${row.week_start}`,
          matches: hits, snippet: snippet(text, term),
          meta: { bias: row.bias, reviewed: row.reviewed },
        });
      }
    }

    results.sort((a, b) => b.matches - a.matches || String(b.date).localeCompare(String(a.date)));
    const take = limit ?? 20;

    return ok({
      query: term,
      sources: [...wanted],
      total_matches: results.length,
      returned: Math.min(take, results.length),
      results: results.slice(0, take),
    });
  },
});
