/**
 * IMPLEMENT-WMA-001 — thin media asset registry (id = identity, url = representation).
 */

import { supabase } from "@/lib/supabase";

const TABLE = "media_assets";

export type MediaAsset = {
  id: string;
  url: string;
  createdAt: string;
};

type MediaAssetRow = {
  id: string;
  url: string;
  created_at: string;
};

function rowToAsset(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    url: row.url,
    createdAt: row.created_at,
  };
}

export async function createMediaAsset(url: string): Promise<MediaAsset> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("media asset url is required");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ url: trimmed })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToAsset(data as MediaAssetRow);
}

export async function getMediaAsset(id: string): Promise<MediaAsset | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  return rowToAsset(data as MediaAssetRow);
}
