import { supabase } from "@/lib/supabase";
import type { Scene } from "@/lib/types";

const TABLE = "scenes";

type SceneRow = {
  tsid: string;
  title: string;
  chapter_info: string;
  summary: string;
  tags: string[] | null;
  location_id: string;
  character_ids: string[] | null;
};

function rowToScene(row: SceneRow): Scene {
  return {
    tsid: row.tsid,
    title: row.title,
    chapterInfo: row.chapter_info,
    summary: row.summary,
    tags: row.tags ?? [],
    locationId: row.location_id,
    characterIds: row.character_ids ?? [],
  };
}

function toInsertRow(
  data: Omit<Scene, "tsid"> & { tsid: string }
): Record<string, unknown> {
  return {
    tsid: data.tsid,
    title: data.title,
    chapter_info: data.chapterInfo,
    summary: data.summary,
    tags: data.tags,
    location_id: data.locationId,
    character_ids: data.characterIds,
  };
}

function toUpdateRow(data: Omit<Scene, "tsid">): Record<string, unknown> {
  return {
    title: data.title,
    chapter_info: data.chapterInfo,
    summary: data.summary,
    tags: data.tags,
    location_id: data.locationId,
    character_ids: data.characterIds,
  };
}

export async function getScenes(): Promise<Scene[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

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

/** 按业务 tsid（与路由 [id] 一致）查询单条，供编辑页使用 */
export async function getScene(id: string): Promise<Scene | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("tsid", id)
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
  data: Omit<Scene, "tsid"> & { tsid?: string }
): Promise<Scene> {
  try {
    const { tsid: optionalTsid, ...rest } = data;
    const tsid = optionalTsid?.trim() || `scene_${Date.now()}`;
    const full: Scene = {
      tsid,
      title: rest.title,
      chapterInfo: rest.chapterInfo,
      summary: rest.summary,
      tags: rest.tags,
      locationId: rest.locationId,
      characterIds: rest.characterIds,
    };

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(toInsertRow(full))
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
  id: string,
  data: Omit<Scene, "tsid">
): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .update(toUpdateRow(data))
      .eq("tsid", id);

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

export async function deleteScene(id: string): Promise<void> {
  try {
    const { error } = await supabase.from(TABLE).delete().eq("tsid", id);

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
