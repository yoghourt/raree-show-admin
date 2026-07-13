/**
 * Hotfix — Story persist facade.
 * Durable target is Reading Route (scenes). Keeps ApprovedStoryUnit-shaped API for callers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedStoryUnitStaging } from "@/lib/discovery/review-types";
import {
  archiveReadingRouteAsStoryUnit,
  getActiveReadingRouteBySourceReviewId,
  getReadingRouteAsStoryUnit,
  listPersistedReadingRoutesAsStoryUnits,
  persistReadingRouteFromStoryStaging,
  unpersistReadingRoute,
  updateReadingRouteAsStoryUnit,
  type UnpersistReadingRouteResult,
} from "@/lib/rollout/reading-route-persist";
import type { ApprovedStoryUnit } from "@/lib/rollout/types";

export type UnpersistStoryUnitResult = UnpersistReadingRouteResult;

export async function listStoryUnits(
  supabase: SupabaseClient,
  workId: string
): Promise<ApprovedStoryUnit[]> {
  return listPersistedReadingRoutesAsStoryUnits(supabase, workId);
}

export async function getStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string
): Promise<ApprovedStoryUnit | null> {
  return getReadingRouteAsStoryUnit(supabase, workId, storyUnitId);
}

export async function getActiveStoryUnitBySourceReviewId(
  supabase: SupabaseClient,
  workId: string,
  sourceReviewId: string
): Promise<ApprovedStoryUnit | null> {
  return getActiveReadingRouteBySourceReviewId(
    supabase,
    workId,
    sourceReviewId
  );
}

export async function persistStoryUnitFromStaging(
  supabase: SupabaseClient,
  workId: string,
  staging: AcceptedStoryUnitStaging,
  approvedBy: string
): Promise<ApprovedStoryUnit> {
  return persistReadingRouteFromStoryStaging(
    supabase,
    workId,
    staging,
    approvedBy
  );
}

export async function updateStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string,
  patch: { title: string; summary: string; boundaryHint?: string }
): Promise<ApprovedStoryUnit | null> {
  return updateReadingRouteAsStoryUnit(supabase, workId, storyUnitId, patch);
}

export async function archiveStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string
): Promise<ApprovedStoryUnit | null> {
  return archiveReadingRouteAsStoryUnit(supabase, workId, storyUnitId);
}

export async function unpersistStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string
): Promise<UnpersistStoryUnitResult> {
  return unpersistReadingRoute(supabase, workId, storyUnitId);
}
