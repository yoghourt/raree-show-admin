/**
 * Copilot text LLM adapter — OpenRouter (default for testing) or Gemini.
 *
 * Env:
 *   COPILOT_TEXT_PROVIDER     — "openrouter" | "gemini" (default: openrouter if OPENROUTER_API_KEY set, else gemini)
 *   OPENROUTER_API_KEY        — required for openrouter
 *   OPENROUTER_SUGGEST_MODEL  — default meta-llama/llama-3.3-70b-instruct:free
 *   GEMINI_API_KEY            — required for gemini
 *   GEMINI_SUGGEST_MODEL      — default gemini-2.5-flash
 *
 * Avatar / image generation still uses Gemini separately (GEMINI_IMAGE_MODEL).
 */

import { setDefaultResultOrder } from "node:dns";

import { extractContent } from "@/lib/ai/llm-response-utils";
import { ensureUndiciProxyDispatcherForGemini } from "@/lib/ai/undici-proxy-bootstrap";

export type CopilotTextProvider = "openrouter" | "gemini";

export interface CopilotTextLlmOptions {
  /** Gemini only: request json_object response format. Default true (Enrichment). */
  geminiJsonObject?: boolean;
  /** Override provider (Discovery / eval). Default: resolveCopilotTextProvider(). */
  provider?: CopilotTextProvider;
  /** Override model id for the chosen provider. */
  model?: string;
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

/** Prefer IPv4 first — undici often surfaces DNS/IPv6 issues as bare "fetch failed". */
try {
  setDefaultResultOrder("ipv4first");
} catch {
  /* non-Node or unsupported */
}

function formatOutboundFetchError(err: unknown, providerLabel: string): Error {
  const message = err instanceof Error ? err.message : String(err);
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? err.cause
      : err instanceof Error && err.cause
        ? new Error(String(err.cause))
        : null;
  const causeCode =
    cause && "code" in cause
      ? String((cause as Error & { code?: string }).code ?? "")
      : "";
  const causeText = cause?.message ?? "";

  if (
    message === "fetch failed" ||
    causeCode === "ENOTFOUND" ||
    causeCode === "ECONNREFUSED" ||
    causeCode === "ETIMEDOUT" ||
    causeCode === "UND_ERR_CONNECT_TIMEOUT"
  ) {
    return new Error(
      `${providerLabel} 网络请求失败（${causeCode || "fetch failed"}${
        causeText ? `: ${causeText}` : ""
      }）。请检查本机网络/代理（HTTPS_PROXY），或稍后重试；也可改 COPILOT_TEXT_PROVIDER=gemini。`
    );
  }

  return err instanceof Error ? err : new Error(message);
}

function isTransientFetchError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? err.cause : null;
  const code =
    cause && typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code?: string }).code ?? "")
      : "";
  return (
    message === "fetch failed" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_SOCKET"
  );
}

async function withTransientRetry<T>(
  label: string,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isTransientFetchError(err)) {
      throw formatOutboundFetchError(err, label);
    }
    await new Promise((r) => setTimeout(r, 800));
    try {
      return await run();
    } catch (retryErr) {
      throw formatOutboundFetchError(retryErr, label);
    }
  }
}

export function resolveCopilotTextProvider(): CopilotTextProvider {
  const explicit = process.env.COPILOT_TEXT_PROVIDER?.trim().toLowerCase();
  if (explicit === "openrouter" || explicit === "gemini") {
    return explicit;
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (openrouterKey) return "openrouter";
  if (geminiKey) return "gemini";

  throw new Error(
    "未配置 Copilot 文本模型：请设置 OPENROUTER_API_KEY（推荐测试）或 GEMINI_API_KEY，" +
      "也可用 COPILOT_TEXT_PROVIDER 指定提供商。"
  );
}

function parseOpenRouterRetryAfterMs(rawBody: string): number {
  const FALLBACK_MS = 20_000;
  const CAP_MS = 90_000;
  try {
    const body = JSON.parse(rawBody) as {
      error?: { metadata?: { retry_after_seconds?: number } };
    };
    const seconds = body?.error?.metadata?.retry_after_seconds;
    if (typeof seconds === "number" && seconds > 0) {
      return Math.min(Math.ceil(seconds + 2) * 1000, CAP_MS);
    }
  } catch {
    // ignore
  }
  return FALLBACK_MS;
}

async function callOpenRouter(
  prompt: string,
  modelOverride?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model =
    modelOverride?.trim() ||
    process.env.OPENROUTER_SUGGEST_MODEL?.trim() ||
    OPENROUTER_DEFAULT_MODEL;

  // Free models often break with response_format — rely on prompt + robust parser.
  const requestBody = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
  });

  const requestHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://raree-show-admin",
    "X-Title": "Raree Show Admin",
  };

  return withTransientRetry("OpenRouter", async () => {
    const res = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: requestHeaders,
      body: requestBody,
    });
    const rawBody = await res.text();

    if (!res.ok) {
      if (res.status === 429) {
        const waitSec = Math.round(parseOpenRouterRetryAfterMs(rawBody) / 1000);
        throw new Error(
          `OpenRouter 速率限制 (429)，请等待约 ${waitSec} 秒后重试，` +
            `或更换 OPENROUTER_SUGGEST_MODEL（当前：${model}）。`
        );
      }
      throw new Error(`OpenRouter HTTP ${res.status}: ${rawBody.slice(0, 500)}`);
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      throw new Error("OpenRouter returned invalid JSON envelope");
    }

    const content = extractContent(envelope);
    if (!content) {
      throw new Error("OpenRouter response contained no message content");
    }

    return content;
  });
}

async function callGemini(
  prompt: string,
  options?: CopilotTextLlmOptions
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model =
    options?.model?.trim() ||
    process.env.GEMINI_SUGGEST_MODEL?.trim() ||
    GEMINI_DEFAULT_MODEL;
  const useJsonObject = options?.geminiJsonObject !== false;

  return withTransientRetry("Gemini", async () => {
    const res = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        ...(useJsonObject ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    const rawBody = await res.text();

    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const waitSec = retryAfter ? parseInt(retryAfter, 10) : 60;
        throw new Error(
          `Gemini API 速率限制 (429)，请等待约 ${waitSec} 秒后重试。`
        );
      }
      throw new Error(`Gemini HTTP ${res.status}: ${rawBody.slice(0, 500)}`);
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      throw new Error("Gemini returned invalid JSON envelope");
    }

    const content = extractContent(envelope);
    if (!content) {
      throw new Error("Gemini response contained no message content");
    }

    return content;
  });
}

let loggedRoute: string | null = null;

/** Invoke the configured Copilot text model with a single user prompt. */
export async function callCopilotTextLlm(
  prompt: string,
  options?: CopilotTextLlmOptions
): Promise<string> {
  // Same undici proxy bootstrap as Gemini image path (HTTPS_PROXY / GEMINI_*_PROXY).
  ensureUndiciProxyDispatcherForGemini();

  const provider = options?.provider ?? resolveCopilotTextProvider();
  const model =
    options?.model?.trim() ||
    (provider === "openrouter"
      ? process.env.OPENROUTER_SUGGEST_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL
      : process.env.GEMINI_SUGGEST_MODEL?.trim() || GEMINI_DEFAULT_MODEL);

  const routeKey = `${provider}:${model}`;
  if (loggedRoute !== routeKey) {
    loggedRoute = routeKey;
    console.info("[copilot-llm] provider=%s model=%s", provider, model);
  }

  return provider === "openrouter"
    ? callOpenRouter(prompt, model)
    : callGemini(prompt, { ...options, model });
}
