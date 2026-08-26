/**
 * SPEC-DVE-001 / ADR-011 A3–A5 — Discovery Visual Intent + Visual Expression.
 *
 * Intent = narrative meaning (NOT Renderer / Port input).
 * Expression = Canonical visible form (provider-independent).
 * Execution Projection (see execution-projection.ts) adapts Expression at execute time.
 * A4: prefer static visible geometry; flag complex physics cues (propose hard-gates).
 * A5: Local caps/omits belong to Projection — not Canonical authorship.
 */

import {
  expressionToPrompt,
  resolveProjectionProfileFromEnv,
} from "@/lib/discovery/execution-projection";
import {
  assessSceneFaceSafety,
  findCastConsistencyErrors,
  findForbiddenPhysicsCues,
  findRestrictedFullFaceSceneCues,
  missingMultiCharacterPlacement,
} from "@/lib/discovery/expression-capability-rules";

export type VisualIntentCharacter = {
  role: string;
  name?: string;
};

export type VisualIntent = {
  characters?: VisualIntentCharacter[];
  relationship?: string | null;
  emotion?: string;
  purpose?: string;
};

export type RendererExpressionCharacter = {
  role: string;
  visual: string;
};

/** Canonical Visual Expression (transitional name: rendererExpression). */
export type RendererExpression = {
  environment: string;
  characters: RendererExpressionCharacter[];
  action: string;
  composition: string;
  /** Lighting intent (not a model hyperparameter). */
  lighting?: string;
  styleHints?: string;
  atmosphere?: string;
  threatPerception?: string;
  visualEmphasis?: string;
};

export type ContractValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/** Test / legacy UI placeholder — prefer real Discovery Expression in production. */
export const MINIMAL_RENDERER_EXPRESSION: RendererExpression = {
  environment: "unspecified place",
  characters: [],
  action: "empty scene",
  composition: "wide view",
};

/**
 * Placeholder Expression is not executable story form.
 * Caption / Frame Narrative remains the generate source until a real action exists.
 */
export function isStubRendererExpression(
  expr: RendererExpression | null | undefined
): boolean {
  if (!expr) return true;
  const action = expr.action.trim().toLowerCase();
  return action.length === 0 || action === "empty scene";
}

/** Omit stub placeholders; keep authored Expression only. */
export function executableRendererExpression(
  expr: RendererExpression | null | undefined
): RendererExpression | undefined {
  if (!expr || isStubRendererExpression(expr)) return undefined;
  return expr;
}

const STYLE_HINTS_FORBIDDEN =
  /\b(best quality|masterpiece|8k|ultra detailed|ultradetailed)\b/i;

function trimStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNonEmpty(rec: Record<string, unknown>, key: string): string | undefined {
  if (!(key in rec) || rec[key] === undefined || rec[key] === null) return undefined;
  const v = trimStr(rec[key]);
  return v || undefined;
}

/** Intent presence is optional by scene; quality-when-present only. */
export function parseVisualIntent(raw: unknown): {
  ok: true;
  value: VisualIntent | null;
  warnings: string[];
} | { ok: false; errors: string[] } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null, warnings: [] };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["visualIntent must be an object or null"] };
  }
  const rec = raw as Record<string, unknown>;
  const warnings: string[] = [];
  const intent: VisualIntent = {};

  if (rec.characters !== undefined) {
    if (!Array.isArray(rec.characters)) {
      return { ok: false, errors: ["visualIntent.characters must be an array"] };
    }
    const characters: VisualIntentCharacter[] = [];
    for (const item of rec.characters) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return {
          ok: false,
          errors: ["visualIntent.characters items must be objects"],
        };
      }
      const role = trimStr((item as { role?: unknown }).role);
      if (!role) {
        return {
          ok: false,
          errors: ["visualIntent.characters[].role required when characters present"],
        };
      }
      const name = trimStr((item as { name?: unknown }).name);
      characters.push(name ? { role, name } : { role });
    }
    intent.characters = characters;
  }

  if ("relationship" in rec) {
    if (rec.relationship === null) {
      intent.relationship = null;
    } else if (typeof rec.relationship === "string") {
      intent.relationship = rec.relationship.trim() || null;
    } else {
      return {
        ok: false,
        errors: ["visualIntent.relationship must be string or null"],
      };
    }
  }

  if (rec.emotion !== undefined) {
    const emotion = trimStr(rec.emotion);
    if (!emotion) {
      return {
        ok: false,
        errors: ["visualIntent.emotion when present must be non-empty"],
      };
    }
    intent.emotion = emotion;
  }

  if (rec.purpose !== undefined) {
    const purpose = trimStr(rec.purpose);
    if (!purpose) {
      return {
        ok: false,
        errors: ["visualIntent.purpose when present must be non-empty"],
      };
    }
    intent.purpose = purpose;
  }

  const blob = JSON.stringify(intent).toLowerCase();
  if (/\b(camera|foreground|background|close-up|wide shot)\b/.test(blob)) {
    warnings.push(
      "visualIntent appears to contain composition/camera language; move to rendererExpression"
    );
  }

  return { ok: true, value: intent, warnings };
}

export function parseRendererExpression(raw: unknown): {
  ok: true;
  value: RendererExpression;
  warnings: string[];
} | { ok: false; errors: string[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["rendererExpression must be an object"] };
  }
  const rec = raw as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];

  const environment = trimStr(rec.environment);
  const action = trimStr(rec.action);
  const composition = trimStr(rec.composition);

  if (!environment) errors.push("rendererExpression.environment is required");
  if (!action) errors.push("rendererExpression.action is required");
  if (!composition) errors.push("rendererExpression.composition is required");

  if (!Array.isArray(rec.characters)) {
    errors.push("rendererExpression.characters must be an array (MAY be empty)");
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  const characters: RendererExpressionCharacter[] = [];
  for (const item of rec.characters as unknown[]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return {
        ok: false,
        errors: ["rendererExpression.characters items must be objects"],
      };
    }
    const role = trimStr((item as { role?: unknown }).role);
    const visual = trimStr((item as { visual?: unknown }).visual);
    if (!role || !visual) {
      return {
        ok: false,
        errors: [
          "rendererExpression.characters[].role and .visual required when cast non-empty",
        ],
      };
    }
    characters.push({ role, visual });
  }

  const expression: RendererExpression = {
    environment,
    characters,
    action,
    composition,
  };

  const lighting = optionalNonEmpty(rec, "lighting");
  if (lighting) expression.lighting = lighting;

  const styleHints = optionalNonEmpty(rec, "styleHints");
  if (styleHints) {
    if (STYLE_HINTS_FORBIDDEN.test(styleHints)) {
      return {
        ok: false,
        errors: [
          "rendererExpression.styleHints must not include quality-spam tokens (masterpiece/8k/etc.)",
        ],
      };
    }
    expression.styleHints = styleHints;
  }

  const atmosphere = optionalNonEmpty(rec, "atmosphere");
  if (atmosphere) expression.atmosphere = atmosphere;
  const threatPerception = optionalNonEmpty(rec, "threatPerception");
  if (threatPerception) expression.threatPerception = threatPerception;
  const visualEmphasis = optionalNonEmpty(rec, "visualEmphasis");
  if (visualEmphasis) expression.visualEmphasis = visualEmphasis;

  const abstractOnly =
    /^(protects?|comforts?|loves?|hates?|guards?|debates?|overwhelms?|fights?)\b/i.test(
      action
    ) && action.split(/\s+/).length <= 4;
  if (abstractOnly) {
    warnings.push(
      "rendererExpression.action looks abstract-only; prefer visible pose/prop wording"
    );
  }

  const physicsHits = findForbiddenPhysicsCues(expression);
  if (physicsHits.length) {
    warnings.push(
      `rendererExpression has forbidden physics cues (A4): ${physicsHits.join(", ")}; prefer static geometry`
    );
  }

  if (missingMultiCharacterPlacement(expression)) {
    warnings.push(
      "rendererExpression multi-character cast should state placement (left/right/foreground/facing)"
    );
  }

  const castErrors = findCastConsistencyErrors(expression);
  for (const err of castErrors) {
    warnings.push(`rendererExpression cast inconsistency: ${err}`);
  }

  const fullFaceCues = findRestrictedFullFaceSceneCues(expression);
  if (fullFaceCues.length) {
    warnings.push(
      `rendererExpression has restricted full-face scene cues (Rule 6): ${fullFaceCues.join(", ")}; prefer hidden/distant/partial for scene_frame`
    );
  } else {
    const faceSafety = assessSceneFaceSafety(expression);
    if (faceSafety.safety_status !== "allowed") {
      warnings.push(
        `rendererExpression face safety ${faceSafety.safety_status} (${faceSafety.reason})`
      );
    }
  }

  return { ok: true, value: expression, warnings };
}

/**
 * Thin transport → Image Port prompt via Execution Projection.
 * Default profile follows Deployment accept provider (A5).
 * Prefer `expressionToPrompt(expr, profile)` when the caller knows the profile.
 */
export function rendererExpressionToPrompt(re: RendererExpression): string {
  return expressionToPrompt(re, resolveProjectionProfileFromEnv());
}

export function isRendererExpression(
  value: unknown
): value is RendererExpression {
  return parseRendererExpression(value).ok;
}
