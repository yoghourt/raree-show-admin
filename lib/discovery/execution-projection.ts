/**
 * ADR-011 A5 / SPEC-DVE-001 v1.4 — Execution Projection.
 *
 * Deterministic adaptation of Canonical Visual Expression to a Deployment
 * renderer profile. MUST NOT invent story meaning. MUST NOT run at persist.
 */

import {
  adaptSceneExpressionForLocalCapability,
  isVerticalTreeCamera,
} from "@/lib/discovery/expression-capability-rules";
import type { RendererExpression } from "@/lib/discovery/visual-contract";

export type ProjectionProfile = "local" | "cloud";

const MAX_PROMPT_PART_LEN = 400;
/** Local sd-3.5-medium blanks above ~600 chars — keep Local transport lean. */
export const LOCAL_VISUAL_MAX = 80;
export const LOCAL_ACTION_MAX = 96;
export const LOCAL_ENV_MAX = 80;
export const LOCAL_COMPOSITION_MAX = 72;
export const LOCAL_ROLE_MAX = 28;
export const LOCAL_EMPHASIS_MAX = 72;

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

/**
 * Word-boundary clip for Local transport. Keeps the start (pose must be authored first).
 * No ellipsis — stored Expression should look complete within budget.
 */
export function clipLocalBudgetText(text: string, maxChars: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars);
  const cut = Math.max(slice.lastIndexOf(","), slice.lastIndexOf(" "), 0);
  return (cut > maxChars * 0.5 ? slice.slice(0, cut) : slice)
    .trim()
    .replace(/[,:;]+$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstPoseClause(visual: string): string {
  return visual.split(",")[0]?.trim().replace(/\s+/g, " ") || "standing";
}

function shortRole(role: string): string {
  return role.trim().split(/\s+/).filter(Boolean)[0] || role.trim();
}

function actionRoleLabel(role: string): string {
  const t = role.trim().replace(/\s+/g, " ");
  if (t.length <= LOCAL_ROLE_MAX) return t;
  return shortRole(t);
}

/**
 * Keep every cast member's pose in action. Trailing bare names ("; Lü Bu")
 * get their visual's first pose; if still over budget, rebuild a compact
 * "{role} {pose}" list so the last figure is not clipped off.
 */
export function packActionNamingCast(
  action: string,
  characters: Array<{ role: string; visual: string }>,
  maxChars: number
): string {
  const original = action.trim().replace(/\s+/g, " ");
  let next = original;
  let repaired = false;

  for (const ch of characters) {
    const full = ch.role.trim();
    const label = actionRoleLabel(full);
    if (label.length < 2) continue;
    const trailing = new RegExp(
      `([;,]\\s*)(${escapeRegExp(full)}|${escapeRegExp(shortRole(full))})\\s*$`,
      "i"
    );
    if (trailing.test(next)) {
      next = next.replace(trailing, `$1${label} ${firstPoseClause(ch.visual)}`);
      repaired = true;
    }
  }

  for (const ch of characters) {
    const label = actionRoleLabel(ch.role);
    if (label.length < 2) continue;
    if (new RegExp(`\\b${escapeRegExp(shortRole(ch.role))}\\b`, "i").test(next)) {
      continue;
    }
    next = next
      ? `${next}, ${label} ${firstPoseClause(ch.visual)}`
      : `${label} ${firstPoseClause(ch.visual)}`;
    repaired = true;
  }

  if (next.length <= maxChars) return next;
  if (repaired) {
    const compact = characters
      .map((ch) => `${actionRoleLabel(ch.role)} ${firstPoseClause(ch.visual)}`)
      .filter((part) => part.trim().length > 2)
      .join(", ");
    if (compact.length > 0 && compact.length <= maxChars) return compact;
    return clipLocalBudgetText(compact || next, maxChars);
  }
  return clipLocalBudgetText(original, maxChars);
}

/**
 * Fit Canonical Expression into Local execute field budgets.
 * Used by Creator Expression propose so pose/blocking is not left-clipped at generate.
 */
export function packExpressionForLocalTransport(
  expression: RendererExpression
): RendererExpression {
  const packed: RendererExpression = {
    environment: clipLocalBudgetText(expression.environment, LOCAL_ENV_MAX),
    action: packActionNamingCast(
      expression.action,
      expression.characters,
      LOCAL_ACTION_MAX
    ),
    composition: clipLocalBudgetText(
      expression.composition,
      LOCAL_COMPOSITION_MAX
    ),
    characters: expression.characters.map((c) => ({
      role: clipLocalBudgetText(c.role, LOCAL_ROLE_MAX),
      visual: clipLocalBudgetText(c.visual, LOCAL_VISUAL_MAX),
    })),
  };
  if (expression.lighting?.trim()) {
    packed.lighting = clipLocalBudgetText(
      expression.lighting,
      LOCAL_EMPHASIS_MAX
    );
  }
  if (expression.atmosphere?.trim()) {
    packed.atmosphere = clipLocalBudgetText(
      expression.atmosphere,
      LOCAL_EMPHASIS_MAX
    );
  }
  if (expression.threatPerception?.trim()) {
    packed.threatPerception = clipLocalBudgetText(
      expression.threatPerception,
      LOCAL_EMPHASIS_MAX
    );
  }
  if (expression.visualEmphasis?.trim()) {
    packed.visualEmphasis = clipLocalBudgetText(
      expression.visualEmphasis,
      LOCAL_EMPHASIS_MAX
    );
  }
  if (expression.styleHints?.trim()) {
    packed.styleHints = clipLocalBudgetText(
      expression.styleHints,
      LOCAL_EMPHASIS_MAX
    );
  }
  return packed;
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

function isStubCastVisual(visual: string): boolean {
  const t = visual.trim();
  if (!t) return true;
  return /^character present$/i.test(t);
}

const GARMENT_TOKEN =
  /\b(cloak|hood|robe|armor|armour|gown|tunic|mail|shroud)\b/gi;

function garmentTokens(visual: string): Set<string> {
  return new Set(
    [...visual.toLowerCase().matchAll(GARMENT_TOKEN)].map((m) => m[1]!)
  );
}

/** Dual-cast Local prior: copy the first figure's cloak onto everyone. */
function dualCastNeedsCostumeContrast(visuals: string[]): boolean {
  if (visuals.length !== 2) return false;
  const a = garmentTokens(visuals[0]!);
  const b = garmentTokens(visuals[1]!);
  if (a.size === 0 && b.size === 0) return false;
  if (a.size !== b.size) return true;
  for (const token of a) {
    if (!b.has(token)) return true;
  }
  return false;
}

function joinLocalPrompt(re: RendererExpression): string {
  const visuals = (re.characters ?? [])
    .map((c) =>
      hardCap(stripExactlyFigureCues(capPart(c.visual)), LOCAL_VISUAL_MAX)
    )
    .filter((visual) => !isStubCastVisual(visual));
  const cast = visuals.join("; ");

  let action = stripExactlyFigureCues(capPart(re.action ?? ""));
  action = hardCap(action, LOCAL_ACTION_MAX);

  const composition = hardCap(
    stripExactlyFigureCues(capPart(re.composition ?? "")),
    LOCAL_COMPOSITION_MAX
  );
  const contrast = dualCastNeedsCostumeContrast(visuals)
    ? "not matching outfits"
    : "";
  const perch = isVerticalTreeCamera(re) ? "living perch not a fallen log" : "";

  const environment = hardCap(
    stripExactlyFigureCues(capPart(re.environment ?? "")),
    LOCAL_ENV_MAX
  );
  const emphasis = re.visualEmphasis?.trim()
    ? hardCap(stripExactlyFigureCues(capPart(re.visualEmphasis.trim())), LOCAL_EMPHASIS_MAX)
    : "";

  const parts = [
    cast,
    action,
    environment,
    composition,
    perch,
    contrast,
    emphasis,
  ].filter(Boolean);
  if (!parts.length) return "";
  return `${parts.join(". ")}.`;
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
