// OpenRouter provider factory for the Vercel AI SDK (chatgpt-assistant).
// OpenAI-compatible — wraps createOpenAICompatible pointed at openrouter.ai.
// No run-id system (OpenRouter has no equivalent of Lovable's X-Lovable-AIG-Run-ID).

import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@3.0.14";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createOpenrouterProvider(
  apiKey: string,
  options?: { structuredOutputs?: boolean },
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  const appUrl = Deno.env.get("APP_URL");
  if (appUrl) headers["HTTP-Referer"] = appUrl;
  headers["X-Title"] = "tg-master-journal";

  return createOpenAICompatible({
    name: "openrouter",
    baseURL: OPENROUTER_BASE_URL,
    apiKey,
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
    headers,
  });
}