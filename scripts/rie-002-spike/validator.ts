import { unitById } from "../rie-spike/inventory";
import type {
  IeCandidateInput,
  IeStatus,
  IeUnitResult,
  IeValidatorResult,
} from "./types";

/**
 * Candidate-level Information Equivalence validator.
 * Verdict is fixture/annotation-driven. Entity overlap is never PASS.
 * REQUIRED + (LOST | PARTIAL) → FAIL.
 * OPTIONAL/DISCARDABLE never fail the candidate.
 */
export function validateCandidateInformation(
  input: IeCandidateInput
): IeValidatorResult {
  const units: IeUnitResult[] = input.claimedUnitIds.map((unitId) => {
    const unit = unitById(unitId);
    const obs = input.observations.find((o) => o.unitId === unitId);
    if (!obs) {
      throw new Error(`${input.candidateId} missing observation for ${unitId}`);
    }
    return {
      unitId,
      kind: unit.kind,
      necessity: unit.necessity,
      status: obs.status,
      supportingFrameIds: obs.supportingFrameIds,
      reason: obs.reason,
      expected: unit.source,
      observed: obs.observed,
    };
  });

  const blocking = units.filter(
    (u) =>
      u.necessity === "REQUIRED" &&
      (u.status === "LOST" || u.status === "PARTIAL")
  );

  return {
    status: blocking.length === 0 ? "PASS" : "FAIL",
    scope: "candidate",
    units,
  };
}

/** Concatenate all candidates' captions as one reconstruction (diagnostic only). */
export function validateRouteInformation(
  candidates: IeCandidateInput[]
): IeValidatorResult {
  const merged: IeCandidateInput = {
    candidateId: "route-batch",
    storyId: "*",
    frameIds: candidates.flatMap((c) => c.frameIds),
    captionsByFrameId: Object.assign(
      {},
      ...candidates.map((c) => c.captionsByFrameId)
    ),
    claimedUnitIds: [...new Set(candidates.flatMap((c) => c.claimedUnitIds))],
    observations: mergeObservations(candidates),
  };
  const result = validateCandidateInformation(merged);
  return { ...result, scope: "route" };
}

function mergeObservations(
  candidates: IeCandidateInput[]
): IeCandidateInput["observations"] {
  const byId = new Map<string, IeCandidateInput["observations"][number]>();
  const rank = { PRESENT: 2, PARTIAL: 1, LOST: 0 } as const;
  for (const c of candidates) {
    for (const obs of c.observations) {
      const prev = byId.get(obs.unitId);
      if (!prev || rank[obs.status] > rank[prev.status]) {
        byId.set(obs.unitId, obs);
      }
    }
  }
  return [...byId.values()];
}

export function blockingUnits(result: IeValidatorResult): IeUnitResult[] {
  return result.units.filter(
    (u) =>
      u.necessity === "REQUIRED" &&
      (u.status === "LOST" || u.status === "PARTIAL")
  );
}

export function ieStatus(result: IeValidatorResult): IeStatus {
  return result.status;
}
