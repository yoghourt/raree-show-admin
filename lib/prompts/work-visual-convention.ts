/**
 * Work-level Creator visual convention — era/style/forbids for this work only.
 * Not Reader description. Character FACE/COSTUME/PROP and Frame caption still win.
 */

export const WORK_VISUAL_CONVENTION_MAX_CHARS = 400;
/** Execute/propose budget so Local turbo is not flooded. */
export const WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS = 180;

export function clipWorkVisualConvention(
  text: string,
  maxChars = WORK_VISUAL_CONVENTION_MAX_CHARS
): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars);
  const cut = Math.max(slice.lastIndexOf(","), slice.lastIndexOf(" "), 0);
  return `${(cut > maxChars * 0.5 ? slice.slice(0, cut) : slice).trim()}…`;
}

export function workVisualConventionFromRow(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const raw = (row as { visual_convention?: unknown }).visual_convention;
  return typeof raw === "string" ? clipWorkVisualConvention(raw) : "";
}

/** Prompt block for propose / generate. Empty string when unset. */
export function workVisualConventionPromptBlock(
  convention: string | undefined,
  maxChars = WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS
): string {
  const clipped = clipWorkVisualConvention(convention ?? "", maxChars);
  if (!clipped) return "";
  return `Work visual convention (THIS work only — era, style family, forbids. Do not copy another work. Character FACE/COSTUME/PROP and the caption beat still win): ${clipped}`;
}

export function workTitleAndConventionFromRow(row: unknown): {
  title: string | undefined;
  visualConvention: string;
} {
  if (!row || typeof row !== "object") {
    return { title: undefined, visualConvention: "" };
  }
  const titleRaw = (row as { title?: unknown }).title;
  return {
    title: typeof titleRaw === "string" ? titleRaw : undefined,
    visualConvention: workVisualConventionFromRow(row),
  };
}
