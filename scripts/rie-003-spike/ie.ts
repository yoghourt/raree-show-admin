/**
 * Read-only adapter onto the production IE validator.
 * Spike must not change that validator.
 */

import {
  RIE_001_CLAIMED_REQUIRED_UNITS,
  evaluateInformationEquivalence,
  type ClaimedRequiredUnit,
} from "../../lib/discovery/information-equivalence";

export function claimedUnitsForIds(ids: string[]): ClaimedRequiredUnit[] {
  return ids.map((unitId) => {
    const found = RIE_001_CLAIMED_REQUIRED_UNITS.find(
      (u) => u.unitId === unitId
    );
    if (!found) {
      throw new Error(`no production claim contract for ${unitId}`);
    }
    return found;
  });
}

export function runIe(input: {
  frames: Array<{ id: string; caption: string }>;
  claimedUnitIds: string[];
}) {
  if (input.claimedUnitIds.length === 0) {
    return {
      status: "CONTEXT_REQUIRED" as const,
      units: [],
    };
  }
  return evaluateInformationEquivalence({
    frames: input.frames,
    claimedRequiredUnits: claimedUnitsForIds(input.claimedUnitIds),
  });
}

/** Entity-only claims — proves a compound cannot be replaced by four names. */
export const ENTITY_OVERLAP_CLAIMS: ClaimedRequiredUnit[] = [
  {
    unitId: "U-PEOPLE-PRESENT",
    kind: "proper_noun_grounding",
    expected: "Liu Bei, Guan Yu, Zhang Fei, and Dong Zhuo are present",
    relationEvidence: [
      ["Liu Bei"],
      ["Guan Yu"],
      ["Zhang Fei"],
      ["Dong Zhuo"],
    ],
  },
];
