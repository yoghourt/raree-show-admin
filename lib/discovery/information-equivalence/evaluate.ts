import type {
  ClaimedRequiredUnit,
  IeCoverage,
  IeFrame,
  IeReason,
  IeUnitResult,
  InformationEquivalenceResult,
} from "./types";

function hayHas(hay: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function captionHay(frames: IeFrame[]): string {
  return frames.map((f) => f.caption).join("\n");
}

function groupHits(hay: string, group: string[]): boolean {
  return group.some((phrase) => hayHas(hay, phrase));
}

function entitiesAllPresent(hay: string, entities: string[] | undefined): boolean {
  if (!entities || entities.length === 0) return false;
  return entities.every((e) => hayHas(hay, e));
}

function supportingFrames(frames: IeFrame[], unit: ClaimedRequiredUnit): string[] {
  const needles = [
    ...unit.relationEvidence.flat(),
    ...(unit.naiveEntities ?? []),
  ];
  return frames
    .filter((f) => needles.some((n) => hayHas(f.caption, n)))
    .map((f) => f.id);
}

function evaluateUnit(frames: IeFrame[], unit: ClaimedRequiredUnit): IeUnitResult {
  const hay = captionHay(frames);
  const groups = unit.relationEvidence.filter((g) => g.length > 0);
  const hitCount = groups.filter((g) => groupHits(hay, g)).length;
  const observed = hay.trim() || "(empty captions)";
  const supportingFrameIds = supportingFrames(frames, unit);

  let status: IeCoverage;
  let reason: IeReason;

  if (groups.length === 0) {
    status = "LOST";
    reason = "ABSENT_FROM_CAPTIONS";
  } else if (hitCount === groups.length) {
    status = "PRESENT";
    reason = "PRESERVED";
  } else if (hitCount > 0) {
    status = "PARTIAL";
    reason =
      unit.unitId === "U-ATTEMPT-PREVENTED"
        ? "ATTEMPT_WITHOUT_INTERRUPTION"
        : "PARTIAL_NOT_RECOVERABLE";
  } else if (entitiesAllPresent(hay, unit.naiveEntities)) {
    status = "LOST";
    reason = "ENTITY_OVERLAP_ONLY";
  } else {
    status = "LOST";
    reason = "ABSENT_FROM_CAPTIONS";
  }

  return {
    unitId: unit.unitId,
    kind: unit.kind,
    status,
    supportingFrameIds,
    reason,
    expected: unit.expected,
    observed,
  };
}

/**
 * Candidate-level IE. Searches Frame.caption only.
 * REQUIRED + PARTIAL/LOST → FAIL. Does not read Story.summary.
 */
export function evaluateInformationEquivalence(input: {
  frames: IeFrame[];
  claimedRequiredUnits: ClaimedRequiredUnit[];
}): InformationEquivalenceResult {
  const units = input.claimedRequiredUnits.map((u) =>
    evaluateUnit(input.frames, u)
  );
  const blocked = units.some(
    (u) => u.status === "LOST" || u.status === "PARTIAL"
  );
  return {
    status: blocked ? "FAIL" : "PASS",
    scope: "candidate",
    units,
  };
}
