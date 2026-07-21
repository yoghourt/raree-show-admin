/**
 * Server-only avatar prompt (final string must not be assembled on the client).
 * Wording is intentionally redundant — Local turbo models ignore weak “single”.
 */
export function buildAvatarPrompt(name: string, description: string): string {
  const n = name.trim()
  const d = description.trim()
  const subject = d.length > 0 ? `${n}, ${d}` : n
  return [
    `Clean character portrait of ${subject}.`,
    "Strictly one human only: one head, one neck, one face, one pair of eyes,",
    "solo subject, single figure, centered head-and-shoulders bust,",
    "facing camera, soft studio lighting,",
    "plain empty neutral gray background, seamless backdrop, no environment,",
    "digital illustration, sharp face details, high quality,",
    "no text, no letters, no typography, no caption, no nameplate,",
    "no watermark, no logo, no frame, no border, no ornate frame,",
    "no UI, no card layout, no second head, no twin, no clone.",
  ].join(" ")
}

/** Shared negative constraints for Local / Cloud adapters that accept them. */
export const AVATAR_NEGATIVE_PROMPT = [
  "twins",
  "two people",
  "two faces",
  "two heads",
  "double head",
  "extra head",
  "duplicate",
  "cloned",
  "mirror double",
  "conjoined",
  "siamese",
  "split screen",
  "side by side",
  "couple",
  "group",
  "crowd",
  "multiple characters",
  "extra person",
  "deformed",
  "mutated",
  "text",
  "letters",
  "typography",
  "caption",
  "title",
  "nameplate",
  "signature",
  "watermark",
  "logo",
  "emblem",
  "seal",
  "stamp",
  "frame",
  "border",
  "ornate frame",
  "picture frame",
  "decorative border",
  "scrollwork",
  "filigree",
  "UI",
  "HUD",
  "card",
  "trading card",
  "character sheet",
  "poster",
  "comic panel",
].join(", ")
