import { supabase } from "@/lib/supabase";
import type { Work } from "@/lib/types";

const TABLE = "works";

type WorkRow = {
  id: string;
  tsid: string;
  title: string;
  description: string;
  cover_image: string;
  created_at: string;
};

function rowToWork(row: WorkRow): Work {
  return {
    id: row.id,
    tsid: row.tsid,
    title: row.title,
    description: row.description,
    coverImage: row.cover_image,
    createdAt: row.created_at,
  };
}

export async function getWorks(): Promise<Work[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as WorkRow[] | null)?.map(rowToWork) ?? [];
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function getWork(id: string): Promise<Work | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return rowToWork(data as WorkRow);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function createWork(
  data: Pick<Work, "title" | "description" | "coverImage"> & { tsid?: string }
): Promise<Work> {
  try {
    const tsid = data.tsid?.trim() || `work_${Date.now()}`;
    const row = {
      tsid,
      title: data.title,
      description: data.description,
      cover_image: data.coverImage,
    };

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(row)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return rowToWork(inserted as WorkRow);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function updateWork(
  id: string,
  data: Partial<Pick<Work, "title" | "description" | "coverImage" | "tsid">>
): Promise<void> {
  try {
    const row: Record<string, unknown> = {};
    if (data.title !== undefined) row.title = data.title;
    if (data.description !== undefined) row.description = data.description;
    if (data.coverImage !== undefined) row.cover_image = data.coverImage;
    if (data.tsid !== undefined) row.tsid = data.tsid;

    const { error } = await supabase.from(TABLE).update(row).eq("id", id);

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

export async function deleteWork(id: string): Promise<void> {
  try {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);

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
