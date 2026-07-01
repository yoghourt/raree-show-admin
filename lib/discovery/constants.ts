/**
 * SPEC-D3-001 §4.5 — resolved thresholds and gate rule identifiers
 */

export const EXCERPT_BUNDLE_MIN_PROSE = 512;
export const APPROVED_SUMMARY_MIN_PROSE = 768;

export const NARRATIVE_GATE_RULE_IDS = [
  "NG-01",
  "NG-02",
  "NG-03",
  "NG-04",
  "NG-05",
  "NG-06",
  "NG-07",
] as const;

export type NarrativeGateRuleId = (typeof NARRATIVE_GATE_RULE_IDS)[number];

/** SPEC-D3-003 OQ-D3-003-05 — max Candidates per type per propose response */
export const MAX_CANDIDATES_PER_TYPE = 10;
