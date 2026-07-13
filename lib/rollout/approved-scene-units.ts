/**
 * SPEC-ROL-002 — Approved Scene unit persistence (Editorial durable at Projection Accept)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import { parseSceneChapterNumber } from "@/lib/discovery/scene-chapter-number";
import type { ApprovedSceneUnit } from "@/lib/rollout/types";
import { isMissingRelationError, SCENE_PROJECTION_MIGRATION_HINT } from "@/lib/rollout/db-errors";

const TABLE = "approved_scene_units";

type ApprovedSceneRow = {
  id: string;
  work_id: string;
  parent_story_unit_id: string;
  source_review_id: string;
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  summary: string | null;
  approved_at: string;
  approved_by: string;
};

function rowToUnit(row: ApprovedSceneRow): ApprovedSceneUnit {
  return {
    id: row.id,
    workId: row.work_id,
    parentStoryUnitId: row.parent_story_unit_id,
    sourceReviewId: row.source_review_id,
    title: row.title,
    chapterNumber: row.chapter_number,
    chapterTitle: row.chapter_title,
    summary: row.summary ?? undefined,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
  };
}

export async function listApprovedSceneUnits(
  supabase: SupabaseClient,
  workId: string
): Promise<ApprovedSceneUnit[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .order("approved_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw new Error(error.message);
  }

  return ((data as ApprovedSceneRow[] | null) ?? []).map(rowToUnit);
}

export async function getApprovedSceneUnitBySourceReviewId(
  supabase: SupabaseClient,
  workId: string,
  sourceReviewId: string
): Promise<ApprovedSceneUnit | null> {
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

  return rowToUnit(data as ApprovedSceneRow);
}

export async function getApprovedSceneUnit(
  supabase: SupabaseClient,
  workId: string,
  id: string
): Promise<ApprovedSceneUnit | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .eq("id", id)
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

  return rowToUnit(data as ApprovedSceneRow);
}

export async function listApprovedSceneUnitsForStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  parentStoryUnitId: string
): Promise<ApprovedSceneUnit[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .eq("parent_story_unit_id", parentStoryUnitId);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw new Error(error.message);
  }

  return ((data as ApprovedSceneRow[] | null) ?? []).map(rowToUnit);
}

/**
 * Delete Approved Scene units under a Story when unpersisting that Story.
 * Caller must ensure no SceneProjectionLinks remain (FK + ROL2-PR-06).
 */
export async function deleteApprovedSceneUnitsForStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  parentStoryUnitId: string
): Promise<number> {
  const existing = await listApprovedSceneUnitsForStoryUnit(
    supabase,
    workId,
    parentStoryUnitId
  );
  if (existing.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("work_id", workId)
    .eq("parent_story_unit_id", parentStoryUnitId);

  if (error) {
    if (isMissingRelationError(error)) {
      return 0;
    }
    throw new Error(error.message);
  }

  return existing.length;
}

export async function upsertApprovedSceneUnitFromStaging(
  supabase: SupabaseClient,
  workId: string,
  parentStoryUnitId: string,
  staging: AcceptedSceneCandidateStaging,
  approvedBy: string
): Promise<ApprovedSceneUnit> {
  const chapterNumber = parseSceneChapterNumber(staging.chapter_number);
  if (chapterNumber === null) {
    throw new Error("Invalid chapter_number for Approved Scene unit");
  }

  const existing = await getApprovedSceneUnitBySourceReviewId(
    supabase,
    workId,
    staging.sourceReviewId
  );

  if (existing) {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        parent_story_unit_id: parentStoryUnitId,
        title: staging.title.trim(),
        chapter_number: chapterNumber,
        chapter_title: staging.chapter_title ?? null,
        summary: staging.summary?.trim() || null,
      })
      .eq("id", existing.id)
      .eq("work_id", workId)
      .select("*")
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        throw new Error(SCENE_PROJECTION_MIGRATION_HINT);
      }
      throw new Error(error.message);
    }

    return rowToUnit(data as ApprovedSceneRow);
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      work_id: workId,
      parent_story_unit_id: parentStoryUnitId,
      source_review_id: staging.sourceReviewId,
      title: staging.title.trim(),
      chapter_number: chapterNumber,
      chapter_title: staging.chapter_title ?? null,
      summary: staging.summary?.trim() || null,
      approved_by: approvedBy,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error(SCENE_PROJECTION_MIGRATION_HINT);
    }
    throw new Error(error.message);
  }

  return rowToUnit(data as ApprovedSceneRow);
}
