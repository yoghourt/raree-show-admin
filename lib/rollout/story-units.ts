/**
 * SPEC-ROL-001 — Approved Story unit persist (server)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedStoryUnitStaging } from "@/lib/discovery/review-types";
import { countLinksForStoryUnit } from "@/lib/rollout/story-scene-links";
import type { ApprovedStoryUnit, StoryUnitStatus } from "@/lib/rollout/types";

export type UnpersistStoryUnitResult =
  | { ok: true; staging: AcceptedStoryUnitStaging }
  | { ok: false; code: "NOT_FOUND" | "UNPERSIST_BLOCKED" };

const TABLE = "story_units";

type StoryUnitRow = {
  id: string;
  work_id: string;
  source_review_id: string;
  title: string;
  summary: string;
  boundary_hint: string | null;
  approved_at: string;
  approved_by: string;
  status: StoryUnitStatus;
};

function rowToStoryUnit(row: StoryUnitRow): ApprovedStoryUnit {
  return {
    id: row.id,
    workId: row.work_id,
    sourceReviewId: row.source_review_id,
    title: row.title,
    summary: row.summary,
    boundaryHint: row.boundary_hint ?? undefined,
    approvedAt: row.approved_at,
    status: row.status,
  };
}

export async function listStoryUnits(
  supabase: SupabaseClient,
  workId: string
): Promise<ApprovedStoryUnit[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .order("approved_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as StoryUnitRow[] | null) ?? []).map(rowToStoryUnit);
}

export async function getStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string
): Promise<ApprovedStoryUnit | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .eq("id", storyUnitId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToStoryUnit(data as StoryUnitRow);
}

export async function persistStoryUnitFromStaging(
  supabase: SupabaseClient,
  workId: string,
  staging: AcceptedStoryUnitStaging,
  approvedBy: string
): Promise<ApprovedStoryUnit> {
  const insertRow = {
    work_id: workId,
    source_review_id: staging.sourceReviewId,
    title: staging.title.trim(),
    summary: staging.summary ?? "",
    boundary_hint: staging.boundaryHint?.trim() || null,
    approved_by: approvedBy,
    status: "active" as const,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(insertRow)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToStoryUnit(data as StoryUnitRow);
}

export async function archiveStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string
): Promise<ApprovedStoryUnit | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: "archived" })
    .eq("work_id", workId)
    .eq("id", storyUnitId)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToStoryUnit(data as StoryUnitRow);
}

export async function updateStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string,
  patch: { title: string; summary: string; boundaryHint?: string }
): Promise<ApprovedStoryUnit | null> {
  const updateRow = {
    title: patch.title.trim(),
    summary: patch.summary ?? "",
    boundary_hint: patch.boundaryHint?.trim() || null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .update(updateRow)
    .eq("work_id", workId)
    .eq("id", storyUnitId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToStoryUnit(data as StoryUnitRow);
}

function storyUnitToStaging(unit: ApprovedStoryUnit): AcceptedStoryUnitStaging {
  return {
    workId: unit.workId,
    sourceReviewId: unit.sourceReviewId,
    title: unit.title,
    summary: unit.summary,
    boundaryHint: unit.boundaryHint,
    acceptedAt: unit.approvedAt,
  };
}

export async function unpersistStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string
): Promise<UnpersistStoryUnitResult> {
  const unit = await getStoryUnit(supabase, workId, storyUnitId);
  if (!unit) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const linkCount = await countLinksForStoryUnit(
    supabase,
    workId,
    storyUnitId
  );
  if (linkCount > 0) {
    return { ok: false, code: "UNPERSIST_BLOCKED" };
  }

  const staging = storyUnitToStaging(unit);

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("work_id", workId)
    .eq("id", storyUnitId);

  if (error) {
    throw new Error(error.message);
  }

  return { ok: true, staging };
}
