// Shared OpenRouter client for all journal AI features.
// OpenAI Chat Completions-compatible.
//
// Auth: OPENROUTER_API_KEY (set in Supabase Edge Function secrets; never exposed to client).
// Optional headers (set when APP_URL is available):
//   HTTP-Referer: APP_URL   (recommended by OpenRouter for app attribution)
//   X-Title: tg-master-journal
//
// Model pinning (strategy B):
//   All tiers (haiku / sonnet / opus) -> minimax/minimax-m3:free
//   Pinned intentionally for predictable behavior on the free tier.
//   To switch, change MODEL_BY_TIER below.

export type AiTier = "haiku" | "sonnet" | "opus";

const GATEWAY_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const APP_URL = Deno.env.get("APP_URL");

const MODEL_BY_TIER: Record<AiTier, string> = {
  haiku:  "minimax/minimax-m3:free",
  sonnet: "minimax/minimax-m3:free",
  opus:   "minimax/minimax-m3:free",
};

export type OAITextPart  = { type: "text"; text: string };
export type OAIImagePart = { type: "image_url"; image_url: { url: string } };
export type OAIPart      = OAITextPart | OAIImagePart;
export type OAIMessage   = { role: "system" | "user" | "assistant"; content: string | OAIPart[] };

export interface OAITool {
  type: "function";
  function: { name: string; description?: string; parameters: any };
}
export type OAIToolChoice =
  | "auto" | "none"
  | { type: "function"; function: { name: string } };

export interface AiChatRequest {
  tier: AiTier;
  messages: OAIMessage[];
  tools?: OAITool[];
  tool_choice?: OAIToolChoice;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function buildHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: accept,
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
  };
  if (APP_URL) headers["HTTP-Referer"] = APP_URL;
  headers["X-Title"] = "tg-master-journal";
  return headers;
}

function buildBody(req: AiChatRequest, stream = false) {
  const body: any = {
    model: MODEL_BY_TIER[req.tier],
    messages: req.messages,
    stream,
  };
  if (typeof req.max_tokens === "number") body.max_tokens = req.max_tokens;
  if (typeof req.temperature === "number") body.temperature = req.temperature;
  if (req.tools && req.tools.length) {
    body.tools = req.tools;
    if (req.tool_choice) body.tool_choice = req.tool_choice;
  }
  return body;
}

async function callGateway(body: any, accept: string) {
  if (!OPENROUTER_API_KEY) throw new AiError(500, "OPENROUTER_API_KEY not configured");
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: buildHeaders(accept),
    body: JSON.stringify(body),
  });
  return resp;
}

export async function aiChat(req: AiChatRequest) {
  const resp = await callGateway(buildBody(req, false), "application/json");
  if (!resp.ok) {
    const text = await resp.text();
    console.error("OpenRouter error", resp.status, text.slice(0, 800));
    throw new AiError(resp.status, text);
  }
  return await resp.json();
}

export async function aiStream(req: AiChatRequest): Promise<Response> {
  const resp = await callGateway(buildBody(req, true), "text/event-stream");
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    console.error("OpenRouter stream error", resp.status, text.slice(0, 600));
    throw new AiError(resp.status, text || "stream failed");
  }
  // OpenRouter is OpenAI-compatible SSE — pass through.
  return new Response(resp.body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

export function aiErrorResponse(e: unknown, corsHeaders: Record<string, string>) {
  const status = e instanceof AiError ? e.status : 500;
  let msg = "AI service error";
  if (e instanceof AiError) {
    console.error("AI error detail", status, e.message?.slice(0, 1200));
    if (status === 401 || status === 403) msg = "AI service unavailable.";
    else if (status === 402) msg = "AI credits exhausted. Add credits in Settings.";
    else if (status === 429) msg = "AI service is busy. Try again shortly.";
    else if (status >= 500) msg = "AI service temporarily unavailable.";
    else msg = "AI service error.";
  } else if (e instanceof Error) {
    console.error("AI non-AiError", e.message);
  }
  return new Response(JSON.stringify({ error: msg }), {
    status: status >= 400 && status < 600 ? status : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}