/**
 * Capability-aware visual expression adapters.
 * Same Visual Intent → different LOCAL-EXECUTABLE expressions.
 * Does not change story meaning — only how it is shown.
 */

export type VisualIntent = {
  characters: Array<{ name: string; role: string; position: string }>
  relationship: string
  event: string
  environment: string
  composition: string
  emotion: string
}

export type VariantId = "A" | "B" | "C"

export type Variant = {
  id: VariantId
  label: string
  expression: string
  prompt: string
}

/** A — Direct Intent (abstract relationship language kept). */
export function variantDirect(source: string, intent: VisualIntent): Variant {
  const expression = [
    source.trim() + ".",
    `Relationship: ${intent.relationship}.`,
    `Composition: ${intent.composition}.`,
  ].join(" ")
  return {
    id: "A",
    label: "direct-intent",
    expression,
    prompt: `${expression} One cinematic narrative still, no text, no watermark.`,
  }
}

/**
 * B — Action-Based Adaptation
 * Abstract relationship → observable poses / objects / spatial facts.
 */
export function variantActionBased(
  sceneId: string,
  intent: VisualIntent
): Variant {
  let expression: string
  if (sceneId === "scene-1") {
    expression = [
      "Young knight standing in front holding a sword.",
      "Old king standing behind the knight.",
      "Knight facing outward toward danger.",
      "King sheltered behind the knight's back.",
      "Stone castle hall with arches.",
    ].join(" ")
  } else if (sceneId === "scene-2") {
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
  return {
    id: "B",
    label: "action-based-adaptation",
    expression,
    prompt: `${expression} One cinematic narrative still, clear readable subjects, no text, no watermark.`,
  }
}

/**
 * C — Symbolic Adaptation
 * Lower complexity cues (guarding / comforting adjectives + simple props).
 */
export function variantSymbolic(sceneId: string, intent: VisualIntent): Variant {
  let expression: string
  if (sceneId === "scene-1") {
    expression = [
      "Brave young knight guarding an elderly king.",
      "Knight with sword raised.",
      "King standing safely behind him.",
      "Dark castle hall atmosphere.",
    ].join(" ")
  } else if (sceneId === "scene-2") {
    expression = [
      "Caring mother comforting a frightened child.",
      "Gentle embrace after battle.",
      "Soft sheltering pose.",
      "Smoky ruined battlefield nearby.",
    ].join(" ")
  } else {
    expression = [
      "Fierce warriors dueling on a burning battlefield.",
      "Swords crossed.",
      "Flames and smoke.",
    ].join(" ")
  }
  return {
    id: "C",
    label: "symbolic-adaptation",
    expression,
    prompt: `${expression} One cinematic narrative still, no text, no watermark.`,
  }
}

export function buildVariants(
  sceneId: string,
  source: string,
  intent: VisualIntent
): Variant[] {
  return [
    variantDirect(source, intent),
    variantActionBased(sceneId, intent),
    variantSymbolic(sceneId, intent),
  ]
}
