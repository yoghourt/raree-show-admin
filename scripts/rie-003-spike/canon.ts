/**
 * Source-derived Work canon for this spike.
 *
 * Completeness here is a **human annotation fact** (SPIKE-RIE-001 inventory
 * against the excerpt). This file does not read Propose output, captions,
 * or Story.summary.
 */

import {
  NARRATIVE_UNITS,
  REQUIRED_UNITS,
} from "../rie-spike/inventory";

export const COMPOUND_REQUIRED_UNIT_ID = "U-ATTEMPT-PREVENTED";

export const OPTIONAL_OR_DISCARDABLE_IDS = NARRATIVE_UNITS.filter(
  (u) => u.necessity === "OPTIONAL" || u.necessity === "DISCARDABLE"
).map((u) => u.id);

export const REQUIRED_UNIT_IDS = REQUIRED_UNITS.map((u) => u.id);

export const EARLY_REQUIRED_IDS = [
  "U-REBELLION",
  "U-NOTICE",
  "U-MEET-OATH",
  "U-ARMS",
  "U-DAXING",
] as const;

export const DONG_REQUIRED_IDS = [
  "U-RESCUE",
  "U-SCORN",
  "U-ATTEMPT",
  "U-PREVENT",
  "U-ATTEMPT-PREVENTED",
] as const;

export function isCompoundRequired(unitId: string): boolean {
  return unitId === COMPOUND_REQUIRED_UNIT_ID;
}

export function requiredIds(): string[] {
  return [...REQUIRED_UNIT_IDS];
}
