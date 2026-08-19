/**
 * Work Canon → Story Bind (SPIKE-RIE-003 D).
 * Does not author Canon. Does not run IE.
 */

import type { ClaimedRequiredUnit } from "@/lib/discovery/information-equivalence";

export type CanonNecessity = "REQUIRED" | "OPTIONAL" | "DISCARDABLE";

export type WorkCanonUnit = {
  unitId: string;
  necessity: CanonNecessity;
  /** Required for REQUIRED units that will be sent to IE. */
  claim?: ClaimedRequiredUnit;
};

export type WorkCanon = {
  units: WorkCanonUnit[];
};

export type StoryBind = {
  storyCandidateId: string;
  unitIds: string[];
};

/** Accept-time authority. Propose claims are not a field here. */
export type RequiredUnitAuthorityContext = {
  workCanon: WorkCanon;
  storyBinds: StoryBind[];
};

export type AuthorityBindStatus = "COMPLETE" | "INCOMPLETE" | "CONTEXT_REQUIRED";

export type AuthorityInspection = {
  status: AuthorityBindStatus;
  unboundRequiredIds: string[];
  duplicateUnitIds: string[];
  unknownUnitIds: string[];
  errors: string[];
};
