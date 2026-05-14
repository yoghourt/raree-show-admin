/**
 * Server-only avatar prompt (final string must not be assembled on the client).
 */
export function buildAvatarPrompt(name: string, description: string): string {
  const n = name.trim()
  const d = description.trim()
  const body = d.length > 0 ? `${n} — ${d}` : n
  return `${body}. Single official character portrait bust, neutral studio background, clear readable face, digital illustration, high quality, no text, no watermark.`
}
