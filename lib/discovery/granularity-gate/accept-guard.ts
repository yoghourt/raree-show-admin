import type { DiscoveryCandidateType } from "@/lib/discovery/propose-types";
import type { AcceptReviewError } from "@/lib/discovery/review-types";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

import type { GranularityGateResult, GranularityLabels } from "./types";

/** Required for Story/Frame Accept. Character/Location may omit this. */
export type GranularityAcceptContext = {
  narrative: NarrativeInputBundle;
  labels?: GranularityLabels;
};

export const GRANULARITY_GATE_ACCEPT_BLOCKED = "GRANULARITY_GATE_BLOCKED";

export const GRANULARITY_GATE_CONTEXT_REQUIRED =
  "GRANULARITY_GATE_CONTEXT_REQUIRED";

/** Existing operator action — DiscoveryReviewPanel「全部重新提炼」/ startFullRePropose. */
export const GRANULARITY_GATE_REPROPOSE_ACTION = "RE-PROPOSE" as const;

export function granularityContextRequired(): AcceptReviewError {
  return {
    ok: false,
    code: GRANULARITY_GATE_CONTEXT_REQUIRED,
    message:
      "Granularity Gate requires narrative context. Story/Frame Accept cannot proceed without it.",
  };
}

export function granularityAcceptBlock(
  result: GranularityGateResult
): AcceptReviewError | null {
  if (result.status !== "FAIL") return null;
  const errors = result.violations.filter((v) => v.severity === "error");
  return {
    ok: false,
    code: GRANULARITY_GATE_ACCEPT_BLOCKED,
    message:
      "Granularity Gate FAIL — Accept is blocked. Re-run Propose (全部重新提炼).",
    fieldErrors: errors.map(
      (v) => `${v.invariant}: ${v.evidence[0] ?? "violation"}`
    ),
  };
}

export function granularityBlocksCandidateType(
  candidateType: DiscoveryCandidateType
): boolean {
  return candidateType === "story" || candidateType === "scene";
}
