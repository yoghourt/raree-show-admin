/**
 * Candidate-level Information Equivalence — Propose → Review Accept.
 * Validator only. Spike: SPIKE-RIE-002.
 * Reader authority is Frame.caption only (never Story.summary).
 */

export type IeUnitKind =
  | "event"
  | "causal_turn"
  | "attempted_action"
  | "prevented_action"
  | "consequence"
  | "relationship_change"
  | "proper_noun_grounding";

export type IeCoverage = "PRESENT" | "PARTIAL" | "LOST";

export type IeVerdictStatus = "PASS" | "FAIL" | "CONTEXT_REQUIRED";

export type IeReason =
  | "PRESERVED"
  | "ENTITY_OVERLAP_ONLY"
  | "ATTEMPT_WITHOUT_INTERRUPTION"
  | "PARTIAL_NOT_RECOVERABLE"
  | "ABSENT_FROM_CAPTIONS";

/**
 * Caller-supplied REQUIRED unit. Not selected by Work id.
 * relationEvidence: ALL groups must hit captions (any phrase within a group).
 * naiveEntities: trap detection only — never sufficient for PRESENT.
 */
export type ClaimedRequiredUnit = {
  unitId: string;
  kind: IeUnitKind;
  expected: string;
  relationEvidence: string[][];
  naiveEntities?: string[];
};

export type IeFrame = {
  id: string;
  caption: string;
};

export type IeUnitResult = {
  unitId: string;
  kind: IeUnitKind;
  status: IeCoverage;
  supportingFrameIds: string[];
  reason: IeReason;
  expected: string;
  observed: string;
};

export type InformationEquivalenceResult = {
  status: IeVerdictStatus;
  scope: "candidate";
  units: IeUnitResult[];
};

export type InformationEquivalenceAcceptContext = {
  claimedRequiredUnits: ClaimedRequiredUnit[];
};
