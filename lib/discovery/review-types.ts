/**
 * SPEC-D3-002 §4 — Discovery Human Review data contracts
 *
 * Editorial hierarchy: Scene staging always references parent Story.
 */

import type {
  DiscoveryCandidate,
  DiscoveryCandidateFields,
} from "@/lib/discovery/propose-types";
import type {
  RendererExpression,
  VisualIntent,
} from "@/lib/discovery/visual-contract";

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

export interface StoryRelatedCharacterRef {
  sourceReviewId: string;
  name: string;
  matchedTsid?: string;
  house?: string;
  description?: string;
  signatureQuote?: string | null;
}

export interface StoryRelatedLocationRef {
  sourceReviewId: string;
  name: string;
  matchedTsid?: string;
  region?: string;
  description?: string;
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
  /** Optional chapter metadata for write preview / persist. */
  chapter_number?: number;
  chapter_title?: string | null;
  /** Batch characters treated as story attributes (resolved at persist). */
  relatedCharacterRefs?: StoryRelatedCharacterRef[];
  /** Batch locations treated as story attributes (first used as route location). */
  relatedLocationRefs?: StoryRelatedLocationRef[];
  /** Resolved tsids ready for Reading Route write. */
  characterIds?: string[];
  locationId?: string | null;
}

/** Catalog Character staging — Rollout preview then CRUD Save (not Discovery Accept). */
export interface AcceptedCharacterStaging {
  workId: string;
  sourceReviewId: string;
  sourceCandidateId?: string;
  name: string;
  house: string;
  description: string;
  signatureQuote: string | null;
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
  /** Audit only — not used for image generation (SPEC-DVE-001). */
  visualIntent?: VisualIntent | null;
  /**
   * Creator generation input — projected to frame_provenance_v1 (ADR-011 A3).
   * Present on new Accepts; optional for legacy queue snapshots.
   */
  rendererExpression?: RendererExpression;
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
      kind: "character_staging";
      staging: AcceptedCharacterStaging;
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
