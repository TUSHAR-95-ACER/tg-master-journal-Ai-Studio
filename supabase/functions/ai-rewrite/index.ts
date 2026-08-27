// AI text rewrite for the journal RichTextEditor.
// Two modes only — kept intentionally simple:
//   - "improve" : fix grammar/spelling, keep voice, light emojis allowed.
//   - "polish"  : restructure for readability with headings/bullets when helpful.
// Returns HTML safe to drop back into Tiptap (paragraphs, headings, lists, strong/em).
//
// Auth: LOVABLE_API_KEY (auto-provisioned by Lovable Cloud).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { aiChat, aiErrorResponse } from "../_shared/lovable-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Shared emoji palette guidance — the same vocabulary in both modes so the
// trader's notes feel consistent. Keep it sparse: structure first, emoji second.
const EMOJI_PALETTE = `Emoji palette (use SPARINGLY — at most one emoji every few sentences, never two in a row). Pick category-specific symbols, never spam:
Market action: 📈 📉 📊 🎯 🧭 ⚡ 🔥 🚀 💥
Analysis:     🔍 🧠 📚 📋 📝 🧩 🎓
Risk:         ⚠️ 🛡️ ⛔ 🚫
Execution:    🎯 ⚔️ 🔑 💎 ✅ ❌
Psychology:   😤 😎 🤔 😬 🧘
Macro:        🏦 💵 🪙 🌎 🌍 📢
News:         📰 🚨 📣
Strategy:     ♟️ 🎖️ 🏆 ⭐
Rules: maximum one emoji per heading/bullet, choose from the matching category. The result must read like a trader wrote it, NOT like AI wrote it. No emoji spam. No emoji inside the middle of a sentence. No emoji on price levels. Never repeat the same emoji twice in a row.`;

const SYSTEM_IMPROVE = `You are a careful copy editor for a trader's personal journal.
Task: Fix grammar, spelling, and punctuation. Lightly improve readability without changing meaning.
Voice:
- Keep the trader's natural first-person voice EXACTLY. Do not corporatise.
- Never make it sound AI-generated or institutional.
- Preserve every trading term verbatim (FVG, OB, BOS, CHOCH, DR, SMT, RR, SL, TP, SMC, ICT, NY/London/Asia, pair names, dollar amounts, price levels).
Structure:
- Keep the same overall paragraph order.
- You MAY split a wall of text into 2-3 short paragraphs when it genuinely improves readability.
- You MAY add a small bold inline tag (e.g. <strong>📈 Bullish:</strong>) at the start of a line when the trader is clearly listing factors — but only if it makes scanning easier. Do NOT force structure where the prose flows fine.
${EMOJI_PALETTE}
Output ONLY valid HTML using <p>, <strong>, <em>, <ul>, <li>, <br>. No markdown, no code fences, no commentary, no preamble.`;

const SYSTEM_POLISH = `You restructure a trader's personal journal note for readability while keeping the trader's personal voice.
Voice:
- First person, casual where the original is casual.
- Never sound corporate, institutional, or AI-generated.
- Preserve every trading term verbatim (FVG, OB, BOS, CHOCH, DR, SMT, RR, SL, TP, pair names, prices, dollar amounts).
- Add zero new analysis, ideas, predictions, or facts.
Structure:
- Group related thoughts into short paragraphs.
- Add short <h3> headings (2-4 words) only when the note has multiple distinct topics. Pick from this vocabulary when relevant: "🧠 Market Narrative", "📈 Bullish Factors", "📉 Bearish Factors", "🎯 Target", "⚠️ Risk", "🔥 Confluence", "🔍 Review", "💡 Observation", "❌ Mistake", "✅ Confirmation".
- Use <ul><li> bullets for genuine lists (factors, confluences, mistakes) — never for a single point.
- Bold the key word at the start of a bullet when it sharpens scan-ability: <strong>FVG:</strong> filled at NY open.
- Keep it concise. Do not pad. Never repeat content across sections.
${EMOJI_PALETTE}
Output ONLY valid HTML using <h3>, <p>, <strong>, <em>, <ul>, <li>, <br>. No markdown, no code fences, no commentary, no preamble.`;

function stripCodeFence(s: string): string {
  return s.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require an authenticated caller — prevents anonymous credit drain on LOVABLE_API_KEY.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { mode, html } = await req.json();
    if (!html || typeof html !== "string" || !html.trim()) {
      return new Response(JSON.stringify({ error: "Empty text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const MAX_HTML_BYTES = 50_000; // ~50 kB cap to prevent credit drain
    if (html.length > MAX_HTML_BYTES) {
      return new Response(JSON.stringify({ error: "Input too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (mode !== "improve" && mode !== "polish") {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = mode === "polish" ? SYSTEM_POLISH : SYSTEM_IMPROVE;
    const result = await aiChat({
      tier: "sonnet",
      temperature: mode === "improve" ? 0.2 : 0.4,
      max_tokens: 2000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Rewrite the following journal note. Input HTML:\n\n${html}` },
      ],
    });

    const out = result?.choices?.[0]?.message?.content || "";
    const cleaned = stripCodeFence(typeof out === "string" ? out : "");
    return new Response(JSON.stringify({ html: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return aiErrorResponse(e, corsHeaders);
  }
});
