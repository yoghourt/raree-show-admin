import type { AcceptReviewError } from "@/lib/discovery/review-types";

import { evaluateInformationEquivalence } from "./evaluate";
import type {
  ClaimedRequiredUnit,
  IeFrame,
  InformationEquivalenceAcceptContext,
  InformationEquivalenceResult,
} from "./types";

export const INFORMATION_EQUIVALENCE_BLOCKED =
  "INFORMATION_EQUIVALENCE_BLOCKED";

export const INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED =
  "INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED";

export function informationEquivalenceContextRequired(): AcceptReviewError {
  return {
    ok: false,
    code: INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED,
    message:
      "Information Equivalence requires claimed REQUIRED narrative units. Story/Frame Accept cannot proceed without them.",
  };
}

export function hasClaimedRequiredUnits(
  ie: InformationEquivalenceAcceptContext | undefined
): ie is InformationEquivalenceAcceptContext {
  return Boolean(ie?.claimedRequiredUnits && ie.claimedRequiredUnits.length > 0);
}

export function informationEquivalenceAcceptBlock(
  result: InformationEquivalenceResult
): AcceptReviewError | null {
  if (result.status !== "FAIL") return null;
  const failed = result.units.filter(
    (u) => u.status === "LOST" || u.status === "PARTIAL"
  );
  return {
    ok: false,
    code: INFORMATION_EQUIVALENCE_BLOCKED,
    message:
      "Information Equivalence FAIL — Accept is blocked. Edit captions or re-run Propose (全部重新提炼).",
    fieldErrors: failed.map((u) => {
      const frames =
        u.supportingFrameIds.length > 0
          ? u.supportingFrameIds.join(", ")
          : "(none)";
      return `${u.unitId} ${u.status} (${u.reason}): expected “${u.expected}”; supportingFrames=${frames}`;
    }),
  };
}

export function runInformationEquivalenceForAccept(
  frames: IeFrame[],
  claimedRequiredUnits: ClaimedRequiredUnit[]
): InformationEquivalenceResult {
  return evaluateInformationEquivalence({ frames, claimedRequiredUnits });
}
