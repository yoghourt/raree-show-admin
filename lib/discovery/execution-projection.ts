/**
 * ADR-011 A5 / SPEC-DVE-001 v1.4 — Execution Projection.
 *
 * Deterministic adaptation of Canonical Visual Expression to a Deployment
 * renderer profile. MUST NOT invent story meaning. MUST NOT run at persist.
 * Length / pixel budgets come from the model-keyed capability table.
 */

import {
  CLOUD_CAPABILITY,
  SD35_CAPABILITY,
  Z_IMAGE_TURBO_CAPABILITY,
  resolveRendererCapabilityFromEnv,
  type RendererCapability,
} from "@/lib/ai/image/rendererCapability";
import {
  adaptSceneExpressionForLocalCapability,
  isVerticalTreeCamera,
} from "@/lib/discovery/expression-capability-rules";
import type { RendererExpression } from "@/lib/discovery/visual-contract";

export type ProjectionProfile = "local" | "cloud";

/**
 * sd-3.5 rollback field caps (packActionNamingCast tests / explicit short pack).
 * Creator Default execute uses the Z-Image table, not these.
 */
export const LOCAL_VISUAL_MAX = SD35_CAPABILITY.visualMaxChars;
export const LOCAL_ACTION_MAX = SD35_CAPABILITY.actionMaxChars;
export const LOCAL_ENV_MAX = SD35_CAPABILITY.envMaxChars;
export const LOCAL_COMPOSITION_MAX = SD35_CAPABILITY.compositionMaxChars;
export const LOCAL_ROLE_MAX = SD35_CAPABILITY.roleMaxChars;
export const LOCAL_EMPHASIS_MAX = SD35_CAPABILITY.emphasisMaxChars;

/** Creator Default (Z-Image) execute body ceiling. */
export const LOCAL_PROMPT_BODY_MAX = Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars;

export function capabilityForProfile(
  profile: ProjectionProfile,
  capability?: RendererCapability
): RendererCapability {
  if (capability) return capability;
  if (profile === "cloud") return CLOUD_CAPABILITY;
  return resolveRendererCapabilityFromEnv();
}

/**
 * Word-boundary clip for execute transport. Keeps the start (pose first).
 * No ellipsis — execute strings should look complete within budget.
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

function stripExactlyFigureCues(text: string): string {
  return text
    .replace(/,?\s*exactly\s+(?:\d+|two|three|four|five|six)\s+figures?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

function capPart(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max).trim();
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

function actionRoleLabel(role: string, roleMax: number): string {
  const t = role.trim().replace(/\s+/g, " ");
  if (t.length <= roleMax) return t;
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
  maxChars: number,
  roleMax: number = LOCAL_ROLE_MAX
): string {
  const original = action.trim().replace(/\s+/g, " ");
  let next = original;
  let repaired = false;

  for (const ch of characters) {
    const full = ch.role.trim();
    const label = actionRoleLabel(full, roleMax);
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
    const label = actionRoleLabel(ch.role, roleMax);
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
      .map((ch) => `${actionRoleLabel(ch.role, roleMax)} ${firstPoseClause(ch.visual)}`)
      .filter((part) => part.trim().length > 2)
      .join(", ");
    if (compact.length > 0 && compact.length <= maxChars) return compact;
    return clipLocalBudgetText(compact || next, maxChars);
  }
  return clipLocalBudgetText(original, maxChars);
}

/**
 * Execute-only fit of Canonical Expression into a renderer capability row.
 * MUST NOT run at propose persist.
 */
export function packExpressionForTransport(
  expression: RendererExpression,
  capability: RendererCapability
): RendererExpression {
  const packed: RendererExpression = {
    environment: clipLocalBudgetText(
      expression.environment,
      capability.envMaxChars
    ),
    action: packActionNamingCast(
      expression.action,
      expression.characters,
      capability.actionMaxChars,
      capability.roleMaxChars
    ),
    composition: clipLocalBudgetText(
      expression.composition,
      capability.compositionMaxChars
    ),
    characters: expression.characters.map((c) => ({
      role: clipLocalBudgetText(c.role, capability.roleMaxChars),
      visual: clipLocalBudgetText(c.visual, capability.visualMaxChars),
    })),
  };
  if (expression.lighting?.trim()) {
    packed.lighting = clipLocalBudgetText(
      expression.lighting,
      capability.emphasisMaxChars
    );
  }
  if (expression.atmosphere?.trim()) {
    packed.atmosphere = clipLocalBudgetText(
      expression.atmosphere,
      capability.emphasisMaxChars
    );
  }
  if (expression.threatPerception?.trim()) {
    packed.threatPerception = clipLocalBudgetText(
      expression.threatPerception,
      capability.emphasisMaxChars
    );
  }
  if (expression.visualEmphasis?.trim()) {
    packed.visualEmphasis = clipLocalBudgetText(
      expression.visualEmphasis,
      capability.emphasisMaxChars
    );
  }
  if (expression.styleHints?.trim()) {
    packed.styleHints = clipLocalBudgetText(
      expression.styleHints,
      capability.emphasisMaxChars
    );
  }
  return packed;
}

/** @deprecated execute-only; prefer packExpressionForTransport(capability). */
export function packExpressionForLocalTransport(
  expression: RendererExpression,
  capability: RendererCapability = resolveRendererCapabilityFromEnv()
): RendererExpression {
  return packExpressionForTransport(expression, capability);
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
  const provider = (env.IMAGE_CREATOR_ACCEPT_PROVIDER ?? "local").trim();
  return resolveProjectionProfile(provider);
}

/**
 * Apply Deployment-profile rewrites to Canonical Expression.
 * Local: blank-avoidance adapt (former propose-time adapt).
 * Cloud: identity (preserve authored composition + optional cues).
 */
export function projectExpressionForDeployment(
  expression: RendererExpression,
  profile: ProjectionProfile,
  capability?: RendererCapability
): RendererExpression {
  if (profile === "local") {
    const cap = capabilityForProfile(profile, capability);
    return adaptSceneExpressionForLocalCapability(expression, {
      visualMaxChars: cap.visualMaxChars,
      actionMaxChars: cap.actionMaxChars,
      envMaxChars: cap.envMaxChars,
      compositionMaxChars: cap.compositionMaxChars,
    });
  }
  return expression;
}

/**
 * Canonical Expression → Image Port prompt string for a Deployment profile.
 * MUST NOT read Visual Intent. MUST NOT invent story meaning.
 */
export function expressionToPrompt(
  expression: RendererExpression,
  profile: ProjectionProfile,
  capability?: RendererCapability
): string {
  const cap = capabilityForProfile(profile, capability);
  const projected = projectExpressionForDeployment(expression, profile, cap);
  if (profile === "local") {
    return joinLocalPrompt(projected, cap);
  }
  return joinCloudPrompt(projected);
}

function isStubCastVisual(visual: string): boolean {
  const t = visual.trim();
  if (!t) return true;
  return /^character present$/i.test(t);
}

const GARMENT_TOKEN =
  /\b(cloak|hood|robe|armor|armour|gown|tunic|mail|shroud|fur|jerkin|collar)\b/gi;

function garmentTokens(visual: string): Set<string> {
  return new Set(
    [...visual.toLowerCase().matchAll(GARMENT_TOKEN)].map((m) => m[1]!)
  );
}

/** Dual/multi-cast Local prior: copy the first figure's cloak onto everyone. */
function castNeedsCostumeContrast(visuals: string[]): boolean {
  if (visuals.length < 2) return false;
  const sets = visuals.map(garmentTokens);
  if (sets.every((s) => s.size === 0)) return false;
  const first = sets[0]!;
  for (const other of sets.slice(1)) {
    if (other.size !== first.size) return true;
    for (const token of first) {
      if (!other.has(token)) return true;
    }
    for (const token of other) {
      if (!first.has(token)) return true;
    }
  }
  return false;
}

function rolePrefixedVisual(
  role: string,
  visual: string,
  cap: RendererCapability
): string {
  const name = clipLocalBudgetText(role.trim(), cap.roleMaxChars);
  const body = clipLocalBudgetText(
    stripExactlyFigureCues(capPart(visual, cap.visualMaxChars)),
    cap.visualMaxChars
  );
  if (!body || isStubCastVisual(body)) return "";
  if (!name) return body;
  if (new RegExp(`^${escapeRegExp(name)}\\b`, "i").test(body)) {
    return body;
  }
  return clipLocalBudgetText(
    `${name} ${body}`,
    cap.visualMaxChars + cap.roleMaxChars
  );
}

function joinLocalPrompt(
  re: RendererExpression,
  cap: RendererCapability
): string {
  const visuals = (re.characters ?? [])
    .map((c) => rolePrefixedVisual(c.role, c.visual, cap))
    .filter(Boolean);

  const action = packActionNamingCast(
    stripExactlyFigureCues(capPart(re.action ?? "", cap.actionMaxChars * 2)),
    re.characters ?? [],
    cap.actionMaxChars,
    cap.roleMaxChars
  );
  const composition = clipLocalBudgetText(
    stripExactlyFigureCues(
      capPart(re.composition ?? "", cap.compositionMaxChars)
    ),
    cap.compositionMaxChars
  );
  const contrast = castNeedsCostumeContrast(visuals)
    ? "different silhouettes, not matching outfits"
    : "";
  const perch = isVerticalTreeCamera(re) ? "living perch not a fallen log" : "";
  const environment = clipLocalBudgetText(
    stripExactlyFigureCues(capPart(re.environment ?? "", cap.envMaxChars)),
    cap.envMaxChars
  );
  const emphasis = re.visualEmphasis?.trim()
    ? clipLocalBudgetText(
        stripExactlyFigureCues(
          capPart(re.visualEmphasis.trim(), cap.emphasisMaxChars)
        ),
        cap.emphasisMaxChars
      )
    : "";

  return packLocalPromptBody(
    {
      visuals,
      action,
      environment,
      composition,
      perch,
      contrast,
      emphasis,
    },
    cap
  );
}

function assembleLocalPromptBody(parts: {
  visuals: string[];
  action: string;
  environment: string;
  composition: string;
  perch: string;
  contrast: string;
  emphasis: string;
}): string {
  const cast = parts.visuals.join("; ");
  const dual = parts.visuals.length >= 2;
  const joined = (
    dual
      ? [
          parts.action,
          cast,
          parts.environment,
          parts.composition,
          parts.perch,
          parts.contrast,
          parts.emphasis,
        ]
      : [
          cast,
          parts.action,
          parts.environment,
          parts.composition,
          parts.perch,
          parts.contrast,
          parts.emphasis,
        ]
  ).filter(Boolean);
  if (!joined.length) return "";
  return `${joined.join(". ")}.`;
}

function packLocalPromptBody(
  parts: {
    visuals: string[];
    action: string;
    environment: string;
    composition: string;
    perch: string;
    contrast: string;
    emphasis: string;
  },
  cap: RendererCapability
): string {
  const bodyMax = cap.promptBodyMaxChars;
  let next = { ...parts, visuals: [...parts.visuals] };
  let body = assembleLocalPromptBody(next);
  if (body.length <= bodyMax) return body;

  next.emphasis = "";
  body = assembleLocalPromptBody(next);
  if (body.length <= bodyMax) return body;

  next.environment = clipLocalBudgetText(
    next.environment,
    Math.max(32, Math.floor(cap.envMaxChars * 0.6))
  );
  body = assembleLocalPromptBody(next);
  if (body.length <= bodyMax) return body;

  next.visuals = next.visuals.map((visual) =>
    clipLocalBudgetText(visual, Math.max(48, Math.floor(cap.visualMaxChars * 0.5)))
  );
  body = assembleLocalPromptBody(next);
  if (body.length <= bodyMax) return body;

  const withoutAction = assembleLocalPromptBody({ ...next, action: "" });
  const actionBudget = bodyMax - withoutAction.length;
  next.action = clipLocalBudgetText(
    next.action,
    Math.max(Math.floor(cap.actionMaxChars * 0.25), actionBudget)
  );
  return assembleLocalPromptBody(next);
}

function joinCloudPrompt(re: RendererExpression): string {
  const cloudCap = CLOUD_CAPABILITY;
  const cast = (re.characters ?? [])
    .map((c) => {
      const role = capPart(c.role.trim(), cloudCap.roleMaxChars);
      const visual = stripExactlyFigureCues(
        capPart(c.visual, cloudCap.visualMaxChars)
      );
      return `${role}: ${visual}`;
    })
    .join("; ");

  const action = stripExactlyFigureCues(
    capPart(re.action ?? "", cloudCap.actionMaxChars)
  );
  const composition = stripExactlyFigureCues(
    capPart(re.composition ?? "", cloudCap.compositionMaxChars)
  );
  const environment = stripExactlyFigureCues(
    capPart(re.environment ?? "", cloudCap.envMaxChars)
  );

  const parts = [
    cast && `Characters: ${cast}.`,
    action && `Action: ${action}.`,
    environment && `Environment: ${environment}.`,
    composition && `Composition: ${composition}.`,
    re.lighting?.trim() &&
      `Lighting: ${capPart(re.lighting.trim(), cloudCap.emphasisMaxChars)}.`,
    re.styleHints?.trim() &&
      `Style: ${capPart(re.styleHints.trim(), cloudCap.emphasisMaxChars)}.`,
    re.atmosphere?.trim() &&
      `Atmosphere: ${capPart(re.atmosphere.trim(), cloudCap.emphasisMaxChars)}.`,
    re.threatPerception?.trim() &&
      `Threat: ${capPart(re.threatPerception.trim(), cloudCap.emphasisMaxChars)}.`,
    re.visualEmphasis?.trim() &&
      `Visual emphasis: ${capPart(re.visualEmphasis.trim(), cloudCap.emphasisMaxChars)}.`,
  ].filter(Boolean);

  const body = parts.join(" ").trim();
  if (!body) return "";
  return `${body} Single narrative still. No text, no watermark.`;
}

/** Scene frame pixel size for Deployment profile (A5). */
export function sceneFrameSizeForProfile(
  profile: ProjectionProfile,
  capability?: RendererCapability
): {
  width: number;
  height: number;
} {
  const cap = capabilityForProfile(profile, capability);
  return { width: cap.width, height: cap.height };
}
