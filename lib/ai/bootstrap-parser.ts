/**
 * Shared parsing and validation utilities for Bootstrap providers.
 * Both OpenRouterBootstrapProvider and GeminiBootstrapProvider use these.
 */

import type {
  BootstrapGenerationResult,
  GeneratedCharacter,
  GeneratedLocation,
  GeneratedScene,
} from "@/lib/ai/bootstrap-provider";

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

export function validateResult(raw: unknown): BootstrapGenerationResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Bootstrap result is not a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  const characters = parseCharacters(obj.characters);
  const locations = parseLocations(obj.locations);
  const scenes = parseScenes(obj.scenes, characters.length, locations.length);
  return { characters, locations, scenes };
}

function parseCharacters(raw: unknown): GeneratedCharacter[] {
  if (!Array.isArray(raw)) return [];
  const out: GeneratedCharacter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const name = typeof c.name === "string" ? c.name.trim() : "";
    if (!name) continue;
    out.push({
      name,
      house: typeof c.house === "string" ? c.house.trim() : "",
      description:
        typeof c.description === "string" ? c.description.trim() : "",
      signatureQuote:
        typeof c.signatureQuote === "string" && c.signatureQuote.trim()
          ? c.signatureQuote.trim()
          : null,
    });
  }
  return out;
}

function parseLocations(raw: unknown): GeneratedLocation[] {
  if (!Array.isArray(raw)) return [];
  const out: GeneratedLocation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const l = item as Record<string, unknown>;
    const name = typeof l.name === "string" ? l.name.trim() : "";
    if (!name) continue;
    out.push({
      name,
      region: typeof l.region === "string" ? l.region.trim() : "",
      description:
        typeof l.description === "string" ? l.description.trim() : "",
    });
  }
  return out;
}

function parseScenes(
  raw: unknown,
  characterCount: number,
  locationCount: number
): GeneratedScene[] {
  if (!Array.isArray(raw)) return [];
  const out: GeneratedScene[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;

    const title = typeof s.title === "string" ? s.title.trim() : "";
    if (!title) continue;

    const chapter_number =
      typeof s.chapter_number === "number" && Number.isFinite(s.chapter_number)
        ? Math.max(1, Math.floor(s.chapter_number))
        : out.length + 1;

    const chapter_title =
      typeof s.chapter_title === "string" && s.chapter_title.trim()
        ? s.chapter_title.trim()
        : null;

    const summary =
      typeof s.summary === "string" ? s.summary.trim() : "";

    const locationIndex =
      typeof s.locationIndex === "number" &&
      Number.isInteger(s.locationIndex) &&
      s.locationIndex >= 0 &&
      s.locationIndex < locationCount
        ? s.locationIndex
        : -1;

    const characterIndices = Array.isArray(s.characterIndices)
      ? (s.characterIndices as unknown[]).filter(
          (i): i is number =>
            typeof i === "number" &&
            Number.isInteger(i) &&
            i >= 0 &&
            i < characterCount
        )
      : [];

    const imageCaption =
      typeof s.imageCaption === "string" ? s.imageCaption.trim() : "";

    out.push({
      title,
      chapter_number,
      chapter_title,
      summary,
      locationIndex,
      characterIndices,
      imageCaption,
    });
  }
  return out;
}
