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

/** Local paints the noun if it appears in the positive, even after "no". */
const POSITIVE_NEGATION_CLAUSE =
  /\b(?:no|not|without)\s+(?:a\s+|an\s+|any\s+|the\s+)?([^,.;，]+)/gi;

const ANACHRONISM_IN_POSITIVE =
  /\b(camouflage|olive drab|modern military|woodland camo)\b/gi;

export function forbidsFromUnlabeledNegations(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.replace(/\s+/g, " ").matchAll(POSITIVE_NEGATION_CLAUSE)) {
    const item = (m[1] ?? "").trim().replace(/\.+$/g, "");
    const key = item.toLowerCase();
    if (item.length > 1 && item.length < 48 && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/** Drop "no X" clauses and anachronism nouns from a Local positive prompt. */
export function stripPositiveNegations(text: string): string {
  return text
    .replace(POSITIVE_NEGATION_CLAUSE, " ")
    .replace(ANACHRONISM_IN_POSITIVE, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/^[,;.\s]+|[,;.\s]+$/g, "")
    .trim();
}

function forbidClause(convention: string): string {
  const m = convention.match(
    /\bFORBID\s*:\s*(.+?)(?=\b(?:STYLE|ERA|FORBID|COSTUME|FACE|PROP|SUMMARY)\s*:|$)/i
  );
  return m?.[1]?.trim() ?? "";
}

/** FORBID: values plus unlabeled "no X" prose for negative_prompt. */
export function forbidsFromWorkVisualConvention(convention: string): string[] {
  const clipped = clipWorkVisualConvention(convention);
  const labeled = forbidClause(clipped)
    .split(/[,;]/)
    .map((part) => part.replace(/\.+$/g, "").trim())
    .filter((part) => part.length > 1);
  const unlabeled = forbidsFromUnlabeledNegations(clipped);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...labeled, ...unlabeled]) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
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
  t = stripPositiveNegations(t);
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
