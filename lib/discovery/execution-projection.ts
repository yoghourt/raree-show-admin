/**
 * ADR-011 A5 / SPEC-DVE-001 v1.4 — Execution Projection.
 *
 * Deterministic adaptation of Canonical Visual Expression to a Deployment
 * renderer profile. MUST NOT invent story meaning. MUST NOT run at persist.
 */

import { adaptSceneExpressionForLocalCapability } from "@/lib/discovery/expression-capability-rules";
import type { RendererExpression } from "@/lib/discovery/visual-contract";

export type ProjectionProfile = "local" | "cloud";

const MAX_PROMPT_PART_LEN = 400;
/** Local sd-3.5-medium blanks above ~600 chars — keep Local transport lean. */
const LOCAL_VISUAL_MAX = 64;
const LOCAL_ACTION_MAX = 96;
const LOCAL_ENV_MAX = 72;
const LOCAL_COMPOSITION_MAX = 72;
const LOCAL_ROLE_MAX = 28;

function capPart(value: string): string {
  if (value.length <= MAX_PROMPT_PART_LEN) return value;
  return value.slice(0, MAX_PROMPT_PART_LEN).trim();
}

function stripExactlyFigureCues(text: string): string {
  return text
    .replace(/,?\s*exactly\s+(?:\d+|two|three|four|five|six)\s+figures?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

function hardCap(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

/** Map IMAGE_CREATOR_ACCEPT_PROVIDER id → projection profile. */
export function resolveProjectionProfile(providerId: string): ProjectionProfile {
  const id = providerId.trim().toLowerCase();
  if (id === "local" || id === "localai") return "local";
  return "cloud";
}

/** Default profile from Deployment env (spikes / legacy callers). */
export function resolveProjectionProfileFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ProjectionProfile {
  const provider = (
    env.IMAGE_CREATOR_ACCEPT_PROVIDER ?? "local"
  ).trim();
  return resolveProjectionProfile(provider);
}

/**
 * Apply Deployment-profile rewrites to Canonical Expression.
 * Local: blank-avoidance adapt (former propose-time adapt).
 * Cloud: identity (preserve authored composition + optional cues).
 */
export function projectExpressionForDeployment(
  expression: RendererExpression,
  profile: ProjectionProfile
): RendererExpression {
  if (profile === "local") {
    return adaptSceneExpressionForLocalCapability(expression);
  }
  return expression;
}

/**
 * Canonical Expression → Image Port prompt string for a Deployment profile.
 * MUST NOT read Visual Intent. MUST NOT invent story meaning.
 */
export function expressionToPrompt(
  expression: RendererExpression,
  profile: ProjectionProfile
): string {
  const projected = projectExpressionForDeployment(expression, profile);
  if (profile === "local") {
    return joinLocalPrompt(projected);
  }
  return joinCloudPrompt(projected);
}

function joinLocalPrompt(re: RendererExpression): string {
  const castLen = re.characters?.length ?? 0;
  const cast = (re.characters ?? [])
    .map((c) => {
      const role = hardCap(capPart(c.role), LOCAL_ROLE_MAX);
      const visual = hardCap(
        stripExactlyFigureCues(capPart(c.visual)),
        LOCAL_VISUAL_MAX
      );
      return `${role}: ${visual}`;
    })
    .join("; ");

  let action = stripExactlyFigureCues(capPart(re.action ?? ""));
  action = hardCap(action, LOCAL_ACTION_MAX);

  let composition = stripExactlyFigureCues(capPart(re.composition ?? ""));
  if (castLen === 2) {
    composition =
      "medium wide shot, both figures fully visible, profiles or looking down";
  } else if (castLen > 2) {
    if (
      composition.length > LOCAL_COMPOSITION_MAX ||
      !/\bmedium[\s-]?wide\b|\bwide\s+shot\b/i.test(composition)
    ) {
      composition = "medium wide shot, faces secondary";
    } else {
      composition = hardCap(composition, LOCAL_COMPOSITION_MAX);
    }
  } else {
    composition = hardCap(composition, LOCAL_COMPOSITION_MAX);
  }

  const environment = hardCap(
    stripExactlyFigureCues(capPart(re.environment ?? "")),
    LOCAL_ENV_MAX
  );

  const parts = [
    cast && `Characters: ${cast}.`,
    action && `Action: ${action}.`,
    environment && `Environment: ${environment}.`,
    composition && `Composition: ${composition}.`,
    // lighting / atmosphere / threat / styleHints omitted (Local profile)
  ].filter(Boolean);

  const body = parts.join(" ").trim();
  if (!body) return "";
  return `${body} No extra people. Frozen still, no text, no watermark.`;
}

function joinCloudPrompt(re: RendererExpression): string {
  const cast = (re.characters ?? [])
    .map((c) => {
      const role = capPart(c.role.trim());
      const visual = stripExactlyFigureCues(capPart(c.visual));
      return `${role}: ${visual}`;
    })
    .join("; ");

  const action = stripExactlyFigureCues(capPart(re.action ?? ""));
  const composition = stripExactlyFigureCues(capPart(re.composition ?? ""));
  const environment = stripExactlyFigureCues(capPart(re.environment ?? ""));

  const parts = [
    cast && `Characters: ${cast}.`,
    action && `Action: ${action}.`,
    environment && `Environment: ${environment}.`,
    composition && `Composition: ${composition}.`,
    re.lighting?.trim() && `Lighting: ${capPart(re.lighting.trim())}.`,
    re.styleHints?.trim() && `Style: ${capPart(re.styleHints.trim())}.`,
    re.atmosphere?.trim() && `Atmosphere: ${capPart(re.atmosphere.trim())}.`,
    re.threatPerception?.trim() &&
      `Threat: ${capPart(re.threatPerception.trim())}.`,
    re.visualEmphasis?.trim() &&
      `Visual emphasis: ${capPart(re.visualEmphasis.trim())}.`,
  ].filter(Boolean);

  const body = parts.join(" ").trim();
  if (!body) return "";
  return `${body} Single narrative still. No text, no watermark.`;
}

/** Scene frame pixel size for Deployment profile (A5). */
export function sceneFrameSizeForProfile(profile: ProjectionProfile): {
  width: number;
  height: number;
} {
  if (profile === "cloud") return { width: 1024, height: 1024 };
  return { width: 512, height: 512 };
}
