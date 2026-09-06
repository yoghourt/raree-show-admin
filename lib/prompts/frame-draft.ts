/**
 * Server-only Scene Frame draft prompt (derived Job input — not Runtime Truth).
 * Prefer Visual Expression (SPEC-DVE-001 / ADR-011 A5); caption is legacy fallback.
 * Visual Intent MUST NOT be passed here.
 *
 * Expression path: Execution Projection by Deployment profile (A5).
 * Local caption fallback: short single-pass beat.
 * Expression execute body is clipped to the model capability table.
 * Cloud caption path: denser wrapper for caption-only frames.
 *
 * Operator revision notes (`[操作员修改意见] …`) are promoted to the front —
 * trailing Chinese notes lose to early English style tokens.
 */

import type { RendererCapability } from "@/lib/ai/image/rendererCapability";
import {
  expressionToPrompt,
  resolveProjectionProfileFromEnv,
  type ProjectionProfile,
} from "@/lib/discovery/execution-projection";
import {
  executableRendererExpression,
  type RendererExpression,
} from "@/lib/discovery/visual-contract";
import { isVerticalTreeCamera } from "@/lib/discovery/expression-capability-rules";
import {
  forbidsFromUnlabeledNegations,
  forbidsFromWorkVisualConvention,
  stripPositiveNegations,
  workVisualConventionPromptBlock,
} from "@/lib/prompts/work-visual-convention";

export const FRAME_REVISION_MARKER = "[操作员修改意见]";

/** Local caption beat budget — keep total prompt under Local blank threshold. */
export const LOCAL_CAPTION_SCENE_MAX = 240;
const LOCAL_CAPTION_REVISION_MAX = 120;

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
  "children's textbook",
  "schoolbook illustration",
  "storybook for children",
  "chinese calligraphy",
  "plaque text",
  "signboard text",
  "written characters",
  "hanzi on sign",
  "readable writing",
  "blurry faces",
  "out of focus faces",
  "smoothed faces",
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
  options?: {
    castCount?: number;
    workVisualConvention?: string;
    rendererExpression?: RendererExpression | null;
  }
): string {
  void _caption;
  const forbids = forbidsFromWorkVisualConvention(
    options?.workVisualConvention ?? ""
  );
  const extra = [
    "floating text",
    "diagram labels",
    "title card",
    "poster title",
    "framed illustration",
    "white border",
    "letterbox",
    "inset frame",
    "picture frame",
    "camouflage",
    "olive drab",
    "modern military",
    "woodland camo",
    ...forbids,
    ...forbidsFromUnlabeledNegations(expressionForbidBlob(options?.rendererExpression)),
  ];
  if (
    options?.rendererExpression &&
    isVerticalTreeCamera(options.rendererExpression)
  ) {
    extra.push(
      "fallen log perch",
      "standing on a fallen trunk",
      "matching hooded cloaks",
      "identical outfits",
      "two matching cloaks"
    );
  }
  const cast = options?.castCount;
  if (cast === 2) {
    return [
      FRAME_NEGATIVE_PROMPT,
      ...extra,
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
      ...extra,
      "two people",
      "couple",
      "extra person",
      "crowd",
    ].join(", ");
  }
  return extra.length
    ? `${FRAME_NEGATIVE_PROMPT}, ${extra.join(", ")}`
    : FRAME_NEGATIVE_PROMPT;
}

function expressionForbidBlob(
  expression?: RendererExpression | null
): string {
  if (!expression) return "";
  return [
    expression.action,
    expression.composition,
    expression.visualEmphasis ?? "",
    ...(expression.characters ?? []).map((c) => c.visual),
  ].join(". ");
}

function conventionLead(convention?: string): string | null {
  const block = workVisualConventionPromptBlock(convention);
  return block || null;
}

/**
 * Expression → prompt via Execution Projection; optional operator override / route title.
 */
function buildExpressionPrompt(input: {
  expression: RendererExpression;
  revisionNote: string;
  routeTitle: string;
  projectionProfile: ProjectionProfile;
  workVisualConvention?: string;
  capability?: RendererCapability;
}): string {
  const body = expressionToPrompt(
    input.expression,
    input.projectionProfile,
    input.capability
  ).trim();
  if (!body) return "";

  const parts: string[] = [];
  if (input.revisionNote) {
    parts.push(`OPERATOR OVERRIDE (must follow): ${input.revisionNote}.`);
  }
  parts.push(body);
  const convention = conventionLead(input.workVisualConvention);
  if (convention) {
    parts.push(convention);
  }
  // Local: omit routeTitle — Setting strings render as plaque / title cards.
  if (input.projectionProfile !== "local") {
    const routeTitle = input.routeTitle.trim();
    if (routeTitle) {
      parts.push(`Setting: ${routeTitle}.`);
    }
  }
  return parts.join(" ");
}

function hardCapCaption(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("; "),
    cut.lastIndexOf(", "),
    cut.lastIndexOf(" ")
  );
  return `${(at > max * 0.4 ? cut.slice(0, at) : cut).trim()}…`;
}

/**
 * Caption beats like "recruitment notice" / 告示 cause Z-Image to paint glyphs.
 * Rewrite to unmarked props; strip quoted strings that become title calligraphy.
 */
export function sanitizeLocalSceneCaptionForGlyphRisk(scene: string): string {
  let s = scene;
  s = s.replace(/[「『][^」』]{0,40}[」』]/g, "unmarked surface");
  s = s.replace(/["“”][^"“”]{0,40}["“”]/g, "unmarked surface");
  const rewrites: Array<[RegExp, string]> = [
    [/recruitment\s+notice/gi, "blank unmarked board with no writing"],
    [/official\s+notice/gi, "blank unmarked board with no writing"],
    [/notice\s+board/gi, "unmarked board without letters"],
    [/notice\s+pinned/gi, "blank paper pinned without letters"],
    [/\bproclamation\b/gi, "blank unmarked surface without writing"],
    [/\binscription\b/gi, "unmarked surface"],
    [/\bsignage\b/gi, "blank hanging board without letters"],
    [/告示|榜文|檄文|诏书|招牌|牌匾|文书/g, "空白无字板面"],
  ];
  for (const [re, rep] of rewrites) {
    s = s.replace(re, rep);
  }
  return s;
}

/**
 * Local caption fallback — single beat, no triple-repeat wrapper.
 * Dense Cloud caption wrappers blank Local (promptLen 1.1k–1.7k observed).
 * Omit routeTitle: long Setting strings often render as plaque / title text on Z-Image.
 */
function buildLocalCaptionPrompt(input: {
  scene: string;
  revisionNote: string;
  routeTitle: string;
  workVisualConvention?: string;
}): string {
  void input.routeTitle;
  const scene = hardCapCaption(
    sanitizeLocalSceneCaptionForGlyphRisk(input.scene),
    LOCAL_CAPTION_SCENE_MAX
  );
  const revision = input.revisionNote
    ? hardCapCaption(input.revisionNote, LOCAL_CAPTION_REVISION_MAX)
    : "";

  const parts: string[] = [];
  if (revision) {
    parts.push(`OPERATOR OVERRIDE (must follow): ${revision}.`);
  }
  parts.push(`Scene: ${scene}.`);
  const convention = conventionLead(input.workVisualConvention);
  if (convention) {
    parts.push(convention);
  }
  // Avoid "digital illustration" alone — Local turbo drifts to children's textbook look.
  parts.push(
    "Cinematic narrative painting, adult tone,",
    "painterly atmosphere, not a children's textbook, not a schoolbook illustration."
  );
  return parts.join(" ");
}

/**
 * Cloud / legacy caption path — denser wrapper for caption-only frames.
 */
function buildCaptionLegacyPrompt(input: {
  scene: string;
  revisionNote: string;
  routeTitle: string;
  workVisualConvention?: string;
}): string {
  const parts: string[] = [];

  if (input.revisionNote) {
    parts.push(
      `OPERATOR OVERRIDE (must follow): ${input.revisionNote}.`,
      "Prefer this override over conflicting details in the scene description."
    );
  }
  const convention = conventionLead(input.workVisualConvention);
  if (convention) {
    parts.push(convention);
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

  return parts.join(" ");
}

export function buildFrameDraftPrompt(input: {
  caption: string;
  routeTitle?: string;
  /** When present and executable, authoritative scene content (PA-A). Caption used only for revision notes / legacy. Stub placeholders (empty scene) fall back to caption. */
  rendererExpression?: RendererExpression | null;
  /** A5 Deployment profile; defaults from IMAGE_CREATOR_ACCEPT_PROVIDER. */
  projectionProfile?: ProjectionProfile;
  /** Model-keyed execute budgets; defaults from Deployment env. */
  capability?: RendererCapability;
  /** Creator-only work convention (era/style/forbids). Must not override the caption beat. */
  workVisualConvention?: string;
}): string {
  const { base, revisionNote } = splitFrameCaption(input.caption);
  const routeTitle = input.routeTitle?.trim() ?? "";
  const projectionProfile =
    input.projectionProfile ?? resolveProjectionProfileFromEnv();
  const workVisualConvention = input.workVisualConvention;

  const executable = executableRendererExpression(input.rendererExpression);
  if (executable) {
    const prompt = buildExpressionPrompt({
      expression: executable,
      revisionNote,
      routeTitle,
      projectionProfile,
      workVisualConvention,
      capability: input.capability,
    });
    return projectionProfile === "local" ? stripPositiveNegations(prompt) : prompt;
  }

  const scene = (base || input.caption.trim()).trim();
  if (!scene) return "";

  if (projectionProfile === "local") {
    return stripPositiveNegations(
      buildLocalCaptionPrompt({
        scene,
        revisionNote,
        routeTitle,
        workVisualConvention,
      })
    );
  }

  return buildCaptionLegacyPrompt({
    scene,
    revisionNote,
    routeTitle,
    workVisualConvention,
  });
}
