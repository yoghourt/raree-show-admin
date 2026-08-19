/**
 * SPIKE-RIE-001 — Discovery → Reader Information Equivalence (spike-only).
 * Reader-visible narrative authority is Frame.caption only.
 */

export type Necessity = "REQUIRED" | "OPTIONAL" | "DISCARDABLE";

export type UnitKind =
  | "event"
  | "causal_turn"
  | "attempted_action"
  | "prevented_action"
  | "consequence"
  | "relationship_change"
  | "proper_noun_grounding";

export type Coverage = "PRESENT" | "PARTIAL" | "LOST";

export type NarrativeUnit = {
  id: string;
  kind: UnitKind;
  necessity: Necessity;
  /** Source wording (inventory). */
  source: string;
  /** English gloss for matching English Propose captions. */
  gloss: string;
  /**
   * Entities that naive overlap would treat as "the unit is present".
   * Must not be used as semantic equivalence.
   */
  naiveEntities: string[];
};

export type UnitTrace = {
  unitId: string;
  storySummary: Coverage;
  frameCaption: Coverage;
  /** Reader reconstruction uses Frame.caption only. */
  readerCanRecover: Coverage;
};

export type InformationVerdict = "PASS" | "FAIL";

export type TraceRow = {
  unitId: string;
  kind: UnitKind;
  necessity: Necessity;
  source: string;
  storySummary: Coverage;
  frameCaption: Coverage;
  readerCanRecover: Coverage;
};
