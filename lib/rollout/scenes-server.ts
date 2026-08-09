/**
 * Hot path — server-side scenes helpers with Discovery provenance.
 * Reader contract for story_images_v2 remains [{url, caption}].
 * Creator-only Expression/Intent live on frame_provenance_v1 (ADR-011 A3).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  RendererExpression,
  VisualIntent,
} from "@/lib/discovery/visual-contract";
import {
  parseRendererExpression,
  parseVisualIntent,
} from "@/lib/discovery/visual-contract";
import { emptyRouteMembershipDb } from "@/lib/rollout/route-membership";
import type { SceneContextRecord } from "@/lib/scene-context/types";
import type { ReadingFrame, ReadingRoute } from "@/lib/types";

export type FrameProvenanceEntry = {
  sourceReviewId: string;
  frameIndex: number;
  /** Creator generation input — not Reader Truth. */
  rendererExpression?: RendererExpression;
  /** Audit only — MUST NOT be fed to Image Port. */
  visualIntent?: VisualIntent | null;
  /**
   * IMPLEMENT-SCC-001-S1: pointer to Scene Context ownership record.
   * Provenance remains creator transport; Context owns narrative Expression.
   */
  sourceContextId?: string;
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
  /** IMPLEMENT-SCC-001-S1: Scene Context ownership records (delivery host storage). */
  scene_contexts_v1?: unknown;
};

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
      const rec = item as FrameProvenanceEntry & {
        rendererExpression?: unknown;
        visualIntent?: unknown;
      };
      const entry: FrameProvenanceEntry = {
        sourceReviewId: rec.sourceReviewId,
        frameIndex: rec.frameIndex,
      };
      const expr = parseRendererExpression(rec.rendererExpression);
      if (expr.ok) {
        entry.rendererExpression = expr.value;
      }
      if ("visualIntent" in rec) {
        const intent = parseVisualIntent(rec.visualIntent);
        if (intent.ok && intent.value) {
          entry.visualIntent = intent.value;
        }
      }
      const sourceContextId = (rec as { sourceContextId?: unknown })
        .sourceContextId;
      if (typeof sourceContextId === "string" && sourceContextId.trim()) {
        entry.sourceContextId = sourceContextId.trim();
      }
      out.push(entry);
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

/** Base select — safe before scene_contexts_v1 migration is applied. */
const SELECT_COLS =
  "work_id, tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, location_id, character_ids, discovery_source_review_id, frame_provenance_v1";

/**
 * IMPLEMENT-SCC-001-S1 — requires docs/supabase/migrations/20260808000000_scene_contexts_v1.sql
 * Typed as `string` so supabase-js does not parse the select list against generated
 * Database types that may not yet include scene_contexts_v1 (avoids ParserError).
 */
const SELECT_COLS_WITH_CONTEXTS: string = `${SELECT_COLS}, scene_contexts_v1`;

function asSceneRow(data: unknown): SceneRowWithProvenance {
  return data as SceneRowWithProvenance;
}

function asSceneRowOrNull(data: unknown): SceneRowWithProvenance | null {
  return (data as SceneRowWithProvenance | null) ?? null;
}

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
  return asSceneRowOrNull(data);
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
  return asSceneRowOrNull(data);
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
    /** @deprecated L3-A — ignored; inserts always empty membership */
    locationId?: string | null;
    /** @deprecated L3-A — ignored; inserts always empty membership */
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
    // L3-A: ignore caller membership; columns remain until L3-C.
    ...emptyRouteMembershipDb(),
    discovery_source_review_id: params.discoverySourceReviewId,
    frame_provenance_v1: [] as FrameProvenanceEntry[],
  };

  const { data, error } = await supabase
    .from("scenes")
    .insert(insertRow)
    .select(SELECT_COLS)
    .single();

  if (error) throw new Error(error.message);
  return asSceneRow(data);
}

export async function updateSceneFramesAndProvenance(
  supabase: SupabaseClient,
  workId: string,
  tsid: string,
  frames: ReadingFrame[],
  provenance: FrameProvenanceEntry[],
  options?: { sceneContexts?: SceneContextRecord[] }
): Promise<SceneRowWithProvenance> {
  const patch: Record<string, unknown> = {
    story_images_v2: frames,
    frame_provenance_v1: provenance,
  };
  const withContexts = options?.sceneContexts !== undefined;
  if (withContexts) {
    patch.scene_contexts_v1 = options.sceneContexts;
  }

  const { data, error } = await supabase
    .from("scenes")
    .update(patch)
    .eq("work_id", workId)
    .eq("tsid", tsid)
    .select(withContexts ? SELECT_COLS_WITH_CONTEXTS : SELECT_COLS)
    .single();

  if (error) {
    if (
      withContexts &&
      /scene_contexts_v1/i.test(error.message)
    ) {
      throw new Error(
        "scene_contexts_v1 missing — apply docs/supabase/migrations/20260808000000_scene_contexts_v1.sql before enabling SCENE_CONTEXT_PROJECTION_ENABLED"
      );
    }
    throw new Error(error.message);
  }
  return asSceneRow(data);
}

/** Load Route row including scene_contexts_v1 (S1). */
export async function getSceneRowWithContextsByTsid(
  supabase: SupabaseClient,
  workId: string,
  tsid: string
): Promise<SceneRowWithProvenance | null> {
  const { data, error } = await supabase
    .from("scenes")
    .select(SELECT_COLS_WITH_CONTEXTS)
    .eq("work_id", workId)
    .eq("tsid", tsid)
    .maybeSingle();

  if (error) {
    if (/scene_contexts_v1/i.test(error.message)) {
      throw new Error(
        "scene_contexts_v1 missing — apply docs/supabase/migrations/20260808000000_scene_contexts_v1.sql before enabling SCENE_CONTEXT_PROJECTION_ENABLED"
      );
    }
    throw new Error(error.message);
  }
  return asSceneRowOrNull(data);
}

/** List Routes for a Work including scene_contexts_v1 (L3-B backfill). */
export async function listSceneRowsWithContextsForWork(
  supabase: SupabaseClient,
  workId: string
): Promise<SceneRowWithProvenance[]> {
  const { data, error } = await supabase
    .from("scenes")
    .select(SELECT_COLS_WITH_CONTEXTS)
    .eq("work_id", workId)
    .order("chapter_number", { ascending: true });

  if (error) {
    if (/scene_contexts_v1/i.test(error.message)) {
      throw new Error(
        "scene_contexts_v1 missing — apply docs/supabase/migrations/20260808000000_scene_contexts_v1.sql before L3-B backfill"
      );
    }
    throw new Error(error.message);
  }
  return (data as SceneRowWithProvenance[] | null) ?? [];
}

/**
 * L3-B: write scene_contexts_v1 only — MUST NOT patch character_ids / location_id.
 */
export async function replaceSceneContextsOnly(
  supabase: SupabaseClient,
  workId: string,
  tsid: string,
  sceneContexts: SceneContextRecord[]
): Promise<SceneRowWithProvenance> {
  const { data, error } = await supabase
    .from("scenes")
    .update({ scene_contexts_v1: sceneContexts })
    .eq("work_id", workId)
    .eq("tsid", tsid)
    .select(SELECT_COLS_WITH_CONTEXTS)
    .single();

  if (error) {
    if (/scene_contexts_v1/i.test(error.message)) {
      throw new Error(
        "scene_contexts_v1 missing — apply docs/supabase/migrations/20260808000000_scene_contexts_v1.sql before L3-B backfill"
      );
    }
    throw new Error(error.message);
  }
  return asSceneRow(data);
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
