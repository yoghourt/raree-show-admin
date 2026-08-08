/**
 * Hotfix — Reading Route / Frame Projection Accept (thin adapter)
 *
 * Scene staging → Reading Frame on parent Route. Legacy field names kept
 * for client compatibility where possible.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  executeSceneProjection,
  unprojectSceneProjection,
} from "@/lib/rollout/projection-engine";
import type {
  RolloutErrorCode,
  SceneProjectionMode,
  StoryReadingRouteProjectionLink,
} from "@/lib/rollout/types";

export type ReadingRouteProjectionResult =
  | {
      ok: true;
      sceneTsid: string;
      frameIndex: number;
      sourceReviewId: string;
      /** IMPLEMENT-SCC-001-S1 */
      contextId?: string;
      contextPath?: boolean;
      /** Soft-compat: empty / synthetic for older clients */
      approvedSceneUnitId: string;
      sceneProjectionLinkId: string;
      link?: StoryReadingRouteProjectionLink;
    }
  | {
      ok: false;
      code: RolloutErrorCode;
      fieldErrors?: Record<string, string[]>;
      message: string;
    };

export async function acceptReadingRouteProjection(
  supabase: SupabaseClient,
  params: {
    workId: string;
    staging: AcceptedSceneCandidateStaging;
    mode: SceneProjectionMode;
    sceneTsid?: string;
    linkToStoryUnitId?: string;
    operatorId: string;
  }
): Promise<ReadingRouteProjectionResult> {
  const result = await executeSceneProjection(supabase, params);
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    };
  }

  return {
    ok: true,
    sceneTsid: result.readingRouteTsid,
    frameIndex: result.frameIndex,
    sourceReviewId: result.sourceReviewId,
    ...(result.contextId ? { contextId: result.contextId } : {}),
    ...(result.contextPath !== undefined
      ? { contextPath: result.contextPath }
      : {}),
    // Compat placeholders — Hotfix does not create AS/SPL rows
    approvedSceneUnitId: result.sourceReviewId,
    sceneProjectionLinkId: `${result.readingRouteTsid}:${result.frameIndex}`,
  };
}

/**
 * Unpersist Reading Frame by sourceReviewId. Does not delete Reading Route.
 */
export async function unprojectReadingRoute(
  supabase: SupabaseClient,
  workId: string,
  params: {
    sceneProjectionLinkId?: string;
    sourceReviewId?: string;
    sceneTsid?: string;
    mode?: SceneProjectionMode;
  }
): Promise<
  | {
      ok: true;
      sourceReviewId: string;
      readingRouteTsid: string;
    }
  | { ok: false; code: RolloutErrorCode; message: string }
> {
  return unprojectSceneProjection(supabase, {
    workId,
    sceneProjectionLinkId: params.sceneProjectionLinkId,
    sourceReviewId: params.sourceReviewId,
    sceneTsid: params.sceneTsid,
  });
}
