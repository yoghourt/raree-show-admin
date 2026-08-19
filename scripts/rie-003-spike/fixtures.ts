/**
 * SPIKE-RIE-003 fixtures. Captions and Propose claims are annotated facts.
 * IE verdicts are produced by the existing production evaluator (read-only).
 */

export const STORY_EARLY = "story-early";
export const STORY_DONG = "story-dong";

/** Story A — early arc captions (REQUIRED events present; no Dong Zhuo turn). */
export const STORY_A_CAPTIONS: Record<string, string> = {
  a1: "Yellow Turban Rebellion spreads. A recruitment notice is posted. Liu Bei, Guan Yu, and Zhang Fei swear brotherhood.",
  a2: "Patrons fund them. They arm a militia and win at Mount Daxing.",
};

/**
 * Story B — failure-case captions from the grant:
 * people + scorn only. Compound “欲杀但被阻止” is absent.
 * Story.summary (not used as authority) still names the compound.
 */
export const STORY_B_SUMMARY =
  "Zhang Fei attempted to kill Dong Zhuo, but Liu Bei and Guan Yu prevented it.";

export const STORY_B_CAPTIONS: Record<string, string> = {
  b1: "The brothers rescue Dong Zhuo from a siege. Dong Zhuo scorns them for having no rank.",
  b2: "Liu Bei, Guan Yu, Zhang Fei, and Dong Zhuo are together in the tent. Dong Zhuo treats them with contempt.",
};

/** Compression captions: REQUIRED kept, OPTIONAL counts/weapons/oath/Qingzhou dropped. */
export const COMPRESSION_CAPTIONS: Record<string, string> = {
  c1: "Yellow Turban Rebellion spreads. A recruitment notice is posted. Liu Bei, Guan Yu, and Zhang Fei swear brotherhood.",
  c2: "Patrons fund them. They arm a militia and win at Mount Daxing.",
  c3: "They rescue Dong Zhuo. He scorns their lack of rank. Zhang Fei tries to kill him; Liu Bei and Guan Yu restrain him and prevent the killing.",
};

export const COMPRESSION_SOURCE_OPTIONAL = [
  "fifty horses",
  "Green Dragon",
  "same day",
  "Qingzhou",
] as const;

/** C — Propose only claims scorn for the Dong Zhuo Story. Annotated Propose output. */
export const PROPOSE_CLAIMS: Record<string, string[]> = {
  [STORY_EARLY]: [
    "U-REBELLION",
    "U-NOTICE",
    "U-MEET-OATH",
    "U-ARMS",
    "U-DAXING",
  ],
  [STORY_DONG]: ["U-SCORN"],
};

/**
 * A — unaudited human who also only marks scorn on Story B.
 * Same completeness hole as Propose; origin is human, not generator.
 */
export const HUMAN_SPARSE_BINDS: Record<string, string[]> = {
  [STORY_EARLY]: [
    "U-REBELLION",
    "U-NOTICE",
    "U-MEET-OATH",
    "U-ARMS",
    "U-DAXING",
  ],
  [STORY_DONG]: ["U-SCORN"],
};

/** D — canon-complete human confirmation of per-Story ownership. */
export const HUMAN_COMPLETE_BINDS: Record<string, string[]> = {
  [STORY_EARLY]: [
    "U-REBELLION",
    "U-NOTICE",
    "U-MEET-OATH",
    "U-ARMS",
    "U-DAXING",
  ],
  [STORY_DONG]: [
    "U-RESCUE",
    "U-SCORN",
    "U-ATTEMPT",
    "U-PREVENT",
    "U-ATTEMPT-PREVENTED",
  ],
};

export function captionList(
  byId: Record<string, string>
): Array<{ id: string; caption: string }> {
  return Object.entries(byId).map(([id, caption]) => ({ id, caption }));
}
