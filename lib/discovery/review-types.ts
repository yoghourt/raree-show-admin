/**
 * SPEC-D3-002 §4 — Discovery Human Review data contracts
 *
 * Editorial hierarchy: Scene staging always references parent Story.
 */

import type {
  DiscoveryCandidate,
  DiscoveryCandidateFields,
} from "@/lib/discovery/propose-types";

export type ReviewItemStatus =
  | "pending"
  | "edited_pending_accept"
  | "discarded"
  | "accepted";

export interface DiscoveryReviewItem {
  reviewId: string;
  candidate: DiscoveryCandidate;
  status: ReviewItemStatus;
  editedFields?: DiscoveryCandidateFields;
  editedDisplayName?: string;
  editedSummary?: string;
  operatorNotes?: string;
  reviewedAt?: string;
}

export interface DiscoveryAcceptPrefill {
  source: "discovery_review";
  reviewId: string;
  candidateType: "character" | "location";
  workId: string;
  fields: Record<string, unknown>;
  displayName: string;
  summary: string;
}

export interface AcceptedStoryUnitStaging {
  workId: string;
  sourceReviewId: string;
  /** Candidate id from propose — used to resolve Scene parent links. Required for Sprint #2 Accept. */
  sourceCandidateId?: string;
  title: string;
  summary: string;
  boundaryHint?: string;
  acceptedAt: string;
}

export interface AcceptedSceneCandidateStaging {
  workId: string;
  sourceReviewId: string;
  /** Accepted Story staging sourceReviewId (parent). Required for Sprint #2 Accept. */
  parentStorySourceReviewId?: string;
  parentStoryTitle?: string;
  chapter_title?: string | null;
  chapter_number: number | string;
  title: string;
  summary?: string;
  acceptedAt: string;
}

export type AcceptReviewResult =
  | {
      ok: true;
      kind: "entity_prefill";
      path: string;
      prefill: DiscoveryAcceptPrefill;
    }
  | {
      ok: true;
      kind: "story_staging";
      staging: AcceptedStoryUnitStaging;
    }
  | {
      ok: true;
      kind: "scene_staging";
      staging: AcceptedSceneCandidateStaging;
    };

export type AcceptReviewError = {
  ok: false;
  code: string;
  message: string;
  fieldErrors?: string[];
};
