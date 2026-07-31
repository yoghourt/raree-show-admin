/**
 * Temporary Discovery → Renderer contract (spike only — NOT frozen).
 *
 * Two layers, never merged:
 * - visualIntent: narrative meaning (why this scene matters)
 * - rendererExpression: Local-executable visible form (what to draw)
 */

export type VisualIntentCharacter = {
  /** Story role label, not costume description */
  role: string
  /** Optional display name */
  name?: string
}

/** Narrative meaning only — no camera / prompt / composition wording. */
export type VisualIntent = {
  characters: VisualIntentCharacter[]
  /** Abstract relationship, e.g. "knight protects king" */
  relationship: string
  /** Why this moment matters narratively */
  purpose?: string
  emotion?: string
}

export type RendererCharacter = {
  /** Links to Visual Intent role when possible */
  role: string
  /** Visible description only (pose, props, appearance) */
  visual: string
}

/**
 * Local-executable visual representation.
 * No story interpretation; no abstract "protects/comforts" as sole cue.
 */
export type RendererExpression = {
  environment: string
  characters: RendererCharacter[]
  action: string
  composition: string
  /** Optional — omit unless it changes visible light/mood objects */
  lighting?: string
}

/** Full Discovery handoff to Renderer path (Candidate generation input). */
export type DiscoveryVisualContract = {
  visualIntent: VisualIntent
  rendererExpression: RendererExpression
}

/** Required Expression fields for Local execution. */
export const RENDERER_EXPRESSION_REQUIRED = [
  "environment",
  "characters",
  "action",
  "composition",
] as const

/** Optional Expression fields — drop if they don't improve Local execution. */
export const RENDERER_EXPRESSION_OPTIONAL = ["lighting"] as const

/** Required Intent fields (meaning). */
export const VISUAL_INTENT_REQUIRED = ["characters", "relationship"] as const

/** Optional Intent fields. */
export const VISUAL_INTENT_OPTIONAL = ["purpose", "emotion"] as const

export type ContractValidation = {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export function validateContract(c: DiscoveryVisualContract): ContractValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!c.visualIntent?.relationship?.trim()) {
    errors.push("visualIntent.relationship required")
  }
  if (!Array.isArray(c.visualIntent?.characters) || c.visualIntent.characters.length === 0) {
    errors.push("visualIntent.characters required (non-empty)")
  } else {
    for (const ch of c.visualIntent.characters) {
      if (!ch.role?.trim()) errors.push("visualIntent.characters[].role required")
    }
  }

  const re = c.rendererExpression
  if (!re?.environment?.trim()) errors.push("rendererExpression.environment required")
  if (!re?.action?.trim()) errors.push("rendererExpression.action required")
  if (!re?.composition?.trim()) errors.push("rendererExpression.composition required")
  if (!Array.isArray(re?.characters) || re.characters.length === 0) {
    errors.push("rendererExpression.characters required (non-empty)")
  } else {
    for (const ch of re.characters) {
      if (!ch.role?.trim()) errors.push("rendererExpression.characters[].role required")
      if (!ch.visual?.trim()) errors.push("rendererExpression.characters[].visual required")
    }
  }

  // Soft: abstract relationship words leaking into Expression as the only cue
  const abstractOnly =
    /^(protects?|comforts?|loves?|hates?|guards?)\b/i.test(re?.action?.trim() ?? "") &&
    (re?.action?.trim().split(/\s+/).length ?? 0) <= 3
  if (abstractOnly) {
    warnings.push(
      "rendererExpression.action looks abstract-only; prefer visible pose/prop wording"
    )
  }

  // Soft: composition/camera should not live in Intent
  const intentBlob = JSON.stringify(c.visualIntent ?? {}).toLowerCase()
  if (/\b(camera|foreground|background|close-up|wide shot)\b/.test(intentBlob)) {
    warnings.push(
      "visualIntent appears to contain composition/camera language; move to rendererExpression"
    )
  }

  return { ok: errors.length === 0, errors, warnings }
}

/** Renderer consumes Expression only — Intent is not rendered. */
export function rendererExpressionToPrompt(re: RendererExpression): string {
  const cast = (re.characters ?? [])
    .map((c) => `${c.role}: ${c.visual}`)
    .join("; ")
  const parts = [
    cast && `Characters: ${cast}.`,
    re.action && `Action: ${re.action}.`,
    re.environment && `Environment: ${re.environment}.`,
    re.composition && `Composition: ${re.composition}.`,
    re.lighting?.trim() && `Lighting: ${re.lighting.trim()}.`,
  ].filter(Boolean)
  return `${parts.join(" ")} One cinematic narrative still, clear readable subjects, no text, no watermark.`
}
