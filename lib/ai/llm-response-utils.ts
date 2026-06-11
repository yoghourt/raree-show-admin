/**
 * Shared LLM response parsing utilities (OpenAI-compatible chat completions).
 */

/**
 * Strip markdown code fences and extract the outermost JSON object.
 * Some models wrap JSON in ```json ... ``` despite being instructed not to.
 */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

/** Extract message content from an OpenAI-compatible chat completions envelope. */
export function extractContent(envelope: unknown): string | null {
  if (!envelope || typeof envelope !== "object") return null;
  const choices = (envelope as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first?.message?.content;
  return typeof content === "string" ? content.trim() : null;
}
