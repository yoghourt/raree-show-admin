/**
 * Hotfix — server-side scenes helpers with Discovery provenance.
 * Reader contract for story_images_v2 remains [{url, caption}].
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReadingFrame, ReadingRoute } from "@/lib/types";

export type FrameProvenanceEntry = {
  sourceReviewId: string;
  frameIndex: number;
};

export type SceneRowWithProvenance = {
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
  discovery_source_review_id: string | null;
  frame_provenance_v1: unknown;
};

function locationIdToDb(locationId: string | null | undefined): string {
  const trimmed = locationId?.trim();
  return trimmed ? trimmed : "";
}

export function parseStoryImagesV2(raw: unknown): ReadingFrame[] {
  if (!Array.isArray(raw)) return [];
  const out: ReadingFrame[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { url?: unknown; caption?: unknown };
    const url = typeof rec.url === "string" ? rec.url : "";
    const caption = typeof rec.caption === "string" ? rec.caption : "";
    // Keep caption-only frames (empty url) for reader evidence after Discovery write
    if (url.trim() || caption.trim()) {
      out.push({ url, caption });
    }
  }
  return out;
}

export function parseFrameProvenance(raw: unknown): FrameProvenanceEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: FrameProvenanceEntry[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { sourceReviewId?: unknown }).sourceReviewId === "string" &&
      typeof (item as { frameIndex?: unknown }).frameIndex === "number"
    ) {
      out.push({
        sourceReviewId: (item as FrameProvenanceEntry).sourceReviewId,
        frameIndex: (item as FrameProvenanceEntry).frameIndex,
      });
    }
  }
  return out;
}

export function rowToReadingRoute(row: SceneRowWithProvenance): ReadingRoute {
  return {
    workId: row.work_id,
    tsid: row.tsid,
    title: row.title,
    chapter_number: row.chapter_number,
    chapter_title: row.chapter_title ?? null,
    summary: row.summary,
    tags: row.tags ?? [],
    story_images_v2: parseStoryImagesV2(row.story_images_v2),
    locationId: row.location_id?.trim() ? row.location_id : null,
    characterIds: row.character_ids ?? [],
  };
}

const SELECT_COLS =
  "work_id, tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, location_id, character_ids, discovery_source_review_id, frame_provenance_v1";

export async function getSceneRowByTsid(
  supabase: SupabaseClient,
  workId: string,
  tsid: string
): Promise<SceneRowWithProvenance | null> {
  const { data, error } = await supabase
    .from("scenes")
    .select(SELECT_COLS)
    .eq("work_id", workId)
    .eq("tsid", tsid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as SceneRowWithProvenance | null) ?? null;
}

export async function getSceneRowByDiscoverySourceReviewId(
  supabase: SupabaseClient,
  workId: string,
  sourceReviewId: string
): Promise<SceneRowWithProvenance | null> {
  const { data, error } = await supabase
    .from("scenes")
    .select(SELECT_COLS)
    .eq("work_id", workId)
    .eq("discovery_source_review_id", sourceReviewId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as SceneRowWithProvenance | null) ?? null;
}

export async function listDiscoveryPersistedRoutes(
  supabase: SupabaseClient,
  workId: string
): Promise<SceneRowWithProvenance[]> {
  const { data, error } = await supabase
    .from("scenes")
    .select(SELECT_COLS)
    .eq("work_id", workId)
    .not("discovery_source_review_id", "is", null)
    .order("chapter_number", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as SceneRowWithProvenance[] | null) ?? [];
}

export async function nextChapterNumber(
  supabase: SupabaseClient,
  workId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("scenes")
    .select("chapter_number")
    .eq("work_id", workId)
    .order("chapter_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const max = (data as { chapter_number?: number } | null)?.chapter_number;
  return typeof max === "number" && max >= 1 ? max + 1 : 1;
}

export async function insertReadingRouteWithProvenance(
  supabase: SupabaseClient,
  workId: string,
  params: {
    title: string;
    summary: string;
    chapterNumber: number;
    chapterTitle?: string | null;
    discoverySourceReviewId: string;
    locationId?: string | null;
    characterIds?: string[];
  }
): Promise<SceneRowWithProvenance> {
  const tsid = `scene_${Date.now()}`;
  const insertRow = {
    work_id: workId,
    tsid,
    title: params.title,
    chapter_number: params.chapterNumber,
    chapter_title: params.chapterTitle?.trim() || null,
    order_index: 0,
    summary: params.summary,
    tags: [] as string[],
    story_images_v2: [] as ReadingFrame[],
    location_id: locationIdToDb(params.locationId ?? null),
    character_ids: params.characterIds ?? [],
    discovery_source_review_id: params.discoverySourceReviewId,
    frame_provenance_v1: [] as FrameProvenanceEntry[],
  };

  const { data, error } = await supabase
    .from("scenes")
    .insert(insertRow)
    .select(SELECT_COLS)
    .single();

  if (error) throw new Error(error.message);
  return data as SceneRowWithProvenance;
}

export async function updateSceneFramesAndProvenance(
  supabase: SupabaseClient,
  workId: string,
  tsid: string,
  frames: ReadingFrame[],
  provenance: FrameProvenanceEntry[]
): Promise<SceneRowWithProvenance> {
  const { data, error } = await supabase
    .from("scenes")
    .update({
      story_images_v2: frames,
      frame_provenance_v1: provenance,
    })
    .eq("work_id", workId)
    .eq("tsid", tsid)
    .select(SELECT_COLS)
    .single();

  if (error) throw new Error(error.message);
  return data as SceneRowWithProvenance;
}

export async function deleteSceneRow(
  supabase: SupabaseClient,
  workId: string,
  tsid: string
): Promise<void> {
  const { error } = await supabase
    .from("scenes")
    .delete()
    .eq("work_id", workId)
    .eq("tsid", tsid);

  if (error) throw new Error(error.message);
}

export async function sceneExistsInWork(
  supabase: SupabaseClient,
  workId: string,
  sceneTsid: string
): Promise<boolean> {
  const row = await getSceneRowByTsid(supabase, workId, sceneTsid);
  return Boolean(row);
}
