/**
 * Visual Intent → compressed renderer prompt (model-independent Intent stays upstream).
 * Do NOT dump Discovery JSON into the image model.
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

/** Hard cap — long prompts previously blanked LocalAI (prior spike scene-3). */
const MAX_PROMPT_CHARS = 480

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

/**
 * Compress Visual Intent into a short Local-friendly illustration prompt.
 * Keeps relationship / cast / place / action; drops essay-length director prose.
 */
export function visualIntentToRendererPrompt(intent: VisualIntent): string {
  const cast = (intent.characters ?? [])
    .slice(0, 4)
    .map((c) => {
      const bits = [c.name, c.role && `(${c.role})`, c.position]
        .filter(Boolean)
        .join(" ")
      return bits
    })
    .filter(Boolean)

  const parts: string[] = []
  if (cast.length) parts.push(`Cast: ${cast.join("; ")}.`)
  if (intent.relationship?.trim()) {
    parts.push(`Relationship: ${clean(intent.relationship)}.`)
  }
  if (intent.event?.trim()) parts.push(`Event: ${clean(intent.event)}.`)
  if (intent.environment?.trim()) {
    parts.push(`Place: ${clean(intent.environment)}.`)
  }
  if (intent.composition?.trim()) {
    parts.push(`Frame: ${clean(intent.composition)}.`)
  }
  if (intent.emotion?.trim()) parts.push(`Mood: ${clean(intent.emotion)}.`)
  parts.push(
    "One cinematic narrative still, clear readable subjects, no text, no watermark."
  )

  let out = parts.join(" ")
  if (out.length > MAX_PROMPT_CHARS) {
    out = `${out.slice(0, MAX_PROMPT_CHARS - 1).trim()}…`
  }
  return out
}
