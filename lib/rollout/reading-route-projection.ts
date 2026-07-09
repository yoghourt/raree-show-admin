/**
 * SPEC-ROL-001 §4.4 — Reading Route Projection Accept (server)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import { mapSceneStagingToReadingRoutePayload } from "@/lib/rollout/staging-mapper";
import {
  createStorySceneLink,
  sceneExistsInWork,
} from "@/lib/rollout/story-scene-links";
import type { StoryReadingRouteProjectionLink } from "@/lib/rollout/types";
import type { ReadingRoute } from "@/lib/types";

function locationIdToDb(locationId: string | null): string {
  const trimmed = locationId?.trim();
  return trimmed ? trimmed : "";
}

export type ReadingRouteProjectionResult =
  | {
      ok: true;
      sceneTsid: string;
      link?: StoryReadingRouteProjectionLink;
    }
  | {
      ok: false;
      code: "SCENE_VALIDATION_FAILED" | "SCENE_NOT_FOUND" | "SCENE_WORK_MISMATCH";
      fieldErrors?: Record<string, string[]>;
      message: string;
    };

async function insertReadingRoute(
  supabase: SupabaseClient,
  workId: string,
  payload: Omit<ReadingRoute, "tsid" | "workId">
): Promise<ReadingRoute> {
  const tsid = `scene_${Date.now()}`;
  const insertRow = {
    work_id: workId,
    tsid,
    title: payload.title,
    chapter_number: payload.chapter_number,
    chapter_title: payload.chapter_title ?? null,
    order_index: 0,
    summary: payload.summary,
    tags: payload.tags,
    story_images_v2: payload.story_images_v2 ?? [],
    location_id: locationIdToDb(payload.locationId),
    character_ids: payload.characterIds,
  };

  const { data, error } = await supabase
    .from("scenes")
    .insert(insertRow)
    .select("tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, location_id, character_ids, work_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as {
    work_id: string;
    tsid: string;
    title: string;
    chapter_number: number;
    chapter_title: string | null;
    summary: string;
    tags: string[] | null;
    story_images_v2: unknown;
    location_id: string;
    character_ids: string[] | null;
  };

  return {
    workId: row.work_id,
    tsid: row.tsid,
    title: row.title,
    chapter_number: row.chapter_number,
    chapter_title: row.chapter_title,
    summary: row.summary,
    tags: row.tags ?? [],
    story_images_v2: null,
    locationId: row.location_id.trim() ? row.location_id : null,
    characterIds: row.character_ids ?? [],
  };
}

export async function acceptReadingRouteProjection(
  supabase: SupabaseClient,
  params: {
    workId: string;
    staging: AcceptedSceneCandidateStaging;
    mode: "create" | "link_existing";
    sceneTsid?: string;
    linkToStoryUnitId?: string;
    operatorId: string;
  }
): Promise<ReadingRouteProjectionResult> {
  const { workId, staging, mode, sceneTsid, linkToStoryUnitId, operatorId } =
    params;

  if (staging.workId !== workId) {
    return {
      ok: false,
      code: "SCENE_WORK_MISMATCH",
      message: "Staging workId does not match request workId",
    };
  }

  let resolvedSceneTsid: string;

  if (mode === "create") {
    const mapped = mapSceneStagingToReadingRoutePayload(staging);
    if (!mapped.ok) {
      return {
        ok: false,
        code: "SCENE_VALIDATION_FAILED",
        message: "Reading route staging failed validation",
        fieldErrors: mapped.fieldErrors,
      };
    }

    const created = await insertReadingRoute(supabase, workId, mapped.payload);
    resolvedSceneTsid = created.tsid;
  } else {
    const target = sceneTsid?.trim();
    if (!target) {
      return {
        ok: false,
        code: "SCENE_NOT_FOUND",
        message: "sceneTsid is required for link_existing mode",
      };
    }

    const exists = await sceneExistsInWork(supabase, workId, target);
    if (!exists) {
      return {
        ok: false,
        code: "SCENE_NOT_FOUND",
        message: "Reading route not found in work",
      };
    }

    resolvedSceneTsid = target;
  }

  let link: StoryReadingRouteProjectionLink | undefined;
  if (linkToStoryUnitId) {
    link = await createStorySceneLink(
      supabase,
      workId,
      linkToStoryUnitId,
      resolvedSceneTsid,
      operatorId
    );
  }

  return { ok: true, sceneTsid: resolvedSceneTsid, link };
}

export async function unprojectReadingRoute(
  supabase: SupabaseClient,
  workId: string,
  sceneTsid: string,
  mode: "create" | "link_existing"
): Promise<{ ok: true } | { ok: false; code: "SCENE_NOT_FOUND" }> {
  const exists = await sceneExistsInWork(supabase, workId, sceneTsid);
  if (!exists && mode === "create") {
    return { ok: false, code: "SCENE_NOT_FOUND" };
  }

  const { error: linkError } = await supabase
    .from("story_scene_links")
    .delete()
    .eq("work_id", workId)
    .eq("scene_tsid", sceneTsid);

  if (linkError) {
    throw new Error(linkError.message);
  }

  if (mode === "create") {
    const { error: sceneError } = await supabase
      .from("scenes")
      .delete()
      .eq("work_id", workId)
      .eq("tsid", sceneTsid);

    if (sceneError) {
      throw new Error(sceneError.message);
    }
  }

  return { ok: true };
}
