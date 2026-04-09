import { supabase } from "@/lib/supabase";
import type { Scene, StoryImage } from "@/lib/types";

const TABLE = "scenes";

type SceneRow = {
  work_id: string;
  tsid: string;
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  order_index: number;
  summary: string;
  tags: string[] | null;
  story_images: string[] | null;
  story_images_v2: unknown | null;
  location_id: string;
  character_ids: string[] | null;
};

function parseStoryImagesV2(raw: unknown): StoryImage[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: StoryImage[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      "url" in item &&
      typeof (item as { url: unknown }).url === "string"
    ) {
      const rec = item as { url: string; caption?: unknown };
      const caption =
        typeof rec.caption === "string" ? rec.caption : "";
      out.push({ url: rec.url, caption });
    }
  }
  return out;
}

function rowToScene(row: SceneRow): Scene {
  return {
    workId: row.work_id,
    tsid: row.tsid,
    title: row.title,
    chapter_number: row.chapter_number,
    chapter_title: row.chapter_title ?? null,
    summary: row.summary,
    tags: row.tags ?? [],
    story_images: row.story_images ?? [],
    story_images_v2: parseStoryImagesV2(row.story_images_v2),
    locationId: row.location_id,
    characterIds: row.character_ids ?? [],
  };
}

function toInsertRow(
  workId: string,
  data: Omit<Scene, "tsid" | "workId"> & { tsid: string }
): Record<string, unknown> {
  return {
    work_id: workId,
    tsid: data.tsid,
    title: data.title,
    chapter_number: data.chapter_number,
    chapter_title: data.chapter_title ?? null,
    order_index: 0,
    summary: data.summary,
    tags: data.tags,
    story_images: data.story_images,
    story_images_v2: data.story_images_v2 ?? [],
    location_id: data.locationId,
    character_ids: data.characterIds,
  };
}

function toUpdateRow(data: Omit<Scene, "tsid" | "workId">): Record<string, unknown> {
  return {
    title: data.title,
    chapter_number: data.chapter_number,
    chapter_title: data.chapter_title ?? null,
    summary: data.summary,
    tags: data.tags,
    story_images: data.story_images,
    story_images_v2: data.story_images_v2 ?? [],
    location_id: data.locationId,
    character_ids: data.characterIds,
  };
}

export async function getScenes(workId: string): Promise<Scene[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("work_id", workId)
      .order("chapter_number", { ascending: true })
      .order("order_index", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data as SceneRow[] | null)?.map(rowToScene) ?? [];
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function getScene(
  workId: string,
  tsid: string
): Promise<Scene | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("work_id", workId)
      .eq("tsid", tsid)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return rowToScene(data as SceneRow);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function createScene(
  workId: string,
  data: Omit<Scene, "tsid" | "workId"> & { tsid?: string }
): Promise<Scene> {
  try {
    const { tsid: optionalTsid, ...rest } = data;
    const tsid = optionalTsid?.trim() || `scene_${Date.now()}`;
    const full: Omit<Scene, "tsid" | "workId"> & { tsid: string } = {
      tsid,
      title: rest.title,
      chapter_number: rest.chapter_number,
      chapter_title: rest.chapter_title ?? null,
      summary: rest.summary,
      tags: rest.tags,
      story_images: rest.story_images ?? [],
      story_images_v2: rest.story_images_v2 ?? [],
      locationId: rest.locationId,
      characterIds: rest.characterIds,
    };

    const insertRow = toInsertRow(workId, full);
    console.log("[scenes] createScene Supabase insert payload", insertRow);

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return rowToScene(inserted as SceneRow);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function updateScene(
  workId: string,
  tsid: string,
  data: Omit<Scene, "tsid" | "workId">
): Promise<void> {
  try {
    const updateRow = toUpdateRow(data);
    console.log("[scenes] updateScene Supabase update payload", updateRow);

    const { error } = await supabase
      .from(TABLE)
      .update(updateRow)
      .eq("work_id", workId)
      .eq("tsid", tsid);

    if (error) {
      throw new Error(error.message);
    }
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function deleteScene(workId: string, tsid: string): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("work_id", workId)
      .eq("tsid", tsid);

    if (error) {
      throw new Error(error.message);
    }
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}
