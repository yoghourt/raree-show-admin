import {
  parseRendererExpression,
  type RendererExpression,
} from "@/lib/discovery/visual-contract";
import { supabase } from "@/lib/supabase";
import {
  parseFrameProvenance,
  type FrameProvenanceEntry,
} from "@/lib/rollout/scenes-server";
import {
  aggregateStoryRelatedRefs,
  formatStoryRelatedAggregateLine,
} from "@/lib/scene-context/aggregate-story-refs";
import {
  applySceneFrameStructure,
  FrameStructureWriteError,
} from "@/lib/scene-context/apply-frame-structure";
import { syncFrameContextAppearanceFromExpression } from "@/lib/scene-context/frame-context-edit";
import {
  isPositionalBijection,
  provenanceFromIdentity,
} from "@/lib/scene-context/frame-identity";
import { parseSceneContextsV1 } from "@/lib/scene-context/parse";
import type { SceneContextRecord } from "@/lib/scene-context/types";
import type { ReadingFrame, ReadingRoute } from "@/lib/types";

const TABLE = "scenes";

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
    // Keep empty slots so Human can author Frame Narrative independently.
    out.push({ url, caption });
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
    order_index: row.order_index ?? 0,
    summary: row.summary,
    tags: row.tags ?? [],
    story_images_v2: frames,
    sceneContexts: parseSceneContextsV1(row.scene_contexts_v1),
    relatedFromContextsLine: relatedLineFromRouteRow(row),
    frameHasRendererExpression,
    frameExpressionHasNarrativeCues,
    frameIdentity: (frames ?? []).map((_, frameIndex) => {
      const entry = provenance.find((item) => item.frameIndex === frameIndex);
      return entry?.sourceReviewId ?? null;
    }),
    frameProvenanceExpected: row.frame_provenance_v1 ?? [],
    frameStructureBijection: isPositionalBijection(
      frames?.length ?? 0,
      provenance
    ),
  };
}

/** Write input — order_index is assigned by create / reorder, not by forms. */
export type ReadingRouteWriteInput = Omit<ReadingRoute, "tsid" | "workId" | "order_index">;

function toInsertRow(
  workId: string,
  data: ReadingRouteWriteInput & { tsid: string; order_index: number }
): Record<string, unknown> {
  // L3-C: Route membership columns removed — never write character_ids / location_id.
  return {
    work_id: workId,
    tsid: data.tsid,
    title: data.title,
    chapter_number: data.chapter_number,
    chapter_title: data.chapter_title ?? null,
    order_index: data.order_index,
    summary: data.summary,
    tags: data.tags,
    story_images_v2: data.story_images_v2 ?? [],
    scene_contexts_v1: (data.sceneContexts ?? []) as SceneContextRecord[],
  };
}

/** Narrative fields only. Frame columns go through apply_scene_frame_structure. */
export function toUpdateRowWithoutMembership(
  data: ReadingRouteWriteInput
): Record<string, unknown> {
  return {
    title: data.title,
    chapter_number: data.chapter_number,
    chapter_title: data.chapter_title ?? null,
    summary: data.summary,
    tags: data.tags,
  };
}

function toUpdateRow(data: ReadingRouteWriteInput): Record<string, unknown> {
  return toUpdateRowWithoutMembership(data);
}

export async function nextOrderIndexInChapter(
  workId: string,
  chapterNumber: number
): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("order_index")
    .eq("work_id", workId)
    .eq("chapter_number", chapterNumber)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const max = (data as { order_index?: number } | null)?.order_index;
  return typeof max === "number" && Number.isFinite(max) ? max + 1 : 0;
}

async function patchSceneOrderIndex(
  workId: string,
  tsid: string,
  orderIndex: number
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ order_index: orderIndex })
    .eq("work_id", workId)
    .eq("tsid", tsid);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Swap adjacent stories within a chapter. If order_index values collide
 * (legacy all-0 rows), renumber by current list order then swap.
 */
export async function reorderScenesInChapter(
  workId: string,
  chapterNumber: number,
  fromTsid: string,
  direction: "up" | "down"
): Promise<void> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("tsid, order_index")
    .eq("work_id", workId)
    .eq("chapter_number", chapterNumber)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as Array<{ tsid: string; order_index: number }> | null) ?? [];
  const index = rows.findIndex((r) => r.tsid === fromTsid);
  if (index < 0) {
    throw new Error(`故事不在第 ${chapterNumber} 章：${fromTsid}`);
  }

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= rows.length) {
    return;
  }

  const orders = rows.map((r) => r.order_index);
  const hasCollision = new Set(orders).size !== orders.length;
  const normalized = hasCollision
    ? rows.map((r, i) => ({ ...r, order_index: i }))
    : rows.map((r) => ({ ...r }));

  if (hasCollision) {
    for (const row of normalized) {
      await patchSceneOrderIndex(workId, row.tsid, row.order_index);
    }
  }

  const a = normalized[index]!;
  const b = normalized[swapWith]!;
  const aOrder = a.order_index;
  const bOrder = b.order_index;
  await patchSceneOrderIndex(workId, a.tsid, bOrder);
  await patchSceneOrderIndex(workId, b.tsid, aOrder);
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
  data: ReadingRouteWriteInput & { tsid?: string }
): Promise<ReadingRoute> {
  try {
    const { tsid: optionalTsid, ...rest } = data;
    const tsid = optionalTsid?.trim() || `scene_${Date.now()}`;
    const order_index = await nextOrderIndexInChapter(
      workId,
      rest.chapter_number
    );
    const full: ReadingRouteWriteInput & { tsid: string; order_index: number } =
      {
        tsid,
        title: rest.title,
        chapter_number: rest.chapter_number,
        chapter_title: rest.chapter_title ?? null,
        order_index,
        summary: rest.summary,
        tags: rest.tags,
        story_images_v2: rest.story_images_v2 ?? [],
        sceneContexts: rest.sceneContexts ?? [],
      };

    const insertRow = {
      ...toInsertRow(workId, full),
      story_images_v2: [],
      scene_contexts_v1: [],
      frame_provenance_v1: [],
    };

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const created = inserted as ReadingRouteRow;
    const frames = full.story_images_v2 ?? [];
    const contexts = full.sceneContexts ?? [];
    if (frames.length > 0 || contexts.length > 0) {
      try {
        await applySceneFrameStructure(supabase, {
          workId,
          sceneTsid: created.tsid,
          expected: [],
          storyImages: frames,
          sceneContexts: contexts,
          provenance: frames.map((_, frameIndex) => ({
            sourceReviewId: "",
            frameIndex,
          })),
        });
      } catch (frameError) {
        await supabase.from(TABLE).delete().eq("work_id", workId).eq("tsid", created.tsid);
        throw frameError;
      }
    }

    const reloaded = await getScene(workId, created.tsid);
    if (!reloaded) {
      throw new FrameStructureWriteError("frame_write_rejected");
    }
    return reloaded;
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(String(e));
  }
}

export type SceneFrameWrite = {
  frameIdentity: Array<string | null>;
  expectedFrameProvenance: unknown;
};

function framesMatch(
  current: ReadingFrame[],
  next: ReadingFrame[]
): boolean {
  if (current.length !== next.length) return false;
  return current.every(
    (frame, index) =>
      frame.url === next[index]?.url && frame.caption === next[index]?.caption
  );
}

function classifyLegacyFrames(
  current: ReadingFrame[],
  next: ReadingFrame[]
): "unchanged" | "urls_only" | "rejected" {
  if (current.length !== next.length) return "rejected";
  let urlChanged = false;
  for (let index = 0; index < current.length; index += 1) {
    if ((current[index]?.caption ?? "") !== (next[index]?.caption ?? "")) {
      return "rejected";
    }
    if ((current[index]?.url ?? "") !== (next[index]?.url ?? "")) {
      urlChanged = true;
    }
  }
  return urlChanged ? "urls_only" : "unchanged";
}

async function loadSceneFrameRow(workId: string, tsid: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("story_images_v2, frame_provenance_v1, scene_contexts_v1")
    .eq("work_id", workId)
    .eq("tsid", tsid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new FrameStructureWriteError("frame_write_rejected");
  const row = data as {
    story_images_v2?: unknown;
    frame_provenance_v1?: unknown;
    scene_contexts_v1?: unknown;
  };
  const frames = parseStoryImagesV2(row.story_images_v2) ?? [];
  const provenance = parseFrameProvenance(row.frame_provenance_v1);
  const contexts = parseSceneContextsV1(row.scene_contexts_v1);
  return { row, frames, provenance, contexts };
}

async function writeNarrative(
  workId: string,
  tsid: string,
  data: ReadingRouteWriteInput
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update(toUpdateRow(data))
    .eq("work_id", workId)
    .eq("tsid", tsid);
  if (error) throw new Error(error.message);
}

export async function updateScene(
  workId: string,
  tsid: string,
  data: ReadingRouteWriteInput,
  frameWrite?: SceneFrameWrite
): Promise<void> {
  try {
    const loaded = await loadSceneFrameRow(workId, tsid);
    const nextFrames = data.story_images_v2 ?? [];
    const nextContexts = data.sceneContexts ?? [];
    const contextsUnchanged =
      JSON.stringify(loaded.contexts) === JSON.stringify(nextContexts);
    const structureUnchanged =
      framesMatch(loaded.frames, nextFrames) && contextsUnchanged;

    if (!structureUnchanged) {
      if (!isPositionalBijection(loaded.frames.length, loaded.provenance)) {
        throw new FrameStructureWriteError("frame_structure_invariant");
      }
      if (frameWrite) {
        const identity =
          frameWrite.frameIdentity.length === nextFrames.length
            ? frameWrite.frameIdentity
            : null;
        if (!identity) {
          throw new FrameStructureWriteError("frame_structure_invariant");
        }
        let provenance;
        try {
          provenance = provenanceFromIdentity(
            identity,
            parseFrameProvenance(frameWrite.expectedFrameProvenance)
          );
        } catch {
          throw new FrameStructureWriteError("frame_structure_invariant");
        }
        await applySceneFrameStructure(supabase, {
          workId,
          sceneTsid: tsid,
          expected: frameWrite.expectedFrameProvenance ?? [],
          storyImages: nextFrames,
          sceneContexts: nextContexts,
          provenance,
        });
      } else {
        const kind = classifyLegacyFrames(loaded.frames, nextFrames);
        if (kind === "urls_only" && contextsUnchanged) {
          await applySceneFrameStructure(supabase, {
            workId,
            sceneTsid: tsid,
            expected: loaded.row.frame_provenance_v1 ?? [],
            storyImages: nextFrames,
            sceneContexts: loaded.contexts,
            provenance: loaded.provenance,
          });
        } else if (kind !== "unchanged" || !contextsUnchanged) {
          throw new FrameStructureWriteError("frame_structure_invariant");
        }
      }
    }

    await writeNarrative(workId, tsid, data);
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
}

/** Creator-only: frame_provenance_v1 for a Reading Route (by scene tsid). */
export async function getFrameProvenance(
  workId: string,
  tsid: string
): Promise<FrameProvenanceEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("frame_provenance_v1")
    .eq("work_id", workId)
    .eq("tsid", tsid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(`故事不存在：${tsid}`);
  }
  return parseFrameProvenance(
    (data as { frame_provenance_v1?: unknown }).frame_provenance_v1
  );
}

/**
 * Upsert or clear rendererExpression on frame_provenance_v1 at frameIndex.
 * Keeps the existing sourceReviewId. A frame with no id is rejected.
 * When expression is null: strips Expression from the entry.
 * When expression is saved: replaces that frame's Scene Context 出场人物 from
 * Expression.characters (Archive name match).
 */
export async function patchFrameProvenanceExpression(
  workId: string,
  tsid: string,
  frameIndex: number,
  expression: RendererExpression | null
): Promise<void> {
  if (!Number.isInteger(frameIndex) || frameIndex < 0) {
    throw new Error(`帧索引无效：${frameIndex}`);
  }

  const parsedExpr =
    expression === null ? null : parseRendererExpression(expression);
  if (parsedExpr && !parsedExpr.ok) {
    throw new Error(parsedExpr.errors.join("; "));
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "story_images_v2, frame_provenance_v1, scene_contexts_v1, title, chapter_number, chapter_title"
    )
    .eq("work_id", workId)
    .eq("tsid", tsid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(`故事不存在：${tsid}`);
  }

  const row = data as {
    story_images_v2?: unknown;
    frame_provenance_v1?: unknown;
    scene_contexts_v1?: unknown;
    title?: unknown;
    chapter_number?: unknown;
    chapter_title?: unknown;
  };
  const frames = parseStoryImagesV2(row.story_images_v2) ?? [];
  if (frameIndex >= frames.length) {
    throw new Error(
      `帧索引越界：${tsid}[${frameIndex}]（共 ${frames.length} 帧）`
    );
  }

  const provenance = parseFrameProvenance(row.frame_provenance_v1);
  const existingIdx = provenance.findIndex((p) => p.frameIndex === frameIndex);
  const existing = existingIdx >= 0 ? provenance[existingIdx] : undefined;

  let next: FrameProvenanceEntry[];
  if (parsedExpr === null) {
    if (!existing) {
      return;
    }
    const kept: FrameProvenanceEntry = {
      sourceReviewId: existing.sourceReviewId,
      frameIndex: existing.frameIndex,
    };
    if (existing.visualIntent) kept.visualIntent = existing.visualIntent;
    if (existing.sourceContextId) kept.sourceContextId = existing.sourceContextId;
    next = [...provenance];
    next[existingIdx] = kept;
  } else {
    if (!existing?.sourceReviewId?.trim()) {
      throw new FrameStructureWriteError("frame_structure_invariant");
    }
    const entry: FrameProvenanceEntry = {
      sourceReviewId: existing.sourceReviewId,
      frameIndex,
      rendererExpression: parsedExpr.value,
    };
    if (existing?.visualIntent) entry.visualIntent = existing.visualIntent;
    if (existing?.sourceContextId) {
      entry.sourceContextId = existing.sourceContextId;
    }
    if (existingIdx >= 0) {
      next = [...provenance];
      next[existingIdx] = entry;
    } else {
      next = [...provenance, entry];
    }
  }

  let nextContexts = parseSceneContextsV1(row.scene_contexts_v1);

  if (parsedExpr !== null) {
    const frame = frames[frameIndex];
    if (frame) {
      const { data: characterRows, error: characterError } = await supabase
        .from("characters")
        .select("tsid, name")
        .eq("work_id", workId);
      if (characterError) {
        throw new Error(characterError.message);
      }
      const archiveCharacters = (characterRows ?? []).flatMap((raw) => {
        const rec = raw as { tsid?: unknown; name?: unknown };
        const charTsid = typeof rec.tsid === "string" ? rec.tsid.trim() : "";
        const name = typeof rec.name === "string" ? rec.name.trim() : "";
        return charTsid && name ? [{ tsid: charTsid, name }] : [];
      });
      const chapterNumber =
        typeof row.chapter_number === "number" &&
        Number.isFinite(row.chapter_number)
          ? row.chapter_number
          : 1;
      const chapterTitle =
        typeof row.chapter_title === "string" ? row.chapter_title : null;
      const routeTitle = typeof row.title === "string" ? row.title : "";
      nextContexts = syncFrameContextAppearanceFromExpression({
        workId,
        readingRouteTsid: tsid,
        frameIndex,
        frame,
        contexts: parseSceneContextsV1(row.scene_contexts_v1),
        routeTitle,
        chapter_number: chapterNumber,
        chapter_title: chapterTitle,
        expression: parsedExpr.value,
        archiveCharacters,
      });
    }
  }

  if (!isPositionalBijection(frames.length, provenance)) {
    throw new FrameStructureWriteError("frame_structure_invariant");
  }
  if (!isPositionalBijection(frames.length, next)) {
    throw new FrameStructureWriteError("frame_structure_invariant");
  }

  await applySceneFrameStructure(supabase, {
    workId,
    sceneTsid: tsid,
    expected: row.frame_provenance_v1 ?? [],
    storyImages: frames,
    sceneContexts: nextContexts,
    provenance: next,
  });
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
  const loaded = await loadSceneFrameRow(workId, tsid);
  if (!isPositionalBijection(loaded.frames.length, loaded.provenance)) {
    throw new FrameStructureWriteError("frame_structure_invariant");
  }
  const frames = [...loaded.frames];
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
    const current = frames[patch.frameIndex];
    if (!current) {
      throw new Error(
        `帧索引越界：${tsid}[${patch.frameIndex}]（共 ${frames.length} 帧）`
      );
    }
    frames[patch.frameIndex] = {
      ...current,
      url,
    };
  }
  await applySceneFrameStructure(supabase, {
    workId,
    sceneTsid: tsid,
    expected: loaded.row.frame_provenance_v1 ?? [],
    storyImages: frames,
    sceneContexts: loaded.contexts,
    provenance: loaded.provenance,
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
