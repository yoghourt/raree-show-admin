import { supabase } from "@/lib/supabase";
import type { Work } from "@/lib/types";
import {
  clipWorkVisualConvention,
  workVisualConventionFromRow,
} from "@/lib/prompts/work-visual-convention";

const TABLE = "works";

function throwWorkWriteError(message: string): never {
  if (/visual_convention/i.test(message)) {
    throw new Error(
      "作品表缺少 visual_convention 列。请在 Supabase SQL editor 执行 docs/supabase/migrations/20260901000000_work_visual_convention.sql"
    );
  }
  throw new Error(message);
}

type WorkRow = {
  id: string;
  tsid: string;
  title: string;
  description: string;
  cover_image: string;
  source_profile_id: string | null;
  visual_convention?: string | null;
  created_at: string;
};

function rowToWork(row: WorkRow): Work {
  return {
    id: row.id,
    tsid: row.tsid,
    title: row.title,
    description: row.description,
    coverImage: row.cover_image,
    sourceProfileId: row.source_profile_id ?? null,
    visualConvention: workVisualConventionFromRow(row),
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
  data: Pick<Work, "title" | "description" | "coverImage"> & {
    tsid?: string;
    sourceProfileId?: string | null;
    visualConvention?: string;
  }
): Promise<Work> {
  try {
    const tsid = data.tsid?.trim() || `work_${Date.now()}`;
    const row: Record<string, unknown> = {
      tsid,
      title: data.title,
      description: data.description,
      cover_image: data.coverImage,
      visual_convention: clipWorkVisualConvention(data.visualConvention ?? ""),
    };
    if (data.sourceProfileId !== undefined) {
      row.source_profile_id = data.sourceProfileId || null;
    }

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(row)
      .select("*")
      .single();

    if (error) {
      throwWorkWriteError(error.message);
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
  data: Partial<
    Pick<
      Work,
      | "title"
      | "description"
      | "coverImage"
      | "tsid"
      | "sourceProfileId"
      | "visualConvention"
    >
  >
): Promise<void> {
  try {
    const row: Record<string, unknown> = {};
    if (data.title !== undefined) row.title = data.title;
    if (data.description !== undefined) row.description = data.description;
    if (data.coverImage !== undefined) row.cover_image = data.coverImage;
    if (data.tsid !== undefined) row.tsid = data.tsid;
    if (data.sourceProfileId !== undefined) {
      row.source_profile_id = data.sourceProfileId || null;
    }
    if (data.visualConvention !== undefined) {
      row.visual_convention = clipWorkVisualConvention(data.visualConvention);
    }

    const { error } = await supabase.from(TABLE).update(row).eq("id", id);

    if (error) {
      throwWorkWriteError(error.message);
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
