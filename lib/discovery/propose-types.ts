/**
 * SPEC-D3-003 §4 — Discovery Proposals data contracts
 *
 * Editorial hierarchy (ADR-005): Work → Story → Scene.
 * Candidate type "scene" is Editorial Scene (not Runtime Reading Route).
 */

import type { NarrativeInputBundle } from "@/lib/discovery/types";
import type {
  RendererExpression,
  VisualIntent,
} from "@/lib/discovery/visual-contract";

export type DiscoveryCandidateType =
  | "character"
  | "location"
  | "story"
  | "scene";

/** Story before Scene — Story-first propose order (Sprint #2). */
export const DISCOVERY_CANDIDATE_TYPES: DiscoveryCandidateType[] = [
  "character",
  "location",
  "story",
  "scene",
];

export interface DiscoveryEvidenceRef {
  sourceLabel: string;
  excerpt?: string;
  tier?: 1 | 2 | 3;
  url?: string;
}

export interface CharacterCandidateFields {
  name: string;
  house?: string;
  description?: string;
  signatureQuote?: string;
}

export interface LocationCandidateFields {
  name: string;
  region?: string;
  description?: string;
}

export interface StoryCandidateFields {
  title: string;
  summary: string;
  boundaryHint?: string;
}

export interface SceneCandidateFields {
  /** Required: Story candidateId this Scene belongs under (same propose batch). */
  parentStoryCandidateId: string;
  chapter_title?: string | null;
  chapter_number: number | string;
  title: string;
  summary?: string;
  /**
   * Narrative meaning (audit). Optional by scene; not Renderer input.
   * ADR-011 A3 / SPEC-DVE-001.
   */
  visualIntent?: VisualIntent | null;
  /**
   * Renderer-executable form — required for scene propose (PA-F).
   * Sole generation input after Accept → provenance.
   */
  rendererExpression: RendererExpression;
}

export type DiscoveryCandidateFields =
  | CharacterCandidateFields
  | LocationCandidateFields
  | StoryCandidateFields
  | SceneCandidateFields;

export interface DiscoveryCandidate {
  candidateId: string;
  candidateType: DiscoveryCandidateType;
  workId: string;
  displayName: string;
  summary: string;
  confidence?: "green" | "yellow" | "red";
  evidence?: DiscoveryEvidenceRef[];
  fields: DiscoveryCandidateFields;
}

export interface ProposeTypeError {
  candidateType: DiscoveryCandidateType;
  code: string;
  message: string;
}

export interface ProposeError {
  code: string;
  message: string;
  errors?: ProposeTypeError[];
}

export interface ProposeDiscoveryRequest {
  workId: string;
  sessionId: string;
  narrative: NarrativeInputBundle;
  lockedAt: string;
}

export interface ProposeDiscoveryResponse {
  sessionId: string;
  state: "review_pending";
  candidates: DiscoveryCandidate[];
  errors?: ProposeTypeError[];
}

export interface RegenDiscoveryRequest {
  workId: string;
  sessionId: string;
  narrative: NarrativeInputBundle;
  lockedAt: string;
  candidateType: DiscoveryCandidateType;
  previousCandidate: DiscoveryCandidate;
  feedback?: string | null;
}

export interface RegenDiscoveryResponse {
  sessionId: string;
  candidate: DiscoveryCandidate;
}
