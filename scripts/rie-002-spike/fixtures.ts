import { REQUIRED_UNITS } from "../rie-spike/inventory";
import {
  FIXTURE_B_KEEP,
  FIXTURE_B_LOSS,
} from "../rie-spike/fixtures";
import { naiveEntitiesAllPresent } from "../rie-spike/evaluate";
import type { GranularityInput } from "../../lib/discovery/granularity-gate/types";
import type { IeCandidateInput } from "./types";

const ALL_REQUIRED = REQUIRED_UNITS.map((u) => u.id);

function captionsByFrame(input: GranularityInput): Record<string, string> {
  return Object.fromEntries(input.frames.map((f) => [f.id, f.caption]));
}

function framesOf(input: GranularityInput, storyId: string) {
  return input.frames.filter((f) => f.parentStoryId === storyId);
}

/** Experiment A — known PASS (RIE-001 B_KEEP). */
export const CANDIDATE_A_KEEP: IeCandidateInput = {
  candidateId: "A_KEEP",
  storyId: "story-arc",
  frameIds: FIXTURE_B_KEEP.input.frames.map((f) => f.id),
  captionsByFrameId: captionsByFrame(FIXTURE_B_KEEP.input),
  claimedUnitIds: ALL_REQUIRED,
  observations: [
    {
      unitId: "U-REBELLION",
      status: "PRESENT",
      supportingFrameIds: ["f1"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[0]!.caption,
    },
    {
      unitId: "U-NOTICE",
      status: "PRESENT",
      supportingFrameIds: ["f1"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[0]!.caption,
    },
    {
      unitId: "U-MEET-OATH",
      status: "PRESENT",
      supportingFrameIds: ["f1"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[0]!.caption,
    },
    {
      unitId: "U-ARMS",
      status: "PRESENT",
      supportingFrameIds: ["f2"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[1]!.caption,
    },
    {
      unitId: "U-DAXING",
      status: "PRESENT",
      supportingFrameIds: ["f2"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[1]!.caption,
    },
    {
      unitId: "U-RESCUE",
      status: "PRESENT",
      supportingFrameIds: ["f3"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[2]!.caption,
    },
    {
      unitId: "U-SCORN",
      status: "PRESENT",
      supportingFrameIds: ["f3"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[2]!.caption,
    },
    {
      unitId: "U-ATTEMPT",
      status: "PRESENT",
      supportingFrameIds: ["f3"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[2]!.caption,
    },
    {
      unitId: "U-PREVENT",
      status: "PRESENT",
      supportingFrameIds: ["f3"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[2]!.caption,
    },
    {
      unitId: "U-ATTEMPT-PREVENTED",
      status: "PRESENT",
      supportingFrameIds: ["f3"],
      reason: "PRESERVED",
      observed: FIXTURE_B_KEEP.input.frames[2]!.caption,
    },
  ],
};

/** Experiment B — known FAIL (RIE-001 B_LOSS). */
export const CANDIDATE_B_LOSS: IeCandidateInput = {
  candidateId: "B_LOSS",
  storyId: "story-arc",
  frameIds: FIXTURE_B_LOSS.input.frames.map((f) => f.id),
  captionsByFrameId: captionsByFrame(FIXTURE_B_LOSS.input),
  claimedUnitIds: ALL_REQUIRED,
  observations: [
    {
      unitId: "U-REBELLION",
      status: "PRESENT",
      supportingFrameIds: ["f1"],
      reason: "PRESERVED",
      observed: FIXTURE_B_LOSS.input.frames[0]!.caption,
    },
    {
      unitId: "U-NOTICE",
      status: "PRESENT",
      supportingFrameIds: ["f1"],
      reason: "PRESERVED",
      observed: FIXTURE_B_LOSS.input.frames[0]!.caption,
    },
    {
      unitId: "U-MEET-OATH",
      status: "PRESENT",
      supportingFrameIds: ["f1"],
      reason: "PRESERVED",
      observed: FIXTURE_B_LOSS.input.frames[0]!.caption,
    },
    {
      unitId: "U-ARMS",
      status: "PRESENT",
      supportingFrameIds: ["f2"],
      reason: "PRESERVED",
      observed: FIXTURE_B_LOSS.input.frames[1]!.caption,
    },
    {
      unitId: "U-DAXING",
      status: "PRESENT",
      supportingFrameIds: ["f2"],
      reason: "PRESERVED",
      observed: FIXTURE_B_LOSS.input.frames[1]!.caption,
    },
    {
      unitId: "U-RESCUE",
      status: "PRESENT",
      supportingFrameIds: ["f3"],
      reason: "PRESERVED",
      observed: FIXTURE_B_LOSS.input.frames[2]!.caption,
    },
    {
      unitId: "U-SCORN",
      status: "PRESENT",
      supportingFrameIds: ["f3"],
      reason: "PRESERVED",
      observed: FIXTURE_B_LOSS.input.frames[2]!.caption,
    },
    {
      unitId: "U-ATTEMPT",
      status: "LOST",
      supportingFrameIds: ["f3"],
      reason: "ENTITY_OVERLAP_ONLY",
      observed: FIXTURE_B_LOSS.input.frames[2]!.caption,
    },
    {
      unitId: "U-PREVENT",
      status: "LOST",
      supportingFrameIds: ["f3"],
      reason: "ENTITY_OVERLAP_ONLY",
      observed: FIXTURE_B_LOSS.input.frames[2]!.caption,
    },
    {
      unitId: "U-ATTEMPT-PREVENTED",
      status: "LOST",
      supportingFrameIds: ["f3"],
      reason: "ENTITY_OVERLAP_ONLY",
      observed: FIXTURE_B_LOSS.input.frames[2]!.caption,
    },
  ],
};

const COMPRESSION_SOURCE = `1. Yellow Turban Rebellion. Liu Yan posts a notice. Liu Bei, Guan Yu, and Zhang Fei swear brotherhood — not seeking to be born on the same day, only to die on the same day.
2. Merchants Zhang Shiping and Su Shuang give fifty horses, five hundred taels of silver, and a thousand catties of iron. They forge the twin swords, Green Dragon Crescent Blade, and Serpent Spear, and raise five hundred volunteers.
3. At Mount Daxing they defeat Deng Mao and Cheng Yuanzhi among tens of thousands of rebels.
4. They relieve Qingzhou, then rescue Dong Zhuo. He scorns their lack of rank. Zhang Fei tries to kill him; Liu Bei and Guan Yu restrain him. This reveals class prejudice and foreshadows Dong Zhuo's later tyranny.`;

const COMPRESSION_INPUT: GranularityInput = {
  sourceText: COMPRESSION_SOURCE,
  stories: [
    {
      id: "story-compressed",
      title: "From Notice to Contempt",
      summary:
        "The brothers rise, win, rescue Dong Zhuo, and Zhang Fei is stopped from killing him.",
    },
  ],
  frames: [
    {
      id: "c1",
      parentStoryId: "story-compressed",
      title: "Setup",
      caption:
        "Yellow Turban Rebellion spreads. A recruitment notice is posted. Liu Bei, Guan Yu, and Zhang Fei swear brotherhood.",
    },
    {
      id: "c2",
      parentStoryId: "story-compressed",
      title: "Conflict",
      caption:
        "Patrons fund them. They arm a militia and win at Mount Daxing.",
    },
    {
      id: "c3",
      parentStoryId: "story-compressed",
      title: "Turn",
      caption:
        "They rescue Dong Zhuo. He scorns their lack of rank. Zhang Fei tries to kill him; Liu Bei and Guan Yu restrain him and prevent the killing.",
    },
    {
      id: "c4",
      parentStoryId: "story-compressed",
      title: "Aftermath",
      caption: "They leave after the insult.",
    },
  ],
};

/** Experiment C — details dropped, REQUIRED events/turns kept. */
export const CANDIDATE_C_COMPRESSION: IeCandidateInput = {
  candidateId: "C_COMPRESSION",
  storyId: "story-compressed",
  frameIds: COMPRESSION_INPUT.frames.map((f) => f.id),
  captionsByFrameId: captionsByFrame(COMPRESSION_INPUT),
  claimedUnitIds: ALL_REQUIRED,
  observations: [
    {
      unitId: "U-REBELLION",
      status: "PRESENT",
      supportingFrameIds: ["c1"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[0]!.caption,
    },
    {
      unitId: "U-NOTICE",
      status: "PRESENT",
      supportingFrameIds: ["c1"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[0]!.caption,
    },
    {
      unitId: "U-MEET-OATH",
      status: "PRESENT",
      supportingFrameIds: ["c1"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[0]!.caption,
    },
    {
      unitId: "U-ARMS",
      status: "PRESENT",
      supportingFrameIds: ["c2"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[1]!.caption,
    },
    {
      unitId: "U-DAXING",
      status: "PRESENT",
      supportingFrameIds: ["c2"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[1]!.caption,
    },
    {
      unitId: "U-RESCUE",
      status: "PRESENT",
      supportingFrameIds: ["c3"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[2]!.caption,
    },
    {
      unitId: "U-SCORN",
      status: "PRESENT",
      supportingFrameIds: ["c3"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[2]!.caption,
    },
    {
      unitId: "U-ATTEMPT",
      status: "PRESENT",
      supportingFrameIds: ["c3"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[2]!.caption,
    },
    {
      unitId: "U-PREVENT",
      status: "PRESENT",
      supportingFrameIds: ["c3"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[2]!.caption,
    },
    {
      unitId: "U-ATTEMPT-PREVENTED",
      status: "PRESENT",
      supportingFrameIds: ["c3"],
      reason: "PRESERVED",
      observed: COMPRESSION_INPUT.frames[2]!.caption,
    },
  ],
};

export const COMPRESSION_OPTIONAL_DROPPED = [
  "fifty horses",
  "five hundred taels",
  "Green Dragon",
  "Qingzhou",
  "same day",
] as const;

const TRAP_INPUT: GranularityInput = {
  sourceText:
    "They rescue Dong Zhuo. He scorns their lack of rank. Zhang Fei tries to kill him; Liu Bei and Guan Yu restrain him.",
  stories: [
    {
      id: "story-trap",
      title: "Dong Zhuo",
      summary:
        "Zhang Fei attempted to kill Dong Zhuo, but Liu Bei and Guan Yu prevented it.",
    },
  ],
  frames: [
    {
      id: "t1",
      parentStoryId: "story-trap",
      title: "Rescue",
      caption:
        "The brothers rescue Dong Zhuo from a siege. Dong Zhuo scorns them for having no rank.",
    },
    {
      id: "t2",
      parentStoryId: "story-trap",
      title: "Camp",
      caption:
        "Liu Bei, Guan Yu, Zhang Fei, and Dong Zhuo are together in the tent. Dong Zhuo treats them with contempt.",
    },
  ],
};

/** Experiment D — all people present; causal compound missing. */
export const CANDIDATE_D_TRAP: IeCandidateInput = {
  candidateId: "D_TRAP",
  storyId: "story-trap",
  frameIds: TRAP_INPUT.frames.map((f) => f.id),
  captionsByFrameId: captionsByFrame(TRAP_INPUT),
  claimedUnitIds: [
    "U-RESCUE",
    "U-SCORN",
    "U-ATTEMPT",
    "U-PREVENT",
    "U-ATTEMPT-PREVENTED",
  ],
  observations: [
    {
      unitId: "U-RESCUE",
      status: "PRESENT",
      supportingFrameIds: ["t1"],
      reason: "PRESERVED",
      observed: TRAP_INPUT.frames[0]!.caption,
    },
    {
      unitId: "U-SCORN",
      status: "PRESENT",
      supportingFrameIds: ["t1"],
      reason: "PRESERVED",
      observed: TRAP_INPUT.frames[0]!.caption,
    },
    {
      unitId: "U-ATTEMPT",
      status: "LOST",
      supportingFrameIds: ["t2"],
      reason: "ENTITY_OVERLAP_ONLY",
      observed: TRAP_INPUT.frames[1]!.caption,
    },
    {
      unitId: "U-PREVENT",
      status: "LOST",
      supportingFrameIds: ["t2"],
      reason: "ENTITY_OVERLAP_ONLY",
      observed: TRAP_INPUT.frames[1]!.caption,
    },
    {
      unitId: "U-ATTEMPT-PREVENTED",
      status: "LOST",
      supportingFrameIds: ["t2"],
      reason: "ENTITY_OVERLAP_ONLY",
      observed: TRAP_INPUT.frames[1]!.caption,
    },
  ],
};

/** Two candidates: early arc complete, Dong Zhuo trap. Route-level vs candidate-level. */
export const CANDIDATE_MIX_EARLY: IeCandidateInput = {
  candidateId: "MIX_EARLY",
  storyId: "story-early",
  frameIds: ["m1", "m2"],
  captionsByFrameId: {
    m1: "Yellow Turban Rebellion spreads. A recruitment notice is posted. Liu Bei, Guan Yu, and Zhang Fei swear brotherhood.",
    m2: "Patrons fund them. They arm a militia and win at Mount Daxing.",
  },
  claimedUnitIds: [
    "U-REBELLION",
    "U-NOTICE",
    "U-MEET-OATH",
    "U-ARMS",
    "U-DAXING",
  ],
  observations: [
    {
      unitId: "U-REBELLION",
      status: "PRESENT",
      supportingFrameIds: ["m1"],
      reason: "PRESERVED",
      observed:
        "Yellow Turban Rebellion spreads. A recruitment notice is posted. Liu Bei, Guan Yu, and Zhang Fei swear brotherhood.",
    },
    {
      unitId: "U-NOTICE",
      status: "PRESENT",
      supportingFrameIds: ["m1"],
      reason: "PRESERVED",
      observed:
        "Yellow Turban Rebellion spreads. A recruitment notice is posted. Liu Bei, Guan Yu, and Zhang Fei swear brotherhood.",
    },
    {
      unitId: "U-MEET-OATH",
      status: "PRESENT",
      supportingFrameIds: ["m1"],
      reason: "PRESERVED",
      observed:
        "Yellow Turban Rebellion spreads. A recruitment notice is posted. Liu Bei, Guan Yu, and Zhang Fei swear brotherhood.",
    },
    {
      unitId: "U-ARMS",
      status: "PRESENT",
      supportingFrameIds: ["m2"],
      reason: "PRESERVED",
      observed: "Patrons fund them. They arm a militia and win at Mount Daxing.",
    },
    {
      unitId: "U-DAXING",
      status: "PRESENT",
      supportingFrameIds: ["m2"],
      reason: "PRESERVED",
      observed: "Patrons fund them. They arm a militia and win at Mount Daxing.",
    },
  ],
};

export const CANDIDATE_MIX_TRAP: IeCandidateInput = {
  ...CANDIDATE_D_TRAP,
  candidateId: "MIX_TRAP",
};

export const GRANULARITY_INPUTS = {
  A_KEEP: FIXTURE_B_KEEP.input,
  B_LOSS: FIXTURE_B_LOSS.input,
  C_COMPRESSION: COMPRESSION_INPUT,
  D_TRAP: TRAP_INPUT,
};

export function trapCaptionHasAllEntities(): boolean {
  const text = Object.values(CANDIDATE_D_TRAP.captionsByFrameId).join(" ");
  return naiveEntitiesAllPresent(text, "U-ATTEMPT-PREVENTED");
}

export function compressionCaptionsOmitOptionalDetail(): boolean {
  const text = Object.values(CANDIDATE_C_COMPRESSION.captionsByFrameId)
    .join(" ")
    .toLowerCase();
  return COMPRESSION_OPTIONAL_DROPPED.every((d) => !text.includes(d.toLowerCase()));
}

export function compressionSourceHasOptionalDetail(): boolean {
  const src = COMPRESSION_SOURCE.toLowerCase();
  return COMPRESSION_OPTIONAL_DROPPED.every((d) => src.includes(d.toLowerCase()));
}

export { framesOf };
