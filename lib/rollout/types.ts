/**
 * SPEC-ROL-001 — Rollout data contracts
 */

import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";

export type StoryUnitStatus = "active" | "archived";

export interface ApprovedStoryUnit {
  id: string;
  workId: string;
  sourceReviewId: string;
  title: string;
  summary: string;
  boundaryHint?: string;
  approvedAt: string;
  status: StoryUnitStatus;
}

export interface StorySceneProjectionLink {
  id: string;
  workId: string;
  storyUnitId: string;
  sceneTsid: string;
  linkedAt: string;
  linkedBy: string;
  source: "operator_projection_accept";
}

/** Client-side record for reversing Scene projection back to staging */
export interface ProjectedSceneRecord {
  sourceReviewId: string;
  sceneTsid: string;
  mode: "create" | "link_existing";
  staging: AcceptedSceneCandidateStaging;
}

export interface RolloutQueueSnapshot {
  workId: string;
  storyStaging: AcceptedStoryUnitStaging[];
  sceneStaging: AcceptedSceneCandidateStaging[];
  /** Staging already persisted to story_units — excluded from pending import */
  processedStoryReviewIds?: string[];
  /** Staging already projected to Runtime Scene — excluded from pending import */
  processedSceneReviewIds?: string[];
  /** Removed from pending queue — shown in dismissed list until restored */
  dismissedStoryStaging?: AcceptedStoryUnitStaging[];
  dismissedSceneStaging?: AcceptedSceneCandidateStaging[];
  dismissedStoryReviewIds?: string[];
  dismissedSceneReviewIds?: string[];
  /** Scene projection records for cancel-projection (client v1) */
  projectedScenes?: ProjectedSceneRecord[];
  updatedAt: string;
}

export interface RolloutStateResponse {
  ok: true;
  workId: string;
  queue: RolloutQueueSnapshot;
  storyUnits: ApprovedStoryUnit[];
  links: StorySceneProjectionLink[];
  scenes: Array<{ tsid: string; title: string; chapter_number: number }>;
}

export type RolloutErrorCode =
  | "UNAUTHORIZED"
  | "STAGING_NOT_FOUND"
  | "STORY_UNIT_NOT_FOUND"
  | "SCENE_NOT_FOUND"
  | "SCENE_WORK_MISMATCH"
  | "LINK_ALREADY_EXISTS"
  | "STAGING_INVALID"
  | "SCENE_VALIDATION_FAILED"
  | "ARCHIVE_BLOCKED"
  | "DELETE_BLOCKED"
  | "UNPERSIST_BLOCKED"
  | "UNPROJECT_BLOCKED"
  | "WORK_MISMATCH"
  | "INVALID_BODY";

export interface RolloutErrorBody {
  error: {
    code: RolloutErrorCode;
    message: string;
    fields?: string[];
    fieldErrors?: Record<string, string[]>;
  };
}
