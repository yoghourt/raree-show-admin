import { supabase } from "@/lib/supabase";
import type { Character } from "@/lib/types";

const TABLE = "characters";

type CharacterRow = {
  id: string;
  work_id: string;
  tsid: string;
  name: string;
  house: string;
  description: string;
  portrait_url: string;
  created_at: string;
};

function rowToCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    workId: row.work_id,
    tsid: row.tsid,
    name: row.name,
    house: row.house,
    description: row.description,
    portraitUrl: row.portrait_url,
    createdAt: row.created_at,
  };
}

function toInsertRow(
  workId: string,
  data: Omit<Character, "id" | "tsid" | "workId" | "createdAt"> & {
    tsid: string;
  }
): Record<string, unknown> {
  return {
    work_id: workId,
    tsid: data.tsid,
    name: data.name,
    house: data.house,
    description: data.description,
    portrait_url: data.portraitUrl,
  };
}

function toUpdateRow(
  data: Omit<Character, "id" | "tsid" | "workId" | "createdAt">
): Record<string, unknown> {
  return {
    name: data.name,
    house: data.house,
    description: data.description,
    portrait_url: data.portraitUrl,
  };
}

/** 查询某作品下全部角色 */
export async function getAll(workId: string): Promise<Character[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("work_id", workId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data as CharacterRow[] | null)?.map(rowToCharacter) ?? [];
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function getCharacter(
  workId: string,
  tsid: string
): Promise<Character | null> {
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

    return rowToCharacter(data as CharacterRow);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function create(
  workId: string,
  data: Omit<Character, "id" | "tsid" | "workId" | "createdAt"> & {
    tsid?: string;
  }
): Promise<Character> {
  try {
    const { tsid: optionalTsid, ...rest } = data;
    const tsid = optionalTsid?.trim() || `char_${Date.now()}`;
    const full = { tsid, ...rest };

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(toInsertRow(workId, full))
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return rowToCharacter(inserted as CharacterRow);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function update(
  workId: string,
  tsid: string,
  data: Omit<Character, "id" | "tsid" | "workId" | "createdAt">
): Promise<void> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .update(toUpdateRow(data))
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

export async function deleteById(workId: string, tsid: string): Promise<void> {
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
