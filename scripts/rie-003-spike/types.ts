/**
 * SPIKE-RIE-003 — Required unit authority (spike-only).
 * Does not change production IE / Gate / Accept / Reader.
 */

export type AuthorityId =
  | "A_HUMAN"
  | "B_WORK_CANON"
  | "C_PROPOSE"
  | "D_HYBRID";

export type BindStatus = "COMPLETE" | "INCOMPLETE" | "EMPTY";

export type StoryClaimResolution = {
  authority: AuthorityId;
  storyId: string;
  claimedUnitIds: string[];
  bindStatus: BindStatus;
  /** Why these ids were selected — for audit, not IE. */
  origin: string;
};

export type CompletenessFinding =
  | "OK"
  | "AUTHORITY_COMPLETENESS_FAILURE"
  | "OWNERSHIP_OVERBLOCK"
  | "BIND_INCOMPLETE";
