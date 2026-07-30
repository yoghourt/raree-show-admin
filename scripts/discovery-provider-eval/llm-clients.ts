/**
 * Eval-only LLM clients. MUST NOT be imported by production Discovery routes.
 */

import { extractContent } from "@/lib/ai/llm-response-utils";
import { ensureUndiciProxyDispatcherForGemini } from "@/lib/ai/undici-proxy-bootstrap";

export type EvalLlmCall = (prompt: string) => Promise<string>;

/** Default Gemini eval RPM. Override with DISCOVERY_EVAL_GEMINI_RPM.
 *  gemini-3.5-flash-lite free/eval tier: 15 RPM (operator-confirmed).
 *  Older Flash free tiers may be 5 — set env lower when needed. */
export const GEMINI_EVAL_DEFAULT_RPM = 15;
/** Hard ceiling so a typo cannot blast quota. */
export const GEMINI_EVAL_MAX_RPM = 15;

/**
 * Sliding-window limiter: at most `maxPerMinute` starts in any rolling 60s,
 * AND enforce min spacing of ceil(60s/max) so we never burst to the cap.
 */
function createRpmGate(maxPerMinute: number, label: string) {
  const startedAt: number[] = [];
  const minGapMs = Math.ceil(60_000 / maxPerMinute);
  return async function acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (startedAt.length > 0 && now - startedAt[0]! >= 60_000) {
        startedAt.shift();
      }
      const last = startedAt[startedAt.length - 1];
      const gapWait =
        last != null ? Math.max(0, minGapMs - (now - last)) : 0;
      const windowFull = startedAt.length >= maxPerMinute;
      const windowWait = windowFull
        ? 60_000 - (now - startedAt[0]!) + 50
        : 0;
      const waitMs = Math.max(gapWait, windowWait);
      if (waitMs <= 0) {
        startedAt.push(Date.now());
        return;
      }
      console.info(
        "[eval-rpm] %s waiting %dms (window=%d/%d minGap=%dms)",
        label,
        waitMs,
        startedAt.length,
        maxPerMinute,
        minGapMs
      );
      await new Promise((r) => setTimeout(r, Math.max(waitMs, 250)));
    }
  };
}

async function postChatCompletions(params: {
  url: string;
  apiKey?: string;
  model: string;
  prompt: string;
  jsonObject?: boolean;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
  maxTokens?: number;
  /** Extra OpenAI-compat body fields (LocalAI / Qwen thinking off, etc.). */
  extraBody?: Record<string, unknown>;
  beforeRequest?: () => Promise<void>;
}): Promise<string> {
  if (params.beforeRequest) {
    await params.beforeRequest();
  }
  const controller = new AbortController();
  const timeoutMs = params.timeoutMs ?? 180_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(params.extraHeaders ?? {}),
    };
    if (params.apiKey) {
      headers.Authorization = `Bearer ${params.apiKey}`;
    }
    const body: Record<string, unknown> = {
      model: params.model,
      messages: [{ role: "user", content: params.prompt }],
      ...(params.extraBody ?? {}),
    };
    if (params.maxTokens != null) {
      body.max_tokens = params.maxTokens;
    }
    if (params.jsonObject) {
      body.response_format = { type: "json_object" };
    }
    const res = await fetch(params.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawBody = await res.text();
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(
          `HTTP 429 rate limited: ${rawBody.slice(0, 300)} (Gemini eval RPM cap=${GEMINI_EVAL_MAX_RPM})`
        );
      }
      throw new Error(`HTTP ${res.status}: ${rawBody.slice(0, 400)}`);
    }
    let envelope: unknown;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      throw new Error("Provider returned invalid JSON envelope");
    }
    const content = extractContent(envelope);
    if (!content) {
      const choice = (envelope as { choices?: Array<{ message?: Record<string, unknown> }> })
        ?.choices?.[0]?.message;
      const reasoning =
        typeof choice?.reasoning === "string"
          ? choice.reasoning
          : typeof choice?.reasoning_content === "string"
            ? choice.reasoning_content
            : "";
      throw new Error(
        `Provider response contained no message content (reasoning_len=${reasoning.length})`
      );
    }
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`runtime timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function createGeminiEvalClient(model: string, apiKey: string): EvalLlmCall {
  ensureUndiciProxyDispatcherForGemini();
  const url =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  const rpm =
    Math.min(
      GEMINI_EVAL_MAX_RPM,
      Math.max(
        1,
        parseInt(
          process.env.DISCOVERY_EVAL_GEMINI_RPM ?? String(GEMINI_EVAL_DEFAULT_RPM),
          10
        ) || GEMINI_EVAL_DEFAULT_RPM
      )
    );
  const gate = createRpmGate(rpm, "gemini");
  console.info(
    "[eval] Gemini client RPM cap=%d (flash-lite default 15); minGap=%dms",
    rpm,
    Math.ceil(60_000 / rpm)
  );
  return async (prompt) => {
    try {
      return await postChatCompletions({
        url,
        apiKey,
        model,
        prompt,
        jsonObject: true,
        timeoutMs: 180_000,
        beforeRequest: gate,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/HTTP 429/.test(msg)) throw err;
      console.info("[eval-rpm] gemini got 429 — cooling 65s then one retry");
      await new Promise((r) => setTimeout(r, 65_000));
      return postChatCompletions({
        url,
        apiKey,
        model,
        prompt,
        jsonObject: true,
        timeoutMs: 180_000,
        beforeRequest: gate,
      });
    }
  };
}

export function createOpenRouterEvalClient(
  model: string,
  apiKey: string
): EvalLlmCall {
  return (prompt) =>
    postChatCompletions({
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey,
      model,
      prompt,
      // Free models often break with response_format — match production OpenRouter path.
      jsonObject: false,
      extraHeaders: {
        "HTTP-Referer": "https://raree-show-admin",
        "X-Title": "Raree Show Discovery Provider Eval",
      },
      timeoutMs: 300_000,
    });
}

/** LocalAI OpenAI-compatible chat — eval only; not wired into Admin Discovery. */
export function createLocalAiEvalClient(params: {
  baseUrl: string;
  model: string;
  apiKey?: string;
}): EvalLlmCall {
  const base = params.baseUrl.replace(/\/$/, "");
  // Thinking models (e.g. qwen3.5-*-dflash) spend tokens on reasoning first.
  // Default 3072: enough for Discovery JSON; 8192 often hits ~5min host timeouts.
  const maxTokens = Math.max(
    1024,
    parseInt(process.env.DISCOVERY_EVAL_LOCALAI_MAX_TOKENS ?? "8192", 10) ||
      8192
  );
  const timeoutMs = Math.max(
    120_000,
    parseInt(process.env.DISCOVERY_EVAL_LOCALAI_TIMEOUT_MS ?? "900000", 10) ||
      900_000
  );
  return (prompt) =>
    postChatCompletions({
      url: `${base}/v1/chat/completions`,
      apiKey: params.apiKey,
      model: params.model,
      prompt,
      jsonObject: false,
      maxTokens,
      timeoutMs,
      // Qwen3.5-dflash otherwise fills reasoning and starves content / wall clock.
      extraBody: {
        chat_template_kwargs: { enable_thinking: false },
      },
    });
}

export async function probeLocalAiModels(baseUrl: string): Promise<{
  ok: boolean;
  modelIds: string[];
  error?: string;
}> {
  const base = baseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/models`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      return { ok: false, modelIds: [], error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as {
      data?: Array<{ id?: string }>;
    };
    const modelIds = (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));
    return { ok: true, modelIds };
  } catch (err) {
    return {
      ok: false,
      modelIds: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
