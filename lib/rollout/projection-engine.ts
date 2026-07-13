/**
 * Hotfix — Projection Engine: Scene staging → Reading Frame on parent Route.
 * Does NOT create Reading Routes from Scene staging.
 * Does NOT write approved_scene_units / scene_projection_links.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  persistReadingFrameFromSceneStaging,
  unpersistReadingFrame,
} from "@/lib/rollout/reading-frame-persist";
import { getActiveStoryUnitBySourceReviewId } from "@/lib/rollout/story-units";
import type {
  RolloutErrorCode,
  SceneProjectionMode,
} from "@/lib/rollout/types";

export type ProjectionValidationFailure = {
  ok: false;
  code: RolloutErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ProjectionValidationSuccess = {
  ok: true;
  parentRouteTsid: string;
  parentSourceReviewId: string;
};

export type ProjectionValidationResult =
  | ProjectionValidationSuccess
  | ProjectionValidationFailure;

export type ProjectionExecuteResult =
  | {
      ok: true;
      readingRouteTsid: string;
      frameIndex: number;
      sourceReviewId: string;
      /** Soft-compat fields for older API clients */
      approvedSceneUnit?: undefined;
      sceneProjectionLink?: undefined;
      storyLink?: undefined;
    }
  | ProjectionValidationFailure;

/**
 * Validate Scene → Frame projection (parent Reading Route must exist).
 */
export async function validateSceneProjection(
  supabase: SupabaseClient,
  params: {
    workId: string;
    staging: AcceptedSceneCandidateStaging;
    mode: SceneProjectionMode;
    sceneTsid?: string;
    linkToStoryUnitId?: string;
  }
): Promise<ProjectionValidationResult> {
  const { workId, staging, mode, sceneTsid, linkToStoryUnitId } = params;

  if (staging.workId !== workId) {
    return {
      ok: false,
      code: "WORK_MISMATCH",
      message: "Staging workId does not match request workId",
    };
  }

  const parentReviewId = staging.parentStorySourceReviewId?.trim();
  if (!parentReviewId) {
    return {
      ok: false,
      code: "PARENT_STORY_NOT_PERSISTED",
      message: "parentStorySourceReviewId is required",
    };
  }

  if (!staging.title?.trim()) {
    return {
      ok: false,
      code: "SCENE_VALIDATION_FAILED",
      message: "title is required for Reading Frame caption",
      fieldErrors: { title: ["title is required"] },
    };
  }

  const parent = await getActiveStoryUnitBySourceReviewId(
    supabase,
    workId,
    parentReviewId
  );
  if (!parent) {
    return {
      ok: false,
      code: "PARENT_STORY_NOT_PERSISTED",
      message:
        "Parent Reading Route not persisted — persist Story staging first",
    };
  }

  if (linkToStoryUnitId && linkToStoryUnitId !== parent.id) {
    return {
      ok: false,
      code: "PARENT_STORY_MISMATCH",
      message:
        "linkToStoryUnitId must match the persisted parent Reading Route tsid",
    };
  }

  // link_existing: optional attach-to-explicit Route (must be parent)
  if (mode === "link_existing") {
    const target = sceneTsid?.trim();
    if (!target) {
      return {
        ok: false,
        code: "SCENE_NOT_FOUND",
        message: "sceneTsid is required for link_existing (parent Route tsid)",
      };
    }
    if (target !== parent.id) {
      return {
        ok: false,
        code: "PARENT_STORY_MISMATCH",
        message:
          "Hotfix: Frame must attach to parent Reading Route from Story staging",
      };
    }
  }

  return {
    ok: true,
    parentRouteTsid: parent.id,
    parentSourceReviewId: parentReviewId,
  };
}

/**
 * Validate then append/update Reading Frame on parent Route.
 */
export async function executeSceneProjection(
  supabase: SupabaseClient,
  params: {
    workId: string;
    staging: AcceptedSceneCandidateStaging;
    mode: SceneProjectionMode;
    sceneTsid?: string;
    linkToStoryUnitId?: string;
    operatorId: string;
  }
): Promise<ProjectionExecuteResult> {
  const validation = await validateSceneProjection(supabase, params);
  if (!validation.ok) {
    return validation;
  }

  const result = await persistReadingFrameFromSceneStaging(
    supabase,
    params.workId,
    params.staging,
    { parentRouteTsid: validation.parentRouteTsid }
  );

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
    };
  }

  return {
    ok: true,
    readingRouteTsid: result.readingRouteTsid,
    frameIndex: result.frameIndex,
    sourceReviewId: result.sourceReviewId,
  };
}

/**
 * Remove Discovery Frame by sourceReviewId (does not delete Reading Route).
 */
export async function unprojectSceneProjection(
  supabase: SupabaseClient,
  params: {
    workId: string;
    sceneProjectionLinkId?: string;
    sourceReviewId?: string;
    sceneTsid?: string;
  }
): Promise<
  | {
      ok: true;
      readingRouteTsid: string;
      sourceReviewId: string;
      removedLink?: undefined;
    }
  | { ok: false; code: RolloutErrorCode; message: string }
> {
  const result = await unpersistReadingFrame(supabase, params.workId, {
    sourceReviewId: params.sourceReviewId,
    readingRouteTsid: params.sceneTsid,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
    };
  }

  return {
    ok: true,
    readingRouteTsid: result.readingRouteTsid,
    sourceReviewId: result.sourceReviewId,
  };
}

/** Client-facing validation checklist for UI (no DB). */
export function buildProjectionValidationChecklist(params: {
  hasParentStoryRef: boolean;
  parentStoryPersisted: boolean;
  fieldsValid: boolean;
  notAlreadyProjected: boolean;
  linkTargetOk: boolean;
}): Array<{ id: string; label: string; ok: boolean }> {
  return [
    {
      id: "parent_ref",
      label: "场景含所属故事引用",
      ok: params.hasParentStoryRef,
    },
    {
      id: "parent_persisted",
      label: "所属章节已保存",
      ok: params.parentStoryPersisted,
    },
    {
      id: "fields",
      label: "画面页标题完整",
      ok: params.fieldsValid,
    },
    {
      id: "idempotent",
      label: "可以添加或更新该画面",
      ok: params.notAlreadyProjected,
    },
    {
      id: "target",
      label: "所属章节有效",
      ok: params.linkTargetOk,
    },
  ];
}
