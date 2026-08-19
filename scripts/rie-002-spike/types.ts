/**
 * SPIKE-RIE-002 — Information Equivalence validator contract (spike-only).
 * Not wired into Propose / Review / Accept.
 */

import type { Coverage, Necessity, UnitKind } from "../rie-spike/types";

export type IeStatus = "PASS" | "FAIL";

export type IeFailReason =
  | "PRESERVED"
  | "OPTIONAL_COMPRESSED"
  | "ENTITY_OVERLAP_ONLY"
  | "ATTEMPT_WITHOUT_INTERRUPTION"
  | "STORY_ONLY"
  | "PARTIAL_NOT_RECOVERABLE"
  | "ABSENT_FROM_CAPTIONS";

export type IeUnitResult = {
  unitId: string;
  kind: UnitKind;
  necessity: Necessity;
  status: Coverage;
  supportingFrameIds: string[];
  reason: IeFailReason;
  expected: string;
  observed: string;
};

export type IeValidatorResult = {
  status: IeStatus;
  scope: "candidate" | "route";
  units: IeUnitResult[];
};

export type IeObservation = {
  unitId: string;
  /** Caption-sequence coverage. Story.summary is never the verdict. */
  status: Coverage;
  supportingFrameIds: string[];
  reason: IeFailReason;
  observed: string;
};

export type IeCandidateInput = {
  candidateId: string;
  storyId: string;
  frameIds: string[];
  captionsByFrameId: Record<string, string>;
  /** REQUIRED units this Story/Route is responsible for. */
  claimedUnitIds: string[];
  observations: IeObservation[];
};
