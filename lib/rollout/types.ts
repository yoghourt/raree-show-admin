/**
 * SPEC-ROL-001 / ROL-002 — Rollout data contracts
 */

import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";

export type StoryUnitStatus = "active" | "archived";

export type SceneProjectionMode = "create" | "link_existing";

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

/** Editorial Approved Scene unit — durable at Projection Accept (not Discovery Accept). */
export interface ApprovedSceneUnit {
  id: string;
  workId: string;
  parentStoryUnitId: string;
  sourceReviewId: string;
  title: string;
  chapterNumber: number;
  chapterTitle?: string | null;
  summary?: string;
  approvedAt: string;
  approvedBy: string;
}

/** Story ↔ Reading Route association (ADR-007). Distinct from SceneProjectionLink. */
export interface StoryReadingRouteProjectionLink {
  id: string;
  workId: string;
  storyUnitId: string;
  sceneTsid: string;
  linkedAt: string;
  linkedBy: string;
  source: "operator_projection_accept";
}

/** Approved Scene ↔ Reading Route association (SPEC-ROL-002). */
export interface SceneProjectionLink {
  id: string;
  workId: string;
  approvedSceneUnitId: string;
  readingRouteTsid: string;
  projectionMode: SceneProjectionMode;
  sourceReviewId: string;
  companionStoryLinkId?: string | null;
  acceptedAt: string;
  acceptedBy: string;
}

/** Client-side cache for reversing projection UX (server truth = scene_projection_links). */
export interface ProjectedReadingRouteRecord {
  sourceReviewId: string;
  sceneTsid: string;
  mode: SceneProjectionMode;
  staging: AcceptedSceneCandidateStaging;
  approvedSceneUnitId?: string;
  sceneProjectionLinkId?: string;
}

export interface RolloutQueueSnapshot {
  workId: string;
  storyStaging: AcceptedStoryUnitStaging[];
  readingRouteStaging: AcceptedSceneCandidateStaging[];
  processedStoryReviewIds?: string[];
  processedReadingRouteReviewIds?: string[];
  dismissedStoryStaging?: AcceptedStoryUnitStaging[];
  dismissedReadingRouteStaging?: AcceptedSceneCandidateStaging[];
  dismissedStoryReviewIds?: string[];
  dismissedReadingRouteReviewIds?: string[];
  projectedReadingRoutes?: ProjectedReadingRouteRecord[];
  updatedAt: string;
}

export interface RolloutStateResponse {
  ok: true;
  workId: string;
  queue: RolloutQueueSnapshot;
  storyUnits: ApprovedStoryUnit[];
  /** Soft-deprecated Sprint #1 — empty on Hotfix happy path */
  approvedSceneUnits: ApprovedSceneUnit[];
  sceneProjectionLinks: SceneProjectionLink[];
  links: StoryReadingRouteProjectionLink[];
  /** Hotfix: Scene staging → Frame provenance on parent Route */
  frameProjections: Array<{
    sourceReviewId: string;
    readingRouteTsid: string;
    frameIndex: number;
    caption: string;
  }>;
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
  | "PARENT_STORY_NOT_PERSISTED"
  | "PARENT_STORY_MISMATCH"
  | "ALREADY_PROJECTED"
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
