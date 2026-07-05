/**
 * SPEC-ROL-001 — Story ↔ Scene governed links (server)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { StorySceneProjectionLink } from "@/lib/rollout/types";

const TABLE = "story_scene_links";

type LinkRow = {
  id: string;
  work_id: string;
  story_unit_id: string;
  scene_tsid: string;
  linked_at: string;
  linked_by: string;
  source: string;
};

function rowToLink(row: LinkRow): StorySceneProjectionLink {
  return {
    id: row.id,
    workId: row.work_id,
    storyUnitId: row.story_unit_id,
    sceneTsid: row.scene_tsid,
    linkedAt: row.linked_at,
    linkedBy: row.linked_by,
    source: "operator_projection_accept",
  };
}

export async function listStorySceneLinks(
  supabase: SupabaseClient,
  workId: string
): Promise<StorySceneProjectionLink[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .order("linked_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as LinkRow[] | null) ?? []).map(rowToLink);
}

export async function getStorySceneLink(
  supabase: SupabaseClient,
  workId: string,
  linkId: string
): Promise<StorySceneProjectionLink | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .eq("id", linkId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToLink(data as LinkRow);
}

export async function findExistingLink(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string,
  sceneTsid: string
): Promise<StorySceneProjectionLink | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("work_id", workId)
    .eq("story_unit_id", storyUnitId)
    .eq("scene_tsid", sceneTsid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return rowToLink(data as LinkRow);
}

export async function createStorySceneLink(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string,
  sceneTsid: string,
  linkedBy: string
): Promise<StorySceneProjectionLink> {
  const existing = await findExistingLink(
    supabase,
    workId,
    storyUnitId,
    sceneTsid
  );
  if (existing) {
    const err = new Error("LINK_ALREADY_EXISTS");
    throw err;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      work_id: workId,
      story_unit_id: storyUnitId,
      scene_tsid: sceneTsid,
      linked_by: linkedBy,
      source: "operator_projection_accept",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const dup = new Error("LINK_ALREADY_EXISTS");
      throw dup;
    }
    throw new Error(error.message);
  }

  return rowToLink(data as LinkRow);
}

export async function countLinksForStoryUnit(
  supabase: SupabaseClient,
  workId: string,
  storyUnitId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("work_id", workId)
    .eq("story_unit_id", storyUnitId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function deleteStorySceneLink(
  supabase: SupabaseClient,
  workId: string,
  linkId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("work_id", workId)
    .eq("id", linkId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function sceneExistsInWork(
  supabase: SupabaseClient,
  workId: string,
  sceneTsid: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("scenes")
    .select("tsid")
    .eq("work_id", workId)
    .eq("tsid", sceneTsid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function listScenesBrief(
  supabase: SupabaseClient,
  workId: string
): Promise<Array<{ tsid: string; title: string; chapter_number: number }>> {
  const { data, error } = await supabase
    .from("scenes")
    .select("tsid, title, chapter_number")
    .eq("work_id", workId)
    .order("chapter_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    (data as Array<{
      tsid: string;
      title: string;
      chapter_number: number;
    }> | null) ?? []
  );
}
