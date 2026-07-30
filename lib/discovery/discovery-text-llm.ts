/**
 * Discovery-only text LLM routing (Deployment knobs).
 *
 * Defaults (SPEC-D3 Implementation / eval v3):
 *   DISCOVERY_TEXT_PROVIDER = gemini
 *   DISCOVERY_TEXT_MODEL    = gemini-3.5-flash-lite
 *
 * Fallback on transport/provider failure only (not parse/schema).
 * Does not change Enrichment COPILOT_TEXT_PROVIDER / GEMINI_SUGGEST_MODEL.
 */

import {
  callCopilotTextLlm,
  type CopilotTextLlmOptions,
  type CopilotTextProvider,
} from "@/lib/ai/copilot-text-llm";

export const DISCOVERY_TEXT_DEFAULT_PROVIDER: CopilotTextProvider = "gemini";
export const DISCOVERY_TEXT_DEFAULT_MODEL = "gemini-3.5-flash-lite";

export function resolveDiscoveryTextProvider(): CopilotTextProvider {
  const explicit = process.env.DISCOVERY_TEXT_PROVIDER?.trim().toLowerCase();
  if (explicit === "openrouter" || explicit === "gemini") {
    return explicit;
  }
  return DISCOVERY_TEXT_DEFAULT_PROVIDER;
}

export function resolveDiscoveryTextModel(
  provider: CopilotTextProvider = resolveDiscoveryTextProvider()
): string {
  const explicit = process.env.DISCOVERY_TEXT_MODEL?.trim();
  if (explicit) return explicit;

  if (provider === "openrouter") {
    return (
      process.env.DISCOVERY_TEXT_FALLBACK_MODEL?.trim() ||
      process.env.OPENROUTER_SUGGEST_MODEL?.trim() ||
      "openai/gpt-oss-20b:free"
    );
  }

  return DISCOVERY_TEXT_DEFAULT_MODEL;
}

export function resolveDiscoveryTextFallbackProvider(
  primary: CopilotTextProvider = resolveDiscoveryTextProvider()
): CopilotTextProvider | null {
  const raw = process.env.DISCOVERY_TEXT_FALLBACK_PROVIDER?.trim().toLowerCase();
  let fallback: CopilotTextProvider | null;
  if (raw === "openrouter" || raw === "gemini") {
    fallback = raw;
  } else if (raw === "" || raw === "none" || raw === "off") {
    fallback = null;
  } else {
    // Default: openrouter when key present, else none
    fallback = process.env.OPENROUTER_API_KEY?.trim() ? "openrouter" : null;
  }

  if (!fallback || fallback === primary) {
    return null;
  }
  if (fallback === "openrouter" && !process.env.OPENROUTER_API_KEY?.trim()) {
    return null;
  }
  if (fallback === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
    return null;
  }
  return fallback;
}

export function resolveDiscoveryTextFallbackModel(
  fallbackProvider: CopilotTextProvider
): string {
  const explicit = process.env.DISCOVERY_TEXT_FALLBACK_MODEL?.trim();
  if (explicit) return explicit;
  if (fallbackProvider === "openrouter") {
    return (
      process.env.OPENROUTER_SUGGEST_MODEL?.trim() || "openai/gpt-oss-20b:free"
    );
  }
  return (
    process.env.GEMINI_SUGGEST_MODEL?.trim() || DISCOVERY_TEXT_DEFAULT_MODEL
  );
}

/** Transport / provider failures eligible for one fallback attempt. */
export function isDiscoveryTransportFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /网络请求失败|fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|UND_ERR|HTTP \d+|速率限制|429|no message content|invalid JSON envelope|is not configured/i.test(
      message
    )
  );
}

let loggedDiscoveryRoute: string | null = null;

/**
 * Discovery propose/regen LLM call — primary then optional transport fallback.
 */
export async function callDiscoveryTextLlm(
  prompt: string,
  options?: Pick<CopilotTextLlmOptions, "geminiJsonObject">
): Promise<string> {
  const primary = resolveDiscoveryTextProvider();
  const primaryModel = resolveDiscoveryTextModel(primary);
  const fallback = resolveDiscoveryTextFallbackProvider(primary);

  const routeKey = `${primary}:${primaryModel}->${fallback ?? "none"}`;
  if (loggedDiscoveryRoute !== routeKey) {
    loggedDiscoveryRoute = routeKey;
    console.info(
      "[discovery-llm] primary=%s model=%s fallback=%s",
      primary,
      primaryModel,
      fallback ?? "none"
    );
  }

  try {
    return await callCopilotTextLlm(prompt, {
      ...options,
      provider: primary,
      model: primaryModel,
      geminiJsonObject: options?.geminiJsonObject ?? true,
    });
  } catch (err) {
    if (!fallback || !isDiscoveryTransportFailure(err)) {
      throw err;
    }
    const fallbackModel = resolveDiscoveryTextFallbackModel(fallback);
    console.warn(
      "[discovery-llm] primary failed (%s); trying fallback=%s model=%s",
      err instanceof Error ? err.message.slice(0, 120) : String(err),
      fallback,
      fallbackModel
    );
    return callCopilotTextLlm(prompt, {
      ...options,
      provider: fallback,
      model: fallbackModel,
      geminiJsonObject: options?.geminiJsonObject ?? true,
    });
  }
}
