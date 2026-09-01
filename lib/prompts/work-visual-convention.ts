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

const CONVENTION_SECTION_LABEL =
  /\b(?:STYLE|ERA|FORBID|COSTUME|FACE|PROP|SUMMARY)\s*:\s*/gi;

/**
 * Work-wide garments paint every figure the same (Local turbo prior).
 * Wardrobe lives on character visuals; convention keeps style + materials.
 */
const WORK_WIDE_GARMENT_PATTERN =
  /\b(?:all[- ](?:the\s+)?(?:black|white|dark|red|grey|gray)\s+)?(?:matching\s+)?(?:hooded\s+)?cloaks?\b/gi;

function forbidClause(convention: string): string {
  const m = convention.match(
    /\bFORBID\s*:\s*(.+?)(?=\b(?:STYLE|ERA|FORBID|COSTUME|FACE|PROP|SUMMARY)\s*:|$)/i
  );
  return m?.[1]?.trim() ?? "";
}

/** FORBID: values for negative_prompt. Empty when the operator used unlabeled prose. */
export function forbidsFromWorkVisualConvention(convention: string): string[] {
  const clause = forbidClause(clipWorkVisualConvention(convention));
  if (!clause) return [];
  return clause
    .split(/[,;]/)
    .map((part) => part.replace(/\.+$/g, "").trim())
    .filter((part) => part.length > 1);
}

/**
 * Positive-prompt prose: drop ALL-CAPS section labels (they paint as glyphs)
 * and drop the FORBID clause (that belongs in negatives).
 */
export function flattenWorkVisualConventionForPrompt(
  convention: string,
  maxChars = WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS
): string {
  let t = clipWorkVisualConvention(convention);
  if (!t) return "";
  t = t.replace(
    /\bFORBID\s*:\s*(.+?)(?=\b(?:STYLE|ERA|FORBID|COSTUME|FACE|PROP|SUMMARY)\s*:|$)/gi,
    " "
  );
  t = t.replace(CONVENTION_SECTION_LABEL, "");
  t = t.replace(WORK_WIDE_GARMENT_PATTERN, " ");
  t = t.replace(/\s+/g, " ").trim().replace(/^[,;.\s]+|[,;.\s]+$/g, "");
  return clipWorkVisualConvention(t, maxChars);
}

/** Image-prompt prose only — no heading (headings paint as glyphs on Local). */
export function workVisualConventionPromptBlock(
  convention: string | undefined,
  maxChars = WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS
): string {
  return flattenWorkVisualConventionForPrompt(convention ?? "", maxChars);
}

/** Propose LLM block: labeled is fine (text model, not an image canvas). */
export function workVisualConventionProposeBlock(
  convention: string | undefined,
  maxChars = WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS
): string {
  const look = flattenWorkVisualConventionForPrompt(convention ?? "", maxChars);
  const forbids = forbidsFromWorkVisualConvention(convention ?? "");
  const avoid = forbids.length ? ` Avoid: ${forbids.join(", ")}.` : "";
  if (!look && !avoid) return "";
  if (!look) {
    return `Work look (this work only; character looks and the caption beat still win):${avoid}`;
  }
  return `Work look (this work only; character looks and the caption beat still win): ${look}.${avoid}`;
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
