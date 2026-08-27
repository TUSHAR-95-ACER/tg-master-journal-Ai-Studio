// Auto-generate a complete Weekly Review from the week's Daily Plans + Trades + Weekly Plan.
// Returns structured JSON consumed by the Weekly Review page.
//
// Reads EVERYTHING for the requested week:
//  - All Daily Plans (Mon–Fri): bias, pairs, narratives, prediction notes, result notes,
//    bias comparison, market narrative, psychology, emotional notes, day summary, mistakes, wins,
//    macro notes, checklist, chart notes.
//  - The Weekly Plan: bias, goals, risk, levels, pair analyses, observation, calendar result.
//  - All Trades executed during the week: pair, dir, setup, grade, result, RR, PnL, session,
//    mistakes, psychology, notes/reasons, chart notes.
//
// The AI is instructed to find recurring themes across days (e.g. "impatience appeared on
// Monday AND Thursday → premature exits remain the biggest leak").
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { aiChat, aiErrorResponse } from "../_shared/lovable-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmt(d: string) { try { return new Date(d).toISOString().split("T")[0]; } catch { return d; } }
function safe(v: any) { if (v == null) return v; if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } }
function stripHtml(s: any): string {
  if (!s) return "";
  const str = typeof s === "string" ? s : (s?.text || s?.html || JSON.stringify(s));
  return String(str).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { weekStart } = await req.json();
    if (!weekStart) {
      return new Response(JSON.stringify({ error: "weekStart required (YYYY-MM-DD)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const start = new Date(weekStart);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const startStr = fmt(start.toISOString()); const endStr = fmt(end.toISOString());

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: dailyPlans }, { data: trades }, { data: weeklyPlan }] = await Promise.all([
      supabase.from("daily_plans").select("*").eq("user_id", userId).gte("date", startStr).lte("date", endStr).order("date"),
      supabase.from("trades").select("*").eq("user_id", userId).gte("date", startStr).lte("date", endStr).order("date"),
      supabase.from("weekly_plans").select("*").eq("user_id", userId).eq("week_start", startStr).maybeSingle(),
    ]);

    // Distill each daily plan to a compact, AI-friendly object that contains
    // every field the user listed (prediction notes, result notes, psych, etc.).
    const days = (dailyPlans || []).map((p: any) => {
      const pairs = safe(p.pairs) || [];
      const checklist = safe(p.checklist) || {};
      const psych = safe(p.psychology) || {};
      const summary = safe(p.day_summary);
      const notes = safe(p.notes_journal);
      const macro = safe(p.macro_notes);
      return {
        date: p.date,
        daily_bias: p.daily_bias,
        session_focus: p.session_focus,
        max_trades: p.max_trades,
        risk_limit: p.risk_limit,
        took_trades: p.took_trades,
        pairs: (Array.isArray(pairs) ? pairs : []).map((x: any) => ({
          pair: x.pair,
          predicted_bias: x.bias,
          actual_bias: x.actualBias || x.actualDirection || null,
          predicted_narrative: stripHtml(x.narrative).slice(0, 400),
          result_narrative: stripHtml(x.resultNarrative || x.actualNarrative).slice(0, 400),
          prediction_chart_note: stripHtml(x.predictionChartNote || x.predictionNote).slice(0, 300),
          result_chart_note: stripHtml(x.resultChartNote || x.resultNote).slice(0, 300),
        })),
        day_summary: stripHtml(summary).slice(0, 1200),
        notes: stripHtml(notes || p.note).slice(0, 1200),
        result_narrative: stripHtml(p.result_narrative).slice(0, 1200),
        macro_notes: stripHtml(macro).slice(0, 800),
        psychology: {
          emotion: psych?.emotion || null,
          discipline: psych?.discipline ?? null,
          notes: stripHtml(psych?.notes).slice(0, 600),
          checklist: psych?.checklist || null,
        },
        wins: Array.isArray(p.wins) ? p.wins : (safe(p.wins) || []),
        mistakes: Array.isArray(p.mistakes) ? p.mistakes : (safe(p.mistakes) || []),
        checklist,
      };
    });

    const tradesLite = (trades || []).map((t: any) => {
      const psy = safe(t.psychology) || {};
      return {
        date: t.date, pair: t.asset, dir: t.direction, setup: t.setup, grade: t.grade,
        result: t.result, pnl: t.profit_loss, rr: t.actual_rr, planned_rr: t.planned_rr,
        session: t.session,
        mistakes: safe(t.mistakes) || [],
        reasons: safe(t.reasons) || [],
        notes: stripHtml(t.notes).slice(0, 800),
        chart_notes: stripHtml(t.chart_notes || t.trade_log_note).slice(0, 600),
        psychology: { emotion: psy?.emotion, discipline: psy?.discipline, notes: stripHtml(psy?.notes).slice(0, 400) },
      };
    });

    const wp = weeklyPlan ? {
      bias: weeklyPlan.bias,
      goals: stripHtml(weeklyPlan.goals).slice(0, 600),
      risk: stripHtml(weeklyPlan.risk).slice(0, 400),
      levels: stripHtml(weeklyPlan.levels).slice(0, 600),
      pairs: (safe(weeklyPlan.pair_analyses) || []).map((x: any) => ({
        pair: x.pair, predicted: x.bias, actual: x.actualBias || x.actualDirection || null,
        narrative: stripHtml(x.narrative).slice(0, 400),
        result: stripHtml(x.actualNarrative || x.resultNarrative).slice(0, 400),
      })),
      observation: stripHtml(safe(weeklyPlan.observation)).slice(0, 800),
      calendar_result: stripHtml(safe(weeklyPlan.calendar_result)).slice(0, 800),
    } : null;

    const wins = tradesLite.filter(t => t.result === "Win").length;
    const losses = tradesLite.filter(t => t.result === "Loss").length;
    const pnl = tradesLite.reduce((s: number, t: any) => s + (Number(t.pnl) || 0), 0);

    // If there's literally NOTHING for the week, return a clear empty result so
    // the UI can render an honest "no data" review rather than fabrications.
    if (days.length === 0 && tradesLite.length === 0 && !wp) {
      return new Response(JSON.stringify({
        weeklyNarrative: "No daily plans, trades, or weekly plan were recorded for this week — there is nothing to review.",
        reflection: "Not enough data this week to reflect on execution.",
        lessons: "Not enough data this week to extract lessons.",
        mistakes: "Not enough data this week to identify mistakes.",
        improvements: "Begin by logging at least a daily plan for each session and any trades you take.",
        aiReview: "This week has no journal entries to review.",
        meta: { weekStart: startStr, weekEnd: endStr, trades: 0, wins: 0, losses: 0, pnl: 0 },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sys = `You are a senior institutional trading coach writing a CONCISE WEEKLY REVIEW for a trader's journal.

You receive EVERYTHING the trader recorded for the week (Weekly Plan, all Daily Plans Mon–Fri including prediction & result notes, market narrative, psychology, emotional notes, day summary, macro notes, wins, mistakes, checklist, prediction/result chart notes, and all Trades with setup/grade/result/RR/PnL/session/mistakes/reasons/notes/chart notes/psychology).

Read everything, cross-reference days, and surface recurring themes. Reference REAL pairs, dates, RR, mistake/emotion tags — never invent.

STRICT LENGTH LIMITS (journal style, not essay style — terse, punchy, no fluff, no headings):
- weekly_narrative: MAX 5 short lines. Plain prose, 1 paragraph. No bullets.
- reflection: MAX 5 short lines. Plain prose, 1 paragraph. No bullets.
- lessons: EXACTLY 1–3 bullets. Each bullet ≤ 18 words. Start each bullet with "- ".
- mistakes: EXACTLY 1–3 bullets. Each bullet ≤ 18 words. Cite the date or pair when possible. Start each bullet with "- ".
- improvements: EXACTLY 1–3 bullets. Each bullet ≤ 18 words. Actionable. Start each bullet with "- ".
- ai_review: MAX 5 short lines. Plain prose, 1 paragraph. End with a single bottom-line directive.

ROTATE EMOJIS NATURALLY from this library (never repeat the same emoji twice in one review; pick by context, ~2–4 total across the whole review):
🏆 🚀 💎 ⭐ 🔥 🎯 🎖️ ⚔️ 🧭 🎲 🧠 🔍 📚 🔬 🧩 ⚠️ 🚨 ⛔ 🔻 🧨 📈 📉 🛠️ ⚙️ 🔄 🎓 🌍 🏦 💵 📊 🏛️ 📝 📌 📍 📎 🗂️ 💡 ✅ ❌ 🟢 🔴 🟡

TONE: second person ("you", "your"), calm, direct, specific. No markdown headings. If a section truly has no data, write exactly "Not enough data this week to call this out." for that field.`;

    const userText = `WEEK: ${startStr} → ${endStr}
SUMMARY: ${wins}W / ${losses}L · NET P/L ${pnl.toFixed(2)} · ${tradesLite.length} trades · ${days.length} daily plans

WEEKLY PLAN:
${JSON.stringify(wp || {}, null, 0).slice(0, 5000)}

DAILY PLANS (Mon–Fri):
${JSON.stringify(days, null, 0).slice(0, 18000)}

TRADES TAKEN THIS WEEK:
${JSON.stringify(tradesLite, null, 0).slice(0, 12000)}`;

    const result = await aiChat({
      tier: "sonnet",
      max_tokens: 1200,
      temperature: 0.5,
      messages: [{ role: "system", content: sys }, { role: "user", content: userText }],
      tools: [{
        type: "function",
        function: {
          name: "emit_weekly_review",
          description: "Emit a complete structured weekly review.",
          parameters: {
            type: "object",
            properties: {
              weekly_narrative: { type: "string" },
              reflection: { type: "string" },
              lessons: { type: "string" },
              mistakes: { type: "string" },
              improvements: { type: "string" },
              ai_review: { type: "string" },
            },
            required: ["weekly_narrative", "reflection", "lessons", "mistakes", "improvements", "ai_review"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "emit_weekly_review" } },
    });

    const call = result?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args) {
      return new Response(JSON.stringify({ error: "AI returned no review" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      weeklyNarrative: args.weekly_narrative || "",
      reflection: args.reflection || "",
      lessons: args.lessons || "",
      mistakes: args.mistakes || "",
      improvements: args.improvements || "",
      aiReview: args.ai_review || "",
      meta: { weekStart: startStr, weekEnd: endStr, trades: tradesLite.length, wins, losses, pnl, daily_plans: days.length },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return aiErrorResponse(e, corsHeaders);
  }
});
