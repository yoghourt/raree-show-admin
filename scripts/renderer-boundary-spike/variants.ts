/**
 * Three prompt adapters from the SAME Visual Intent.
 * Only representation changes — not model, seed, or Intent content.
 */

export type VisualIntentCharacter = {
  name: string
  role: string
  position: string
}

export type VisualIntent = {
  characters: VisualIntentCharacter[]
  relationship: string
  event: string
  environment: string
  composition: string
  emotion: string
}

export type PromptVariantId = "A" | "B" | "C"

export type PromptVariant = {
  id: PromptVariantId
  label: string
  prompt: string
}

/** Variant A — natural language baseline (source sentence). */
export function variantNaturalLanguage(source: string): PromptVariant {
  return {
    id: "A",
    label: "natural-language",
    prompt: `${source.trim()}. One cinematic narrative still, no text, no watermark.`,
  }
}

/** Variant B — structured Visual Intent listing. */
export function variantStructured(intent: VisualIntent): PromptVariant {
  const lines: string[] = ["Characters:"]
  intent.characters.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.name}${c.role ? ` (${c.role})` : ""}`)
  })
  lines.push("")
  lines.push(`Relationship:\n${intent.relationship}`)
  lines.push("")
  lines.push(`Composition:\n${intent.composition}`)
  lines.push("")
  lines.push(`Environment:\n${intent.environment}`)
  if (intent.event) {
    lines.push("")
    lines.push(`Event:\n${intent.event}`)
  }
  lines.push("")
  lines.push("One cinematic narrative still, no text, no watermark.")
  return {
    id: "B",
    label: "structured-visual-intent",
    prompt: lines.join("\n"),
  }
}

/**
 * Variant C — strong spatial / cast constraints (max instruction clarity).
 * Cast + relationship first (less truncation risk for local hosts).
 */
export function variantStrongConstraint(intent: VisualIntent): PromptVariant {
  const cast = intent.characters
  const a = cast[0]
  const b = cast[1]
  const parts: string[] = []

  if (cast.length >= 2) {
    parts.push(`Exactly ${cast.length} characters only. Both must be visible.`)
    parts.push(
      `Foreground: ${a.name}${a.role ? ` (${a.role})` : ""}. ${a.position}.`
    )
    parts.push(
      `Background / behind: ${b.name}${b.role ? ` (${b.role})` : ""}. ${b.position}.`
    )
  } else if (a) {
    parts.push(`Character: ${a.name}. ${a.position}.`)
  }

  if (intent.relationship?.trim()) {
    parts.push(`Must show relationship: ${intent.relationship}.`)
  }
  if (intent.event?.trim()) {
    parts.push(`Action: ${intent.event}.`)
  }
  if (intent.environment?.trim()) {
    parts.push(`Setting: ${intent.environment}.`)
  }
  if (intent.composition?.trim()) {
    parts.push(`Camera: ${intent.composition}.`)
  }
  parts.push("Do not omit any named character. No text, no watermark.")

  return {
    id: "C",
    label: "strong-constraint",
    prompt: parts.join("\n\n"),
  }
}

export function buildAllVariants(
  source: string,
  intent: VisualIntent
): PromptVariant[] {
  return [
    variantNaturalLanguage(source),
    variantStructured(intent),
    variantStrongConstraint(intent),
  ]
}
