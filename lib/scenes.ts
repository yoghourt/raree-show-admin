import { supabase } from "@/lib/supabase";
import { emptyRouteMembershipDb } from "@/lib/rollout/route-membership";
import { parseFrameProvenance } from "@/lib/rollout/scenes-server";
import {
  aggregateStoryRelatedRefs,
  formatStoryRelatedAggregateLine,
} from "@/lib/scene-context/aggregate-story-refs";
import { parseSceneContextsV1 } from "@/lib/scene-context/parse";
import type { ReadingFrame, ReadingRoute } from "@/lib/types";

const TABLE = "scenes";

function locationIdFromDb(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

type ReadingRouteRow = {
  work_id: string;
  tsid: string;
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  order_index: number;
  summary: string;
  tags: string[] | null;
  story_images_v2: unknown | null;
  location_id: string;
  character_ids: string[] | null;
  frame_provenance_v1?: unknown;
  scene_contexts_v1?: unknown;
};

/** Display-only related cast/place from Contexts, else Frame provenance cues. */
export function relatedLineFromRouteRow(row: {
  scene_contexts_v1?: unknown;
  frame_provenance_v1?: unknown;
}): string | null {
  const contexts = parseSceneContextsV1(row.scene_contexts_v1);
  if (contexts.length > 0) {
    return formatStoryRelatedAggregateLine(
      aggregateStoryRelatedRefs({ contexts })
    );
  }
  const provenance = parseFrameProvenance(row.frame_provenance_v1);
  return formatStoryRelatedAggregateLine(
    aggregateStoryRelatedRefs({
      sceneSources: provenance.map((p) => ({
        visualIntent: p.visualIntent,
        rendererExpression: p.rendererExpression,
      })),
    })
  );
}

function parseStoryImagesV2(raw: unknown): ReadingFrame[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const out: ReadingFrame[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { url?: unknown; caption?: unknown };
    const url = typeof rec.url === "string" ? rec.url : "";
    const caption = typeof rec.caption === "string" ? rec.caption : "";
    // Keep caption-only frames (Discovery / Rollout write url:"")
    if (url.trim() || caption.trim()) {
      out.push({ url, caption });
    }
  }
  return out;
}

function expressionHasNarrativeCues(
  expr: {
    lighting?: string;
    atmosphere?: string;
    threatPerception?: string;
    visualEmphasis?: string;
  } | undefined
): boolean {
  if (!expr) return false;
  return Boolean(
    expr.lighting?.trim() ||
      expr.atmosphere?.trim() ||
      expr.threatPerception?.trim() ||
      expr.visualEmphasis?.trim()
  );
}

function rowToReadingRoute(row: ReadingRouteRow): ReadingRoute {
  const frames = parseStoryImagesV2(row.story_images_v2);
  const provenance = parseFrameProvenance(row.frame_provenance_v1);
  const frameHasRendererExpression = (frames ?? []).map((_, frameIndex) =>
    provenance.some(
      (p) => p.frameIndex === frameIndex && Boolean(p.rendererExpression)
    )
  );
  const frameExpressionHasNarrativeCues = (frames ?? []).map((_, frameIndex) => {
    const entry = provenance.find(
      (p) => p.frameIndex === frameIndex && p.rendererExpression
    );
    return expressionHasNarrativeCues(entry?.rendererExpression);
  });
  return {
    workId: row.work_id,
    tsid: row.tsid,
    title: row.title,
    chapter_number: row.chapter_number,
    chapter_title: row.chapter_title ?? null,
    summary: row.summary,
    tags: row.tags ?? [],
    story_images_v2: frames,
    locationId: locationIdFromDb(row.location_id),
    characterIds: row.character_ids ?? [],
    relatedFromContextsLine: relatedLineFromRouteRow(row),
    frameHasRendererExpression,
    frameExpressionHasNarrativeCues,
  };
}

function toInsertRow(
  workId: string,
  data: Omit<ReadingRoute, "tsid" | "workId"> & { tsid: string }
): Record<string, unknown> {
  // L3-A: never persist Route membership from Admin payloads.
  return {
    work_id: workId,
    tsid: data.tsid,
    title: data.title,
    chapter_number: data.chapter_number,
    chapter_title: data.chapter_title ?? null,
    order_index: 0,
    summary: data.summary,
    tags: data.tags,
    story_images_v2: data.story_images_v2 ?? [],
    ...emptyRouteMembershipDb(),
  };
}

/** L3-A: update patch omits character_ids / location_id (no re-pollution; no column drop). */
export function toUpdateRowWithoutMembership(
  data: Omit<ReadingRoute, "tsid" | "workId">
): Record<string, unknown> {
  return {
    title: data.title,
    chapter_number: data.chapter_number,
    chapter_title: data.chapter_title ?? null,
    summary: data.summary,
    tags: data.tags,
    story_images_v2: data.story_images_v2 ?? [],
  };
}

function toUpdateRow(
  data: Omit<ReadingRoute, "tsid" | "workId">
): Record<string, unknown> {
  return toUpdateRowWithoutMembership(data);
}

export async function getScenes(workId: string): Promise<ReadingRoute[]> {
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

    return (data as ReadingRouteRow[] | null)?.map(rowToReadingRoute) ?? [];
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
): Promise<ReadingRoute | null> {
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

    return rowToReadingRoute(data as ReadingRouteRow);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export async function createScene(
  workId: string,
  data: Omit<ReadingRoute, "tsid" | "workId"> & { tsid?: string }
): Promise<ReadingRoute> {
  try {
    const { tsid: optionalTsid, ...rest } = data;
    const tsid = optionalTsid?.trim() || `scene_${Date.now()}`;
    const full: Omit<ReadingRoute, "tsid" | "workId"> & { tsid: string } = {
      tsid,
      title: rest.title,
      chapter_number: rest.chapter_number,
      chapter_title: rest.chapter_title ?? null,
      summary: rest.summary,
      tags: rest.tags,
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

    return rowToReadingRoute(inserted as ReadingRouteRow);
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
  data: Omit<ReadingRoute, "tsid" | "workId">
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

/**
 * Patch frame URLs by index without dropping empty-url sibling frames.
 * Business transition: caller must only invoke after human confirms write (Gate E).
 * Execution (Cloudinary upload) stays outside this function.
 */
export async function patchSceneFrameUrls(
  workId: string,
  tsid: string,
  patches: Array<{ frameIndex: number; url: string }>
): Promise<void> {
  const scene = await getScene(workId, tsid);
  if (!scene) {
    throw new Error(`故事不存在：${tsid}`);
  }
  const frames = [...(scene.story_images_v2 ?? [])];
  for (const patch of patches) {
    const url = patch.url.trim();
    if (!url) {
      throw new Error("frame url 不能为空");
    }
    if (patch.frameIndex < 0 || patch.frameIndex >= frames.length) {
      throw new Error(
        `帧索引越界：${tsid}[${patch.frameIndex}]（共 ${frames.length} 帧）`
      );
    }
    frames[patch.frameIndex] = {
      ...frames[patch.frameIndex],
      url,
    };
  }
  await updateScene(workId, tsid, {
    title: scene.title,
    chapter_number: scene.chapter_number,
    chapter_title: scene.chapter_title,
    summary: scene.summary,
    tags: scene.tags,
    story_images_v2: frames,
    locationId: scene.locationId,
    characterIds: scene.characterIds,
  });
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
