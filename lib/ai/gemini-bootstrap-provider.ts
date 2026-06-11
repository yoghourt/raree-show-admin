/**
 * Server-only Gemini bootstrap provider.
 *
 * Uses Google's OpenAI-compatible endpoint so the request/response shape is
 * identical to the OpenRouter provider — only the base URL and API key differ.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/openai/
 * API key:  GEMINI_API_KEY  (obtain from https://aistudio.google.com/apikey)
 * Model:    configurable via GEMINI_BOOTSTRAP_MODEL, defaults to gemini-2.0-flash
 *
 * Free tier: 15 RPM / 1 500 RPD — independent quota, no shared upstream pool.
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

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiBootstrapProvider implements BootstrapProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model?.trim() || DEFAULT_MODEL;
  }

  async generate(input: BootstrapInput): Promise<BootstrapGenerationResult> {
    const prompt = buildBootstrapPrompt(input.title, input.description);

    const res = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    const rawBody = await res.text();

    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const waitSec = retryAfter ? parseInt(retryAfter, 10) : 60;
        throw new Error(
          `Gemini API 速率限制 (429)，请等待约 ${waitSec} 秒后重试。` +
            `免费额度：15 RPM / 1500 RPD。`
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch {
      throw new Error(
        `Gemini provider returned non-JSON content: ${content.slice(0, 200)}`
      );
    }

    return validateResult(parsed);
  }
}
