// Shared Lovable AI Gateway client (Google Gemini) for all journal AI features.
// OpenAI Chat Completions–compatible.
//
// Auth: LOVABLE_API_KEY (auto-provisioned by Lovable Cloud, never exposed to client).
//
// Tier routing:
//   "haiku"  -> google/gemini-2.5-flash-lite  (cheap/fast: chips, panels)
//   "sonnet" -> google/gemini-2.5-flash       (default: insights, mentor, vision, brief, macro)
//   "opus"   -> google/gemini-2.5-pro         (deep / full-journal only)

export type AiTier = "haiku" | "sonnet" | "opus";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const MODEL_BY_TIER: Record<AiTier, string> = {
  haiku:  "google/gemini-2.5-flash-lite",
  sonnet: "google/gemini-2.5-flash",
  opus:   "google/gemini-2.5-pro",
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
  if (!LOVABLE_API_KEY) throw new AiError(500, "LOVABLE_API_KEY not configured");
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      Accept: accept,
    },
    body: JSON.stringify(body),
  });
  return resp;
}

export async function aiChat(req: AiChatRequest) {
  const resp = await callGateway(buildBody(req, false), "application/json");
  if (!resp.ok) {
    const text = await resp.text();
    console.error("Lovable AI error", resp.status, text.slice(0, 800));
    throw new AiError(resp.status, text);
  }
  return await resp.json();
}

export async function aiStream(req: AiChatRequest): Promise<Response> {
  const resp = await callGateway(buildBody(req, true), "text/event-stream");
  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    console.error("Lovable AI stream error", resp.status, text.slice(0, 600));
    throw new AiError(resp.status, text || "stream failed");
  }
  // Gateway is already OpenAI-compatible SSE — pass through.
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
