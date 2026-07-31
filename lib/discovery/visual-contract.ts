/**
 * SPEC-DVE-001 / ADR-011 A3–A4 — Discovery Visual Intent + Renderer Expression.
 *
 * Intent = narrative meaning (NOT Renderer input).
 * Expression = only input to Renderer (Image Port path).
 * Transport helpers join fields only — MUST NOT invent story meaning.
 * A4: prefer static visible geometry; flag complex physics cues (propose hard-gates).
 */

import {
  findCastConsistencyErrors,
  findForbiddenPhysicsCues,
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

export type RendererExpression = {
  environment: string;
  characters: RendererExpressionCharacter[];
  action: string;
  composition: string;
  lighting?: string;
  styleHints?: string;
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

const STYLE_HINTS_FORBIDDEN =
  /\b(best quality|masterpiece|8k|ultra detailed|ultradetailed)\b/i;

const MAX_PROMPT_PART_LEN = 400;

function trimStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function capPart(value: string): string {
  if (value.length <= MAX_PROMPT_PART_LEN) return value;
  return value.slice(0, MAX_PROMPT_PART_LEN).trim();
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

  const lighting = trimStr(rec.lighting);
  if (lighting) expression.lighting = lighting;

  const styleHints = trimStr(rec.styleHints);
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

  return { ok: true, value: expression, warnings };
}

/**
 * Thin transport: field join for Image Port prompt.
 * MUST NOT reinterpret story or read Visual Intent.
 */
export function rendererExpressionToPrompt(re: RendererExpression): string {
  const cast = (re.characters ?? [])
    .map((c) => `${capPart(c.role)}: ${capPart(c.visual)}`)
    .join("; ");
  const parts = [
    cast && `Characters: ${cast}.`,
    re.action && `Action: ${capPart(re.action)}.`,
    re.environment && `Environment: ${capPart(re.environment)}.`,
    re.composition && `Composition: ${capPart(re.composition)}.`,
    re.lighting?.trim() && `Lighting: ${capPart(re.lighting.trim())}.`,
    re.styleHints?.trim() && `Style: ${capPart(re.styleHints.trim())}.`,
  ].filter(Boolean);

  const body = parts.join(" ").trim();
  if (!body) return "";
  // A4 transport bias only — frozen still; MUST NOT rewrite narrative fields.
  return `${body} One frozen cinematic still, static poses, clear readable subjects, no motion blur, no text, no watermark.`;
}

export function isRendererExpression(
  value: unknown
): value is RendererExpression {
  return parseRendererExpression(value).ok;
}
