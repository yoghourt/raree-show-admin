/**
 * Server-only avatar prompt (final string must not be assembled on the client).
 * Wording is intentionally redundant — Local turbo models ignore weak “single”.
 * Avoid “empty / plain empty” — turbo models often collapse to blank canvases.
 *
 * Operator revision notes (`[操作员修改意见] …`) are promoted to the front of the
 * prompt — trailing Chinese notes lose to early English tokens like "Lady".
 */

export const AVATAR_REVISION_MARKER = "[操作员修改意见]";

export function splitAvatarDescription(description: string): {
  base: string;
  revisionNote: string;
} {
  const raw = description.trim();
  if (!raw) return { base: "", revisionNote: "" };
  const idx = raw.indexOf(AVATAR_REVISION_MARKER);
  if (idx < 0) return { base: raw, revisionNote: "" };
  return {
    base: raw.slice(0, idx).trim(),
    revisionNote: raw.slice(idx + AVATAR_REVISION_MARKER.length).trim(),
  };
}

type GenderCue = "male" | "female" | null;

/** Lightweight cues from operator notes / description (EN + 中文). */
export function detectGenderCue(text: string): GenderCue {
  const t = text.toLowerCase();
  const male =
    /\b(male|man|men|he|him|his|boy|gentleman|lord|ser|knight|ranger)\b/.test(
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

export function buildAvatarPrompt(name: string, description: string): string {
  const n = name.trim();
  const { base, revisionNote } = splitAvatarDescription(description);
  const revisionCue = detectGenderCue(revisionNote);
  const baseCue = detectGenderCue(base);
  // Operator note wins over base description when they conflict.
  const cue = revisionCue ?? baseCue;
  const { positive: genderPos } = genderOverrideClauses(cue);

  const scrubbedBase =
    revisionCue != null ? scrubConflictingGenderTokens(base, revisionCue) : base;

  const subjectParts = [n];
  if (scrubbedBase) subjectParts.push(scrubbedBase);
  const subject = subjectParts.join(", ");

  const parts: string[] = [];
  if (revisionNote) {
    parts.push(
      `OPERATOR OVERRIDE (must follow): ${revisionNote}.`,
      "Ignore conflicting gender or title words in any prior description."
    );
  }
  parts.push(...genderPos);
  // Repeat gender before the subject line — turbo models overweight nearby tokens.
  if (cue === "male") {
    parts.push(`Male character portrait of ${subject}.`);
  } else if (cue === "female") {
    parts.push(`Female character portrait of ${subject}.`);
  } else {
    parts.push(`Clean character portrait of ${subject}.`);
  }
  parts.push(
    "Strictly one human only: one head, one neck, one face, one pair of eyes,",
    "solo subject, single figure, centered head-and-shoulders bust,",
    "facing camera, soft studio lighting,",
    "soft neutral gray studio backdrop behind the subject,",
    "subject fills most of the frame, clearly visible face and clothing,",
    "digital illustration, sharp face details, high quality,",
    "no text, no letters, no typography, no caption, no nameplate,",
    "no watermark, no logo, no frame, no border, no ornate frame,",
    "no UI, no card layout, no second head, no twin, no clone,",
    "not a blank canvas, not a solid white fill, not an empty picture."
  );
  return parts.join(" ");
}

/** Shared negative constraints for Local / Cloud adapters that accept them. */
export const AVATAR_NEGATIVE_PROMPT = [
  "blank",
  "blank image",
  "blank canvas",
  "empty image",
  "empty canvas",
  "solid white",
  "solid white background only",
  "all white",
  "pure white",
  "whiteout",
  "overexposed wash",
  "featureless",
  "no subject",
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
].join(", ");

/** Negatives for portrait slot, optionally extended from description cues. */
export function buildAvatarNegativePrompt(description?: string): string {
  const { base, revisionNote } = splitAvatarDescription(description ?? "");
  const cue =
    detectGenderCue(revisionNote) ?? detectGenderCue(base);
  const { negativeExtra } = genderOverrideClauses(cue);
  if (negativeExtra.length === 0) return AVATAR_NEGATIVE_PROMPT;
  return `${AVATAR_NEGATIVE_PROMPT}, ${negativeExtra.join(", ")}`;
}
