/**
 * Hot Path — Story staging → Reading Route (scenes) persist / unpersist
 *
 * IMPLEMENT-SCC-001-L2-A / ADR-012:
 * Route character_ids / location_id are non-authoritative migration debt.
 * Delivery ownership only — narrative appearance/location live on Scene Context.
 * Accept MUST NOT batch-fill these fields from the Work character/location batch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedStoryUnitStaging } from "@/lib/discovery/review-types";
import {
  deleteSceneRow,
  getSceneRowByDiscoverySourceReviewId,
  getSceneRowByTsid,
  insertReadingRouteWithProvenance,
  listDiscoveryPersistedRoutes,
  nextChapterNumber,
  parseFrameProvenance,
  type SceneRowWithProvenance,
} from "@/lib/rollout/scenes-server";
import type { ApprovedStoryUnit } from "@/lib/rollout/types";

export type UnpersistReadingRouteResult =
  | { ok: true; staging: AcceptedStoryUnitStaging }
  | {
      ok: false;
      code: "NOT_FOUND" | "UNPERSIST_BLOCKED";
      blockedBy?: "discovery_frames";
    };

function rowToApprovedStoryUnit(row: SceneRowWithProvenance): ApprovedStoryUnit {
  return {
    id: row.tsid,
    workId: row.work_id,
    sourceReviewId: row.discovery_source_review_id ?? "",
    title: row.title,
    summary: row.summary ?? "",
    approvedAt: new Date().toISOString(),
    status: "active",
  };
}

function rowToStaging(row: SceneRowWithProvenance): AcceptedStoryUnitStaging {
  return {
    workId: row.work_id,
    sourceReviewId: row.discovery_source_review_id ?? "",
    title: row.title,
    summary: row.summary ?? "",
    acceptedAt: new Date().toISOString(),
  };
}

/** List Discovery-persisted Reading Routes as ApprovedStoryUnit-shaped records (id = tsid). */
export async function listPersistedReadingRoutesAsStoryUnits(
  supabase: SupabaseClient,
  workId: string
): Promise<ApprovedStoryUnit[]> {
  const rows = await listDiscoveryPersistedRoutes(supabase, workId);
  return rows.map(rowToApprovedStoryUnit);
}

export async function getActiveReadingRouteBySourceReviewId(
  supabase: SupabaseClient,
  workId: string,
  sourceReviewId: string
): Promise<ApprovedStoryUnit | null> {
  const row = await getSceneRowByDiscoverySourceReviewId(
    supabase,
    workId,
    sourceReviewId
  );
  if (!row?.discovery_source_review_id) return null;
  return rowToApprovedStoryUnit(row);
}

export async function getReadingRouteAsStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  routeTsid: string
): Promise<ApprovedStoryUnit | null> {
  const row = await getSceneRowByTsid(supabase, workId, routeTsid);
  if (!row?.discovery_source_review_id) return null;
  return rowToApprovedStoryUnit(row);
}

export async function persistReadingRouteFromStoryStaging(
  supabase: SupabaseClient,
  workId: string,
  staging: AcceptedStoryUnitStaging,
  _approvedBy: string
): Promise<ApprovedStoryUnit> {
  const existing = await getSceneRowByDiscoverySourceReviewId(
    supabase,
    workId,
    staging.sourceReviewId
  );
  if (existing) {
    // Non-authoritative Route fields: write only explicit staging values.
    // Empty arrays / null MUST NOT be refilled from Work-batch attach.
    const { data, error } = await supabase
      .from("scenes")
      .update({
        title: staging.title.trim(),
        summary: staging.summary?.trim() ?? "",
        location_id:
          staging.locationId != null
            ? staging.locationId.trim()
            : existing.location_id,
        character_ids: staging.characterIds ?? existing.character_ids ?? [],
      })
      .eq("work_id", workId)
      .eq("tsid", existing.tsid)
      .select(
        "work_id, tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, location_id, character_ids, discovery_source_review_id, frame_provenance_v1"
      )
      .single();
    if (error) throw new Error(error.message);
    return rowToApprovedStoryUnit(data as SceneRowWithProvenance);
  }

  const chapterNumber =
    typeof staging.chapter_number === "number" && staging.chapter_number >= 1
      ? staging.chapter_number
      : await nextChapterNumber(supabase, workId);
  const row = await insertReadingRouteWithProvenance(supabase, workId, {
    title: staging.title.trim(),
    summary: staging.summary?.trim() ?? "",
    chapterNumber,
    chapterTitle: staging.chapter_title ?? null,
    discoverySourceReviewId: staging.sourceReviewId,
    locationId: staging.locationId ?? null,
    characterIds: staging.characterIds ?? [],
  });
  return rowToApprovedStoryUnit(row);
}

export async function updateReadingRouteAsStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  routeTsid: string,
  patch: { title: string; summary: string; boundaryHint?: string }
): Promise<ApprovedStoryUnit | null> {
  const existing = await getSceneRowByTsid(supabase, workId, routeTsid);
  if (!existing?.discovery_source_review_id) return null;

  const { data, error } = await supabase
    .from("scenes")
    .update({
      title: patch.title.trim(),
      summary: patch.summary.trim(),
    })
    .eq("work_id", workId)
    .eq("tsid", routeTsid)
    .select(
      "work_id, tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, location_id, character_ids, discovery_source_review_id, frame_provenance_v1"
    )
    .single();

  if (error) throw new Error(error.message);
  return rowToApprovedStoryUnit(data as SceneRowWithProvenance);
}

/**
 * Archive is a no-op marker for Hotfix Route path (no status column on scenes).
 * Returns the route shaped as story unit, or null.
 */
export async function archiveReadingRouteAsStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  routeTsid: string
): Promise<ApprovedStoryUnit | null> {
  return getReadingRouteAsStoryUnit(supabase, workId, routeTsid);
}

export async function unpersistReadingRoute(
  supabase: SupabaseClient,
  workId: string,
  routeTsid: string
): Promise<UnpersistReadingRouteResult> {
  const row = await getSceneRowByTsid(supabase, workId, routeTsid);
  if (!row?.discovery_source_review_id) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const provenance = parseFrameProvenance(row.frame_provenance_v1);
  if (provenance.length > 0) {
    return {
      ok: false,
      code: "UNPERSIST_BLOCKED",
      blockedBy: "discovery_frames",
    };
  }

  const staging = rowToStaging(row);
  await deleteSceneRow(supabase, workId, routeTsid);
  return { ok: true, staging };
}
