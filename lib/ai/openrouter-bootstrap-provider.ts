/**
 * Server-only OpenRouter bootstrap provider.
 *
 * Authority: ADR-001 §4 — Bootstrap Text Generation → OpenRouter Free Model Tier.
 * Uses OPENROUTER_API_KEY and optional OPENROUTER_BOOTSTRAP_MODEL env vars.
 *
 * Note: Gemini provider (lib/ai/gemini-bootstrap-provider.ts) is now preferred
 * when GEMINI_API_KEY is present, due to superior factual recall and independent
 * rate limits. This provider remains as a fallback.
 */

import type {
  BootstrapProvider,
  BootstrapInput,
  BootstrapGenerationResult,
} from "@/lib/ai/bootstrap-provider";
import {
  extractContent,
  extractJson,
  validateResult,
} from "@/lib/ai/bootstrap-parser";
import { buildBootstrapPrompt } from "@/lib/prompts/bootstrap";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export class OpenRouterBootstrapProvider implements BootstrapProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model?.trim() || DEFAULT_MODEL;
  }

  async generate(input: BootstrapInput): Promise<BootstrapGenerationResult> {
    const prompt = buildBootstrapPrompt(input.title, input.description);

    const requestBody = JSON.stringify({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const requestHeaders = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://raree-show-admin",
      "X-Title": "Raree Show Admin",
    };

    const doFetch = () =>
      fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      });

    let res = await doFetch();

    // Respect server-suggested retry delay on 429 (Venice shared rate limits)
    if (res.status === 429) {
      const rawErr = await res.text();
      const waitMs = parseRetryAfterMs(rawErr);
      console.info(
        `[openrouter] 429 rate-limit — waiting ${Math.round(waitMs / 1000)}s before retry`
      );
      await new Promise((r) => setTimeout(r, waitMs));
      res = await doFetch();
    }

    const rawBody = await res.text();

    if (!res.ok) {
      if (res.status === 429) {
        const waitSec = Math.round(parseRetryAfterMs(rawBody) / 1000);
        throw new Error(
          `模型 "${this.model}" 达到上游速率限制 (429)，自动重试后仍失败。` +
            `建议等待约 ${waitSec} 秒后手动重试，` +
            `或在 .env.local 中将 OPENROUTER_BOOTSTRAP_MODEL 换为其他模型。`
        );
      }
      throw new Error(
        `OpenRouter HTTP ${res.status}: ${rawBody.slice(0, 500)}`
      );
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch {
      throw new Error(
        `Bootstrap provider returned non-JSON content: ${content.slice(0, 200)}`
      );
    }

    return validateResult(parsed);
  }
}

/**
 * Parse the `retry_after_seconds` field from an OpenRouter 429 error body.
 * Falls back to 20 s if absent. Caps at 90 s to avoid blocking too long.
 */
function parseRetryAfterMs(rawBody: string): number {
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
