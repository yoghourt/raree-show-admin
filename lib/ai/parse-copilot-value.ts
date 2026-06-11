/**
 * Parse a single-field Copilot LLM response into a plain string value.
 * Free-tier models often return broken JSON — extract best-effort or throw.
 */

import { extractJson } from "@/lib/ai/bootstrap-parser";

function looksLikeJsonGarbage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^[\s{[\]}"':,value]+$/.test(t)) return true;
  if (t.includes('{"value') || t.includes('"value"}')) return true;
  if (/\}\]\}/.test(t)) return true;
  return false;
}

function extractValueFromObject(obj: unknown): string | null {
  if (typeof obj !== "object" || obj === null || !("value" in obj)) {
    return null;
  }
  const v = (obj as Record<string, unknown>)["value"];
  if (typeof v === "string") return v.trim();
  if (v === null || v === undefined) return "";
  return null;
}

function regexExtractValue(raw: string): string | null {
  // Quoted string value — tolerate mixed quotes from free models
  const stringMatch = raw.match(
    /["']value["']\s*:\s*["']((?:[^"'\\]|\\.)*)["']/
  );
  if (stringMatch) {
    return stringMatch[1].trim();
  }

  // Empty string variants: "value": ""  or  'value': ''
  if (/["']value["']\s*:\s*["']{2}/.test(raw)) {
    return "";
  }

  return null;
}

/**
 * @throws Error when the model output cannot be parsed into a usable value
 */
export function parseCopilotFieldValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // 1. Standard JSON object
  try {
    const fromExtract = extractValueFromObject(JSON.parse(extractJson(trimmed)));
    if (fromExtract !== null) return fromExtract;
  } catch {
    // continue
  }

  // 2. Regex salvage (broken free-model JSON)
  const fromRegex = regexExtractValue(trimmed);
  if (fromRegex !== null) return fromRegex;

  // 3. Plain text — only if it does not look like a JSON fragment
  if (!trimmed.startsWith("{") && !trimmed.includes('"value"') && !looksLikeJsonGarbage(trimmed)) {
    return trimmed;
  }

  throw new Error("模型返回格式无效，请重试");
}

/**
 * Parse a multi-field batch response: {"house": "...", "description": "..."}
 */
export function parseBatchCopilotValues(
  raw: string,
  fieldKeys: string[]
): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("模型返回格式无效，请重试");
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(extractJson(trimmed)) as Record<string, unknown>;
  } catch {
    throw new Error("模型返回格式无效，请重试");
  }

  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new Error("模型返回格式无效，请重试");
  }

  const result: Record<string, string> = {};
  for (const key of fieldKeys) {
    const v = obj[key];
    if (typeof v === "string") {
      result[key] = v.trim();
    } else if (v === null || v === undefined) {
      result[key] = "";
    } else if (typeof v === "number" || typeof v === "boolean") {
      result[key] = String(v);
    } else {
      result[key] = "";
    }
  }

  return result;
}
