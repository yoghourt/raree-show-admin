/**
 * SPEC-ROL-002 — SceneProjectionLink persistence (Approved Scene ↔ Reading Route)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  SceneProjectionLink,
  SceneProjectionMode,
} from "@/lib/rollout/types";
import {
  isMissingRelationError,
  SCENE_PROJECTION_MIGRATION_HINT,
} from "@/lib/rollout/db-errors";

const TABLE = "scene_projection_links";

type LinkRow = {
  id: string;
  work_id: string;
  approved_scene_unit_id: string;
  reading_route_tsid: string;
  projection_mode: SceneProjectionMode;
  source_review_id: string;
  companion_story_link_id: string | null;
  accepted_at: string;
  accepted_by: string;
};

function rowToLink(row: LinkRow): SceneProjectionLink {
  return {
    id: row.id,
    workId: row.work_id,
    approvedSceneUnitId: row.approved_scene_unit_id,
    readingRouteTsid: row.reading_route_tsid,
    projectionMode: row.projection_mode,
    sourceReviewId: row.source_review_id,
    companionStoryLinkId: row.companion_story_link_id,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
  };
}

export async function listSceneProjectionLinks(
  supabase: SupabaseClient,
  workId: string
): Promise<SceneProjectionLink[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .order("accepted_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw new Error(error.message);
  }

  return ((data as LinkRow[] | null) ?? []).map(rowToLink);
}

export async function getSceneProjectionLinkBySourceReviewId(
  supabase: SupabaseClient,
  workId: string,
  sourceReviewId: string
): Promise<SceneProjectionLink | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .eq("source_review_id", sourceReviewId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToLink(data as LinkRow);
}

export async function getSceneProjectionLinkByApprovedSceneId(
  supabase: SupabaseClient,
  workId: string,
  approvedSceneUnitId: string
): Promise<SceneProjectionLink | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .eq("approved_scene_unit_id", approvedSceneUnitId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToLink(data as LinkRow);
}

export async function getSceneProjectionLink(
  supabase: SupabaseClient,
  workId: string,
  linkId: string
): Promise<SceneProjectionLink | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .eq("id", linkId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToLink(data as LinkRow);
}

export async function createSceneProjectionLink(
  supabase: SupabaseClient,
  params: {
    workId: string;
    approvedSceneUnitId: string;
    readingRouteTsid: string;
    projectionMode: SceneProjectionMode;
    sourceReviewId: string;
    acceptedBy: string;
    companionStoryLinkId?: string | null;
  }
): Promise<SceneProjectionLink> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      work_id: params.workId,
      approved_scene_unit_id: params.approvedSceneUnitId,
      reading_route_tsid: params.readingRouteTsid,
      projection_mode: params.projectionMode,
      source_review_id: params.sourceReviewId,
      companion_story_link_id: params.companionStoryLinkId ?? null,
      accepted_by: params.acceptedBy,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("ALREADY_PROJECTED");
    }
    if (isMissingRelationError(error)) {
      throw new Error(SCENE_PROJECTION_MIGRATION_HINT);
    }
    throw new Error(error.message);
  }

  return rowToLink(data as LinkRow);
}

export async function deleteSceneProjectionLink(
  supabase: SupabaseClient,
  workId: string,
  linkId: string
): Promise<SceneProjectionLink | null> {
  const existing = await getSceneProjectionLink(supabase, workId, linkId);
  if (!existing) {
    return null;
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("work_id", workId)
    .eq("id", linkId);

  if (error) {
    throw new Error(error.message);
  }

  return existing;
}
