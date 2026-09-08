/**
 * IMPLEMENT-WMA-001 — Work Map Authority CRUD + resolve against Supabase.
 */

import { supabase } from "@/lib/supabase";
import { getMediaAsset } from "@/lib/work-maps/media-assets";
import {
  mintGeometryId,
  resolveWorkMap,
  type MapCapability,
  type WorkMapResolution,
} from "@/lib/work-maps/resolve";

const WORK_MAPS = "work_maps";
const WORKS = "works";

export type WorkMapRow = {
  work_id: string;
  geometry_id: string | null;
  geometry_accepted_at: string | null;
  published_asset_id: string | null;
  published_asset_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkMapRecord = {
  workId: string;
  geometryId: string | null;
  geometryAcceptedAt: string | null;
  publishedAssetId: string | null;
  publishedAssetAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function rowToRecord(row: WorkMapRow): WorkMapRecord {
  return {
    workId: row.work_id,
    geometryId: row.geometry_id,
    geometryAcceptedAt: row.geometry_accepted_at,
    publishedAssetId: row.published_asset_id,
    publishedAssetAcceptedAt: row.published_asset_accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkMapCapability(
  workId: string
): Promise<MapCapability> {
  const { data, error } = await supabase
    .from(WORKS)
    .select("map_capability")
    .eq("id", workId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const cap = (data as { map_capability?: string } | null)?.map_capability;
  return cap === "required" ? "required" : "off";
}

export async function setWorkMapCapability(
  workId: string,
  capability: MapCapability
): Promise<void> {
  const { error } = await supabase
    .from(WORKS)
    .update({ map_capability: capability })
    .eq("id", workId);

  if (error) {
    throw new Error(
      /map_capability/i.test(error.message)
        ? "作品表缺少 map_capability 列。请在 Supabase SQL editor 执行 docs/supabase/migrations/20260908000000_work_map_authority.sql"
        : error.message
    );
  }
}

export async function getWorkMap(
  workId: string
): Promise<WorkMapRecord | null> {
  const { data, error } = await supabase
    .from(WORK_MAPS)
    .select("*")
    .eq("work_id", workId)
    .maybeSingle();

  if (error) {
    throw new Error(
      /work_maps/i.test(error.message)
        ? "缺少 work_maps 表。请在 Supabase SQL editor 执行 docs/supabase/migrations/20260908000000_work_map_authority.sql"
        : error.message
    );
  }

  if (!data) return null;
  return rowToRecord(data as WorkMapRow);
}

async function ensureWorkMapRow(workId: string): Promise<WorkMapRecord> {
  const existing = await getWorkMap(workId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(WORK_MAPS)
    .insert({
      work_id: workId,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    // Race: another writer inserted
    const again = await getWorkMap(workId);
    if (again) return again;
    throw new Error(error.message);
  }

  return rowToRecord(data as WorkMapRow);
}

/** Human accepts canonical geometry (mints geometry_id if absent). */
export async function acceptWorkMapGeometry(
  workId: string,
  options?: { replaceGeometry?: boolean }
): Promise<WorkMapRecord> {
  await ensureWorkMapRow(workId);
  const current = await getWorkMap(workId);
  const replace = options?.replaceGeometry === true;
  const geometryId =
    !replace && current?.geometryId?.trim()
      ? current.geometryId.trim()
      : mintGeometryId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from(WORK_MAPS)
    .update({
      geometry_id: geometryId,
      geometry_accepted_at: now,
      updated_at: now,
    })
    .eq("work_id", workId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToRecord(data as WorkMapRow);
}

/** Human accepts published visual against current geometry. */
export async function acceptPublishedWorkMapAsset(
  workId: string,
  publishedAssetId: string
): Promise<WorkMapRecord> {
  const current = await ensureWorkMapRow(workId);
  if (!current.geometryId || !current.geometryAcceptedAt) {
    throw new Error("Accept geometry before publishing a map visual");
  }

  const asset = await getMediaAsset(publishedAssetId);
  if (!asset) {
    throw new Error("published_asset_id not found in media_assets");
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(WORK_MAPS)
    .update({
      published_asset_id: publishedAssetId,
      published_asset_accepted_at: now,
      updated_at: now,
    })
    .eq("work_id", workId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToRecord(data as WorkMapRow);
}

export async function resolveWorkMapForWork(
  workId: string
): Promise<WorkMapResolution> {
  const map_capability = await getWorkMapCapability(workId);
  const work_map = await getWorkMap(workId);

  let published_asset_url: string | null = null;
  if (work_map?.publishedAssetId) {
    const asset = await getMediaAsset(work_map.publishedAssetId);
    published_asset_url = asset?.url ?? null;
  }

  return resolveWorkMap({
    map_capability,
    work_map: work_map
      ? {
          geometry_id: work_map.geometryId,
          geometry_accepted_at: work_map.geometryAcceptedAt,
          published_asset_id: work_map.publishedAssetId,
          published_asset_accepted_at: work_map.publishedAssetAcceptedAt,
        }
      : null,
    published_asset_url,
  });
}
