/**
 * Server-only Scene Frame draft prompt (derived Job input — not Runtime Truth).
 * Business intent remains Asset Caption; this string is recomputed per Generate.
 *
 * Local / turbo models under-follow thin wrappers. Structure mirrors avatar.ts:
 * operator override first, scene meaning repeated, anti-blank / anti-text constraints.
 *
 * Operator revision notes (`[操作员修改意见] …`) are promoted to the front —
 * trailing Chinese notes lose to early English style tokens.
 */

export const FRAME_REVISION_MARKER = "[操作员修改意见]";

export function splitFrameCaption(caption: string): {
  base: string;
  revisionNote: string;
} {
  const raw = caption.trim();
  if (!raw) return { base: "", revisionNote: "" };
  const idx = raw.indexOf(FRAME_REVISION_MARKER);
  if (idx < 0) return { base: raw, revisionNote: "" };
  return {
    base: raw.slice(0, idx).trim(),
    revisionNote: raw.slice(idx + FRAME_REVISION_MARKER.length).trim(),
  };
}

/**
 * Negatives for scene frames — MUST NOT ban groups/crowds (unlike avatar).
 * Used when the Deployment adapter accepts negative_prompt.
 */
export const FRAME_NEGATIVE_PROMPT = [
  "blank",
  "blank image",
  "blank canvas",
  "empty image",
  "empty canvas",
  "solid white",
  "solid white background only",
  "all white",
  "pure white",
  "whiteout",
  "overexposed wash",
  "featureless",
  "no subject",
  "text",
  "letters",
  "typography",
  "caption",
  "caption overlay",
  "subtitles",
  "title text",
  "watermark",
  "logo",
  "emblem",
  "UI",
  "HUD",
  "collage",
  "montage",
  "split screen",
  "grid layout",
  "comic panel",
  "storyboard sheet",
  "character sheet",
  "trading card",
  "ID photo",
  "passport photo",
  "headshot portrait studio",
  "neutral gray studio backdrop",
  "deformed",
  "mutated",
  "extra limbs",
  "disfigured",
].join(", ");

export function buildFrameNegativePrompt(_caption?: string): string {
  // Caption cues reserved for later (weather/crowding); keep Deployment-stable for now.
  void _caption;
  return FRAME_NEGATIVE_PROMPT;
}

export function buildFrameDraftPrompt(input: {
  caption: string;
  routeTitle?: string;
}): string {
  const { base, revisionNote } = splitFrameCaption(input.caption);
  const routeTitle = input.routeTitle?.trim() ?? "";
  const scene = (base || input.caption.trim()).trim();
  if (!scene) return "";

  const parts: string[] = [];

  // 1) Operator override first — Local models overweight early tokens.
  if (revisionNote) {
    parts.push(
      `OPERATOR OVERRIDE (must follow): ${revisionNote}.`,
      "Prefer this override over conflicting details in the scene caption."
    );
  }

  // 2) Task framing + authoritative scene meaning (caption kept verbatim, incl. 中文).
  parts.push(
    "Illustrate ONE cinematic narrative reading still that matches the scene description exactly.",
    "Faithfully depict the people, actions, place, time, weather, and mood stated below.",
    "Do not invent unrelated locations, eras, or cast; stay loyal to the given scene."
  );
  if (routeTitle) {
    parts.push(`Story setting / route title: ${routeTitle}.`);
  }
  parts.push(`Scene content (authoritative): ${scene}.`);
  // Repeat near the middle — turbo models drop mid-prompt meaning.
  parts.push(`Depict this scene: ${scene}.`);

  // 3) Visual / composition constraints (redundant on purpose for weak Local models).
  parts.push(
    "Widescreen cinematic story illustration, single coherent moment in one frame,",
    "clear focal subject and readable environment matching the description,",
    "atmospheric lighting, depth, and composition suitable for a reading-route frame,",
    "include multiple figures only when the scene description implies them,",
    "digital illustration, sharp details, high quality,",
    "no text, no letters, no typography, no caption overlay, no subtitles,",
    "no watermark, no logo, no UI chrome, no collage, no split-screen grid,",
    "not a blank canvas, not a solid white fill, not an empty picture,",
    "not a head-and-shoulders studio portrait unless the scene description asks for it."
  );

  // 4) End-anchor: many Local models overweight the final tokens.
  parts.push(`Must match scene: ${scene}.`);
  if (revisionNote) {
    parts.push(`Remember operator override: ${revisionNote}.`);
  }

  return parts.join(" ");
}
