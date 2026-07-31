/**
 * Option A — external adaptation (separate transformation layer).
 * Same rules as prior capability-adaptation spike (action-based).
 * Intentionally OUTSIDE Discovery.
 */

export type VisualIntent = {
  characters: Array<{ name: string; role: string; position: string }>
  relationship: string
  event: string
  environment: string
  composition: string
  emotion: string
}

/** Deterministic external adapter — not Discovery. */
export function externalAdaptToPrompt(
  caseId: string,
  intent: VisualIntent
): { expression: string; prompt: string } {
  let expression: string
  if (caseId === "case-1") {
    expression = [
      "Young knight standing in front holding a sword.",
      "Old king standing behind the knight.",
      "Knight facing outward toward danger.",
      "King sheltered behind the knight's back.",
      "Stone castle hall with arches.",
    ].join(" ")
  } else if (caseId === "case-2") {
    expression = [
      "Mother kneeling on scorched ground holding a small child.",
      "Mother's arms wrapped around the child.",
      "Child pressed against mother's chest.",
      "Smoke and distant fires behind them.",
      "Battlefield edge after fighting.",
    ].join(" ")
  } else {
    expression = [
      "Two armored warriors clashing with swords.",
      "Bodies locked in combat facing each other.",
      "Burning battlefield flames and smoke behind them.",
    ].join(" ")
  }
  // Note: adapter ignores intent fields on purpose for A — shows separate mapping drift risk
  // when mapping is hand-authored vs Discovery meaning. Prefer intent-driven rewrite when possible:
  void intent
  return {
    expression,
    prompt: `${expression} One cinematic narrative still, clear readable subjects, no text, no watermark.`,
  }
}

/** Intent-aware external adapter (still a second hop after Discovery). */
export function externalAdaptFromIntent(intent: VisualIntent): {
  expression: string
  prompt: string
} {
  const cast = (intent.characters ?? [])
    .slice(0, 3)
    .map((c) => `${c.name}: ${c.position || c.role}`.trim())
    .join("; ")
  const parts = [
    cast && `Visible cast: ${cast}.`,
    intent.relationship &&
      `Show this as visible action (not abstract wording): ${intent.relationship}.`,
    intent.event && `Event as poses/objects: ${intent.event}.`,
    intent.environment && `Place: ${intent.environment}.`,
    intent.composition && `Camera: ${intent.composition}.`,
  ].filter(Boolean)
  const expression = parts.join(" ")
  return {
    expression,
    prompt: `${expression} One cinematic narrative still, clear readable subjects, no text, no watermark.`,
  }
}
