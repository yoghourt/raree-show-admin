/**
 * Server-only Scene Frame draft prompt (derived Job input — not Runtime Truth).
 * Prefer Visual Expression (SPEC-DVE-001 / ADR-011 A5); caption is legacy fallback.
 * Visual Intent MUST NOT be passed here.
 *
 * Expression path: Execution Projection by Deployment profile (A5).
 * Caption-legacy path: denser wrapper kept for weaker caption-only inputs.
 *
 * Operator revision notes (`[操作员修改意见] …`) are promoted to the front —
 * trailing Chinese notes lose to early English style tokens.
 */

import {
  expressionToPrompt,
  resolveProjectionProfileFromEnv,
  type ProjectionProfile,
} from "@/lib/discovery/execution-projection";
import type { RendererExpression } from "@/lib/discovery/visual-contract";

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
  // A4 — bias Local away from spectacle physics blanks (Deployment negatives only).
  "motion blur",
  "mid-air action",
  "flying debris",
  "shattered fragments",
  "exploding",
].join(", ");

export function buildFrameNegativePrompt(
  _caption?: string,
  options?: { castCount?: number }
): string {
  void _caption;
  const cast = options?.castCount;
  if (cast === 2) {
    return [
      FRAME_NEGATIVE_PROMPT,
      "three people",
      "three figures",
      "group of three",
      "extra person",
      "crowd",
      "solo portrait",
      "single person",
      "one person only",
      "looking at camera",
      "facing the viewer",
      "sand map",
      "terrain map",
    ].join(", ");
  }
  if (cast === 1) {
    return [
      FRAME_NEGATIVE_PROMPT,
      "two people",
      "couple",
      "extra person",
      "crowd",
    ].join(", ");
  }
  return FRAME_NEGATIVE_PROMPT;
}

/**
 * Expression → prompt via Execution Projection; optional operator override / route title.
 */
function buildExpressionPrompt(input: {
  expression: RendererExpression;
  revisionNote: string;
  routeTitle: string;
  projectionProfile: ProjectionProfile;
}): string {
  const body = expressionToPrompt(
    input.expression,
    input.projectionProfile
  ).trim();
  if (!body) return "";

  const parts: string[] = [];
  if (input.revisionNote) {
    parts.push(`OPERATOR OVERRIDE (must follow): ${input.revisionNote}.`);
  }
  if (input.routeTitle) {
    parts.push(`Setting: ${input.routeTitle}.`);
  }
  parts.push(body);
  if (input.revisionNote) {
    parts.push(`Remember operator override: ${input.revisionNote}.`);
  }
  return parts.join(" ");
}

/**
 * Legacy caption path — denser wrapper for caption-only frames (no Expression).
 */
function buildCaptionLegacyPrompt(input: {
  scene: string;
  revisionNote: string;
  routeTitle: string;
}): string {
  const parts: string[] = [];

  if (input.revisionNote) {
    parts.push(
      `OPERATOR OVERRIDE (must follow): ${input.revisionNote}.`,
      "Prefer this override over conflicting details in the scene description."
    );
  }

  parts.push(
    "Illustrate ONE cinematic narrative reading still that matches the scene description exactly.",
    "Faithfully depict the people, actions, place, time, weather, and mood stated below.",
    "Do not invent unrelated locations, eras, or cast; stay loyal to the given scene."
  );
  if (input.routeTitle) {
    parts.push(`Story setting / route title: ${input.routeTitle}.`);
  }
  parts.push(`Scene content (authoritative): ${input.scene}.`);
  parts.push(`Depict this scene: ${input.scene}.`);

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

  parts.push(`Must match scene: ${input.scene}.`);
  if (input.revisionNote) {
    parts.push(`Remember operator override: ${input.revisionNote}.`);
  }

  return parts.join(" ");
}

export function buildFrameDraftPrompt(input: {
  caption: string;
  routeTitle?: string;
  /** When present, authoritative scene content (PA-A). Caption used only for revision notes / legacy. */
  rendererExpression?: RendererExpression | null;
  /** A5 Deployment profile; defaults from IMAGE_CREATOR_ACCEPT_PROVIDER. */
  projectionProfile?: ProjectionProfile;
}): string {
  const { base, revisionNote } = splitFrameCaption(input.caption);
  const routeTitle = input.routeTitle?.trim() ?? "";

  if (input.rendererExpression) {
    return buildExpressionPrompt({
      expression: input.rendererExpression,
      revisionNote,
      routeTitle,
      projectionProfile:
        input.projectionProfile ?? resolveProjectionProfileFromEnv(),
    });
  }

  const scene = (base || input.caption.trim()).trim();
  if (!scene) return "";

  return buildCaptionLegacyPrompt({ scene, revisionNote, routeTitle });
}
