/**
 * Discovery UI copy — SPEC-VDC-001 Phase 4c
 * All operator-facing strings sourced from lib/locale/zh-CN.ts
 */

import { messages } from "@/lib/locale";
import type { DiscoveryCandidateType } from "@/lib/discovery/propose-types";
import type { ReviewItemStatus } from "@/lib/discovery/review-types";

const d = messages.discovery;

export const DISCOVERY_PAGE_TITLE = d.pageTitle;
export const DISCOVERY_PAGE_SUBTITLE = d.pageSubtitle;
export const DISCOVERY_GO_PRODUCTION = d.goProduction;

export const DISCOVERY_CANDIDATE_TYPE_LABELS: Record<
  DiscoveryCandidateType,
  string
> = {
  character: d.candidateTypes.character,
  location: d.candidateTypes.location,
  story: d.storyCandidate,
  scene: d.sceneCandidate,
};

export const REVIEW_STATUS_LABELS: Record<ReviewItemStatus, string> =
  d.reviewStatus;

export const CONFIDENCE_LABELS: Record<"green" | "yellow" | "red", string> =
  d.confidence;

export const CANDIDATE_FIELD_LABELS: Record<string, string> =
  d.candidateFields;

export function candidateFieldLabel(key: string): string {
  return CANDIDATE_FIELD_LABELS[key] ?? key;
}

export const discoveryReviewUi = {
  ...d.review,
  flowHintAccepted: d.flowHintAccepted,
  flowHintAcceptedEmpty: d.flowHintAcceptedEmpty,
  nextStepRollout: d.nextStepRollout,
  acceptedSceneStaging: d.sceneCandidateStaging,
  goRollout: d.goRollout,
  editAfterAcceptSceneHint: d.editAfterAcceptSceneHint,
  editStagingHint: d.editStagingHint,
  confirmRevokeAccept: d.confirmRevokeAccept,
  confirmRevokeStoryWithScenes: d.confirmRevokeStoryWithScenes,
  fieldsJsonLabel: d.fieldsJsonLabel,
  fieldsJsonParseError: d.fieldsJsonParseError,
} as const;

export const discoveryHandoffUi = d.handoff;

export const discoveryComposerUi = {
  ...d.composer,
  runtimeExportOnlyFlag: d.runtimeExportOnlyFlag,
} as const;

/** Operator-facing API error line (lock-lost → re-lock guidance, not raw English). */
export function discoveryApiErrorText(error: {
  code: string;
  message: string;
}): string {
  if (error.code === "NARRATIVE_NOT_LOCKED") {
    return discoveryComposerUi.narrativeLockLost;
  }
  if (error.code === "GRANULARITY_GATE_BLOCKED") {
    return discoveryReviewUi.granularityGateBlocked;
  }
  if (error.code === "GRANULARITY_GATE_CONTEXT_REQUIRED") {
    return discoveryReviewUi.granularityGateContextRequired;
  }
  if (error.code === "INFORMATION_EQUIVALENCE_BLOCKED") {
    return discoveryReviewUi.informationEquivalenceBlocked;
  }
  if (error.code === "INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED") {
    return discoveryReviewUi.informationEquivalenceContextRequired;
  }
  if (error.code === "AUTHORITY_BIND_INCOMPLETE") {
    return discoveryReviewUi.authorityBindIncomplete;
  }
  return `${error.code}: ${error.message}`;
}
