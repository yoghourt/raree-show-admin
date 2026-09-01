/**
 * Server-only avatar prompt (final string must not be assembled on the client).
 * Wording is intentionally redundant — Local turbo models ignore weak “single”.
 * Avoid “empty / plain empty” — turbo models often collapse to blank canvases.
 *
 * Operator revision notes (`[操作员修改意见] …`) are promoted to the front of the
 * prompt — trailing Chinese notes lose to early English tokens like "Lady".
 */

import {
  forbidsFromWorkVisualConvention,
  workVisualConventionPromptBlock,
} from "@/lib/prompts/work-visual-convention";

export const AVATAR_REVISION_MARKER = "[操作员修改意见]";
/** Budgeted Character Archive visual cues folded into portrait description. */
export const AVATAR_APPEARANCE_MARKER = "[视觉身份]";

/**
 * Local Z-Image throughput size (square matches LocalAI UI defaults).
 * Waist-up framing is prompt-driven; revisit 3:4 after Local is stable.
 */
export const PORTRAIT_IMAGE_SIZE = { width: 512, height: 512 } as const;

/** Cap bio / archive text so Local turbo stays reliable. */
export const AVATAR_BIO_MAX_CHARS = 160;
/** Execute-time identity budget (Local blank / ignore). Pack FACE→PROP first. */
export const AVATAR_APPEARANCE_MAX_CHARS = 220;

export const VISUAL_IDENTITY_FIELD_ORDER = [
  "FACE",
  "COSTUME",
  "PROP",
  "STYLE",
  "SUMMARY",
] as const;

export type VisualIdentityField = (typeof VISUAL_IDENTITY_FIELD_ORDER)[number];

function clipPromptChunk(text: string, maxChars: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars);
  const cut = Math.max(slice.lastIndexOf(","), slice.lastIndexOf(" "), 0);
  return `${(cut > maxChars * 0.5 ? slice.slice(0, cut) : slice).trim()}…`;
}

function fitIdentityLine(line: string, budget: number): string | null {
  if (budget < 8) return null;
  if (line.length <= budget) return line;
  const slice = line.slice(0, budget);
  const cut = Math.max(slice.lastIndexOf(","), slice.lastIndexOf(" "), 0);
  const trimmed = (cut > budget * 0.5 ? slice.slice(0, cut) : slice)
    .trim()
    .replace(/[,:;]+$/, "");
  return trimmed.length >= 8 ? trimmed : null;
}

/** Parse FACE/COSTUME/PROP/STYLE/SUMMARY whether newline- or inline-labeled. */
export function extractVisualIdentityFields(
  text: string
): Partial<Record<VisualIdentityField, string>> {
  const out: Partial<Record<VisualIdentityField, string>> = {};
  const re = /(SUMMARY|FACE|COSTUME|PROP|STYLE)\s*:\s*/gi;
  const hits: {
    label: VisualIdentityField;
    labelStart: number;
    valueStart: number;
  }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    hits.push({
      label: m[1].toUpperCase() as VisualIdentityField,
      labelStart: m.index,
      valueStart: m.index + m[0].length,
    });
  }
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].labelStart : text.length;
    const val = text
      .slice(hits[i].valueStart, end)
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.;]+$/g, "");
    if (val) out[hits[i].label] = val;
  }
  return out;
}

/**
 * Per-line caps so a verbose FACE cannot eat COSTUME/PROP (sum < 220).
 * STYLE / SUMMARY only take leftover.
 */
const PRIMARY_LINE_CAP: Record<"FACE" | "COSTUME" | "PROP", number> = {
  FACE: 90,
  COSTUME: 70,
  PROP: 40,
};

/**
 * Fit visual identity into the Local portrait execute budget.
 * Keeps FACE / COSTUME / PROP before STYLE / SUMMARY — do not left-clip.
 */
export function packVisualIdentityForPortrait(
  text: string,
  maxChars = AVATAR_APPEARANCE_MAX_CHARS
): string {
  const raw = text.trim();
  if (!raw) return "";
  const fields = extractVisualIdentityFields(raw);
  const hasLabeled = VISUAL_IDENTITY_FIELD_ORDER.some((key) => fields[key]);
  if (!hasLabeled) return clipPromptChunk(raw, maxChars);

  const lines: string[] = [];
  let used = 0;
  for (const key of VISUAL_IDENTITY_FIELD_ORDER) {
    const val = fields[key];
    if (!val) continue;
    const line = `${key}: ${val}.`;
    const sep = lines.length ? 1 : 0;
    const remaining = maxChars - used - sep;
    const primaryCap =
      key === "FACE" || key === "COSTUME" || key === "PROP"
        ? PRIMARY_LINE_CAP[key]
        : remaining;
    const fitted = fitIdentityLine(line, Math.min(remaining, primaryCap));
    if (!fitted) break;
    lines.push(fitted);
    used += sep + fitted.length;
  }
  return lines.join("\n");
}

export function splitAvatarDescription(description: string): {
  base: string;
  revisionNote: string;
  appearance: string;
} {
  const raw = description.trim();
  if (!raw) return { base: "", revisionNote: "", appearance: "" };
  const revIdx = raw.indexOf(AVATAR_REVISION_MARKER);
  const revisionNote =
    revIdx < 0
      ? ""
      : raw.slice(revIdx + AVATAR_REVISION_MARKER.length).trim();
  const beforeRev = revIdx < 0 ? raw : raw.slice(0, revIdx).trim();
  const appIdx = beforeRev.indexOf(AVATAR_APPEARANCE_MARKER);
  if (appIdx < 0) {
    return { base: beforeRev, revisionNote, appearance: "" };
  }
  return {
    base: beforeRev.slice(0, appIdx).trim(),
    appearance: beforeRev
      .slice(appIdx + AVATAR_APPEARANCE_MARKER.length)
      .trim(),
    revisionNote,
  };
}

/** Insert or replace the appearance block; keep bio and operator revision. */
export function mergeAppearanceIntoDescription(
  description: string,
  appearance: string
): string {
  const visual = appearance.trim();
  const { base, revisionNote, appearance: existing } =
    splitAvatarDescription(description);
  const nextAppearance = visual || existing;
  const parts: string[] = [];
  if (base) parts.push(base);
  if (nextAppearance) {
    parts.push(`${AVATAR_APPEARANCE_MARKER} ${nextAppearance}`);
  }
  if (revisionNote) {
    parts.push(`${AVATAR_REVISION_MARKER} ${revisionNote}`);
  }
  return parts.join("\n\n");
}

/**
 * Reader / Work-library description: bio only.
 * Strips Creator packaging (`[视觉身份]`, `[操作员修改意见]`).
 */
export function readerFacingCharacterDescription(description: string): string {
  return splitAvatarDescription(description).base;
}

type GenderCue = "male" | "female" | null;

/** Lightweight cues from operator notes / description (EN + 中文). */
export function detectGenderCue(text: string): GenderCue {
  const t = text.toLowerCase();
  const male =
    /\b(male|man|men|he|him|his|boy|gentleman|lord|ser|knight)\b/.test(
      t
    ) ||
    /他是个男|他是男|男性|男人|男的|帅哥/.test(text);
  const female =
    /\b(female|woman|women|she|her|girl|lady|ladies|queen|princess)\b/.test(
      t
    ) || /她是个女|她是女|女性|女人|女的|美女|女士/.test(text);
  if (male && !female) return "male";
  if (female && !male) return "female";
  // Explicit correction patterns win when both match (e.g. "不是女的，是男的")
  if (/性别不对|不是女|别画成女|改成男|是个男/.test(text) && male) return "male";
  if (/性别不对|不是男|别画成男|改成女|是个女/.test(text) && female)
    return "female";
  return null;
}

function genderOverrideClauses(cue: GenderCue): {
  positive: string[];
  negativeExtra: string[];
} {
  if (cue === "male") {
    return {
      positive: [
        "CRITICAL: the subject is an adult male man,",
        "masculine face, male presentation, not a woman, not feminine,",
      ],
      negativeExtra: [
        "woman",
        "female",
        "lady",
        "girl",
        "feminine face",
        "lipstick",
      ],
    };
  }
  if (cue === "female") {
    return {
      positive: [
        "CRITICAL: the subject is an adult female woman,",
        "feminine face, female presentation, not a man, not a lord,",
      ],
      negativeExtra: ["man", "male", "boy", "masculine face", "beard"],
    };
  }
  return { positive: [], negativeExtra: [] };
}

/** Remove title/gender tokens that fight an operator gender override. */
export function scrubConflictingGenderTokens(
  text: string,
  cue: GenderCue
): string {
  if (!cue || !text.trim()) return text.trim();
  let out = text;
  if (cue === "male") {
    out = out
      .replace(/\b(ladies|lady|queen|princess|woman|women|girl|she|her)\b/gi, " ")
      .replace(/\btitle of\b/gi, " ")
      .replace(/\bholds the title\b/gi, " ");
  } else if (cue === "female") {
    out = out
      .replace(/\b(lords|lord|king|prince|man|men|boy|he|him|his|ser)\b/gi, " ")
      .replace(/\btitle of\b/gi, " ")
      .replace(/\bholds the title\b/gi, " ");
  }
  return out.replace(/\s{2,}/g, " ").replace(/\s([,.])/g, "$1").trim();
}

export function buildAvatarPrompt(
  name: string,
  description: string,
  workVisualConvention?: string
): string {
  const n = name.trim();
  const { base, revisionNote, appearance } = splitAvatarDescription(description);
  const revisionCue = detectGenderCue(revisionNote);
  const appearanceCue = detectGenderCue(appearance);
  const baseCue = detectGenderCue(base);
  // Operator note wins over base description when they conflict.
  const cue = revisionCue ?? appearanceCue ?? baseCue;
  const { positive: genderPos } = genderOverrideClauses(cue);

  const scrubbedAppearance =
    revisionCue != null
      ? scrubConflictingGenderTokens(appearance, revisionCue)
      : appearance;
  const scrubbedBase =
    revisionCue != null ? scrubConflictingGenderTokens(base, revisionCue) : base;

  const clippedAppearance = scrubbedAppearance
    ? packVisualIdentityForPortrait(scrubbedAppearance).replace(/\s+/g, " ").trim()
    : "";
  const clippedBio = scrubbedBase
    ? clipPromptChunk(scrubbedBase, AVATAR_BIO_MAX_CHARS)
    : "";

  const subjectParts = [n];
  if (clippedBio) subjectParts.push(clippedBio);
  const subject = subjectParts.join(", ");

  const parts: string[] = [];
  if (revisionNote) {
    parts.push(
      `OPERATOR OVERRIDE (must follow): ${clipPromptChunk(revisionNote, 120)}.`
    );
  }
  const convention = workVisualConventionPromptBlock(workVisualConvention);
  if (convention) {
    parts.push(convention);
  }
  if (clippedAppearance) {
    parts.push(
      `CRITICAL visual identity (must depict): ${clippedAppearance}.`
    );
  }
  parts.push(...genderPos);
  // Repeat gender before the subject line — turbo models overweight nearby tokens.
  if (cue === "male") {
    parts.push(`Male character portrait of ${subject}.`);
  } else if (cue === "female") {
    parts.push(`Female character portrait of ${subject}.`);
  } else {
    parts.push(`Character portrait of ${subject}.`);
  }
  // Keep positive short for Local Z-Image; rejects live in negative prompt.
  parts.push(
    "waist-up portrait, head shoulders and torso with costume visible,",
    "iconic weapon visible in frame when specified,",
    "solo, one person, facing camera, soft studio light, gray backdrop,",
    "digital illustration, sharp face."
  );
  return parts.join(" ");
}

/** Shared negative constraints for Local / Cloud adapters that accept them. */
export const AVATAR_NEGATIVE_PROMPT = [
  "blank canvas",
  "empty image",
  "solid white",
  "no subject",
  "twins",
  "two people",
  "two faces",
  "crowd",
  "deformed",
  "text",
  "watermark",
  "logo",
  "frame",
  "floating head",
  "disembodied head",
  "head only",
  "cropped at neck",
  "decapitated",
  "close-up face only",
].join(", ");

/** Heuristic negatives from appearance cues (not work-specific dictionaries). */
function appearanceNegativeExtras(appearance: string): string[] {
  const t = appearance.toLowerCase();
  const out: string[] = [];
  if (/\bred face\b|\bred-faced\b|\brouged face\b/.test(t)) {
    out.push("pale face", "fair skin", "pink cheeks only");
  }
  if (/\bblack face\b|\bdark skin\b|\btanned\b/.test(t)) {
    out.push("pale skin", "very fair skin");
  }
  if (
    /\bcrescent\b|\bglaive\b|\bhalberd\b|\bserpent spear\b|\bgreen dragon\b/.test(
      t
    )
  ) {
    out.push("western straight sword", "katana", "rapier");
  }
  if (/\blong beard\b|\bflowing beard\b|\bfull beard\b/.test(t)) {
    out.push("clean shaven", "no beard");
  }
  if (/\bthick beard\b|\bbushy beard\b|\bwild beard\b/.test(t)) {
    out.push("clean shaven", "thin mustache only");
  }
  return [...new Set(out)];
}

/** Negatives for portrait slot, optionally extended from description cues. */
export function buildAvatarNegativePrompt(
  description?: string,
  workVisualConvention?: string
): string {
  const { base, revisionNote, appearance } = splitAvatarDescription(
    description ?? ""
  );
  const cue =
    detectGenderCue(revisionNote) ??
    detectGenderCue(appearance) ??
    detectGenderCue(base);
  const { negativeExtra } = genderOverrideClauses(cue);
  const appearanceNeg = appearanceNegativeExtras(appearance);
  const conventionNeg = forbidsFromWorkVisualConvention(
    workVisualConvention ?? ""
  );
  const merged = [
    ...new Set([...negativeExtra, ...appearanceNeg, ...conventionNeg]),
  ];
  if (merged.length === 0) return AVATAR_NEGATIVE_PROMPT;
  return `${AVATAR_NEGATIVE_PROMPT}, ${merged.join(", ")}`;
}
