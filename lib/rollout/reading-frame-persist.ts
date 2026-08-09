/**
 * Hotfix — Scene staging → Reading Frame on parent Reading Route
 *
 * IMPLEMENT-SCC-001-S1: when SCENE_CONTEXT_PROJECTION_ENABLED is on for the Work,
 * association → Scene Context → Frame projection runs first; Route character/location
 * fields are not written. Flag off restores legacy staging → Frame path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  associateStagingToSceneContext,
  removeSceneContextBySourceReviewId,
  upsertSceneContext,
  type SceneContextArchiveCatalog,
} from "@/lib/scene-context/associate";
import { isSceneContextProjectionEnabledForWork } from "@/lib/scene-context/feature-flag";
import { parseSceneContextsV1 } from "@/lib/scene-context/parse";
import { assertRuntimeTruthGate } from "@/lib/scene-context/runtime-truth-gate";
import {
  getSceneRowByDiscoverySourceReviewId,
  getSceneRowByTsid,
  getSceneRowWithContextsByTsid,
  parseFrameProvenance,
  parseStoryImagesV2,
  updateSceneFramesAndProvenance,
  type FrameProvenanceEntry,
  type SceneRowWithProvenance,
} from "@/lib/rollout/scenes-server";
import type { ReadingFrame } from "@/lib/types";

export type FramePersistResult =
  | {
      ok: true;
      readingRouteTsid: string;
      frameIndex: number;
      sourceReviewId: string;
      /** Present when IMPLEMENT-SCC-001-S1 Context path ran. */
      contextId?: string;
      contextPath?: boolean;
    }
  | {
      ok: false;
      code:
        | "PARENT_STORY_NOT_PERSISTED"
        | "STAGING_INVALID"
        | "ALREADY_PROJECTED"
        | "SCENE_NOT_FOUND"
        | "RUNTIME_TRUTH_GATE_FAILED";
      message: string;
    };

function captionFromStaging(staging: AcceptedSceneCandidateStaging): string {
  const summary = staging.summary?.trim();
  if (summary) return summary;
  return staging.title.trim();
}

function frameFromStaging(staging: AcceptedSceneCandidateStaging): ReadingFrame {
  return { url: "", caption: captionFromStaging(staging) };
}

/** Work Archive names for Context-scoped enrichment only (ADR-012 L2-A). */
async function loadWorkArchiveCatalog(
  supabase: SupabaseClient,
  workId: string
): Promise<SceneContextArchiveCatalog> {
  const [charactersRes, locationsRes] = await Promise.all([
    supabase.from("characters").select("name, tsid").eq("work_id", workId),
    supabase.from("locations").select("name, tsid").eq("work_id", workId),
  ]);
  return {
    characters: (charactersRes.data ?? []) as Array<{
      name: string;
      tsid: string;
    }>,
    locations: (locationsRes.data ?? []) as Array<{
      name: string;
      tsid: string;
    }>,
  };
}

type ResolveParentResult =
  | { ok: true; parent: SceneRowWithProvenance }
  | {
      ok: false;
      code: "PARENT_STORY_NOT_PERSISTED" | "STAGING_INVALID";
      message: string;
    };

async function resolveParentRoute(
  supabase: SupabaseClient,
  workId: string,
  staging: AcceptedSceneCandidateStaging,
  options?: { parentRouteTsid?: string; withContexts?: boolean }
): Promise<ResolveParentResult> {
  const parentReviewId = staging.parentStorySourceReviewId?.trim();
  if (!parentReviewId) {
    return {
      ok: false,
      code: "PARENT_STORY_NOT_PERSISTED",
      message: "parentStorySourceReviewId is required",
    };
  }

  let parent: SceneRowWithProvenance | null = null;
  if (options?.parentRouteTsid) {
    parent = options.withContexts
      ? await getSceneRowWithContextsByTsid(
          supabase,
          workId,
          options.parentRouteTsid
        )
      : await getSceneRowByTsid(supabase, workId, options.parentRouteTsid);
    if (
      parent &&
      parent.discovery_source_review_id &&
      parent.discovery_source_review_id !== parentReviewId
    ) {
      return {
        ok: false,
        code: "STAGING_INVALID",
        message: "parentRouteTsid does not match parentStorySourceReviewId",
      };
    }
  }
  if (!parent) {
    parent = await getSceneRowByDiscoverySourceReviewId(
      supabase,
      workId,
      parentReviewId
    );
    if (parent && options?.withContexts) {
      parent =
        (await getSceneRowWithContextsByTsid(supabase, workId, parent.tsid)) ??
        parent;
    }
  }

  if (!parent?.discovery_source_review_id) {
    return {
      ok: false,
      code: "PARENT_STORY_NOT_PERSISTED",
      message:
        "Parent Reading Route not persisted for parentStorySourceReviewId",
    };
  }

  return { ok: true, parent };
}

async function persistViaContextPath(
  supabase: SupabaseClient,
  workId: string,
  staging: AcceptedSceneCandidateStaging,
  options?: { parentRouteTsid?: string }
): Promise<FramePersistResult> {
  const resolved = await resolveParentRoute(supabase, workId, staging, {
    parentRouteTsid: options?.parentRouteTsid,
    withContexts: true,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.code,
      message: resolved.message,
    };
  }
  const parent = resolved.parent;

  const frames = parseStoryImagesV2(parent.story_images_v2);
  let provenance = parseFrameProvenance(parent.frame_provenance_v1);
  let contexts = parseSceneContextsV1(parent.scene_contexts_v1);
  const existing = provenance.find(
    (p) => p.sourceReviewId === staging.sourceReviewId
  );

  const nextFrame = frameFromStaging(staging);
  const frameIndex = existing?.frameIndex ?? frames.length;

  // L2-A: Context-scoped archive enrichment (not Route membership).
  const archive = await loadWorkArchiveCatalog(supabase, workId);
  const context = associateStagingToSceneContext(staging, {
    readingRouteTsid: parent.tsid,
    frameIndex,
    archive,
  });
  contexts = upsertSceneContext(contexts, context);

  const provenanceFields: FrameProvenanceEntry = {
    sourceReviewId: staging.sourceReviewId,
    frameIndex,
    sourceContextId: context.contextId,
    // Dual-write Expression for Creator tools that still read provenance (Runtime gap coexistence).
    ...(staging.rendererExpression
      ? { rendererExpression: staging.rendererExpression }
      : {}),
    ...(staging.visualIntent ? { visualIntent: staging.visualIntent } : {}),
  };

  if (existing) {
    frames[existing.frameIndex] = nextFrame;
    provenance = provenance.map((p) =>
      p.sourceReviewId === staging.sourceReviewId
        ? { ...provenanceFields, frameIndex: existing.frameIndex }
        : p
    );
  } else {
    frames.push(nextFrame);
    provenance = [...provenance, provenanceFields];
  }

  const gate = assertRuntimeTruthGate({
    context,
    frame: nextFrame,
  });
  if (!gate.ok) {
    return {
      ok: false,
      code: "RUNTIME_TRUTH_GATE_FAILED",
      message: `Runtime Truth Gate failed: ${gate.failures.join(", ")}`,
    };
  }

  await updateSceneFramesAndProvenance(
    supabase,
    workId,
    parent.tsid,
    frames,
    provenance,
    { sceneContexts: contexts }
  );

  return {
    ok: true,
    readingRouteTsid: parent.tsid,
    frameIndex,
    sourceReviewId: staging.sourceReviewId,
    contextId: context.contextId,
    contextPath: true,
  };
}

async function persistLegacyPath(
  supabase: SupabaseClient,
  workId: string,
  staging: AcceptedSceneCandidateStaging,
  options?: { parentRouteTsid?: string }
): Promise<FramePersistResult> {
  const resolved = await resolveParentRoute(supabase, workId, staging, {
    parentRouteTsid: options?.parentRouteTsid,
    withContexts: false,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.code,
      message: resolved.message,
    };
  }
  const parent = resolved.parent;

  const frames = parseStoryImagesV2(parent.story_images_v2);
  let provenance = parseFrameProvenance(parent.frame_provenance_v1);
  const existing = provenance.find(
    (p) => p.sourceReviewId === staging.sourceReviewId
  );

  const nextFrame = frameFromStaging(staging);

  const provenanceFields: FrameProvenanceEntry = {
    sourceReviewId: staging.sourceReviewId,
    frameIndex: existing?.frameIndex ?? frames.length,
    ...(staging.rendererExpression
      ? { rendererExpression: staging.rendererExpression }
      : {}),
    ...(staging.visualIntent ? { visualIntent: staging.visualIntent } : {}),
  };

  if (existing) {
    frames[existing.frameIndex] = nextFrame;
    provenance = provenance.map((p) =>
      p.sourceReviewId === staging.sourceReviewId
        ? { ...provenanceFields, frameIndex: existing.frameIndex }
        : p
    );
    await updateSceneFramesAndProvenance(
      supabase,
      workId,
      parent.tsid,
      frames,
      provenance
    );
    return {
      ok: true,
      readingRouteTsid: parent.tsid,
      frameIndex: existing.frameIndex,
      sourceReviewId: staging.sourceReviewId,
      contextPath: false,
    };
  }

  const frameIndex = frames.length;
  frames.push(nextFrame);
  provenance = [...provenance, { ...provenanceFields, frameIndex }];

  await updateSceneFramesAndProvenance(
    supabase,
    workId,
    parent.tsid,
    frames,
    provenance
  );

  return {
    ok: true,
    readingRouteTsid: parent.tsid,
    frameIndex,
    sourceReviewId: staging.sourceReviewId,
    contextPath: false,
  };
}

export async function persistReadingFrameFromSceneStaging(
  supabase: SupabaseClient,
  workId: string,
  staging: AcceptedSceneCandidateStaging,
  options?: { parentRouteTsid?: string }
): Promise<FramePersistResult> {
  const parentReviewId = staging.parentStorySourceReviewId?.trim();
  if (!parentReviewId) {
    return {
      ok: false,
      code: "PARENT_STORY_NOT_PERSISTED",
      message: "parentStorySourceReviewId is required",
    };
  }

  if (!staging.title?.trim()) {
    return {
      ok: false,
      code: "STAGING_INVALID",
      message: "Scene staging title is required for Frame caption",
    };
  }

  if (isSceneContextProjectionEnabledForWork(workId)) {
    return persistViaContextPath(supabase, workId, staging, options);
  }

  return persistLegacyPath(supabase, workId, staging, options);
}

export async function unpersistReadingFrame(
  supabase: SupabaseClient,
  workId: string,
  params: { sourceReviewId?: string; readingRouteTsid?: string }
): Promise<
  | {
      ok: true;
      readingRouteTsid: string;
      sourceReviewId: string;
    }
  | { ok: false; code: "STAGING_NOT_FOUND"; message: string }
> {
  const sourceReviewId = params.sourceReviewId?.trim();
  if (!sourceReviewId) {
    return {
      ok: false,
      code: "STAGING_NOT_FOUND",
      message: "sourceReviewId is required to unpersist Frame",
    };
  }

  let parent: SceneRowWithProvenance | null = null;
  if (params.readingRouteTsid) {
    parent = isSceneContextProjectionEnabledForWork(workId)
      ? await getSceneRowWithContextsByTsid(
          supabase,
          workId,
          params.readingRouteTsid
        )
      : await getSceneRowByTsid(supabase, workId, params.readingRouteTsid);
  }

  if (!parent) {
    const { data, error } = await supabase
      .from("scenes")
      .select(
        "work_id, tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, discovery_source_review_id, frame_provenance_v1"
      )
      .eq("work_id", workId)
      .not("discovery_source_review_id", "is", null);

    if (error) throw new Error(error.message);
    const rows = (data as SceneRowWithProvenance[] | null) ?? [];
    parent =
      rows.find((row) =>
        parseFrameProvenance(row.frame_provenance_v1).some(
          (p) => p.sourceReviewId === sourceReviewId
        )
      ) ?? null;
    if (parent && isSceneContextProjectionEnabledForWork(workId)) {
      parent =
        (await getSceneRowWithContextsByTsid(supabase, workId, parent.tsid)) ??
        parent;
    }
  }

  if (!parent) {
    return {
      ok: false,
      code: "STAGING_NOT_FOUND",
      message: "No Frame provenance found for sourceReviewId",
    };
  }

  const frames = parseStoryImagesV2(parent.story_images_v2);
  const provenance = parseFrameProvenance(parent.frame_provenance_v1);
  const entry = provenance.find((p) => p.sourceReviewId === sourceReviewId);
  if (!entry) {
    return {
      ok: false,
      code: "STAGING_NOT_FOUND",
      message: "No Frame provenance found for sourceReviewId",
    };
  }

  const removeIndex = entry.frameIndex;
  const nextFrames = frames.filter((_, i) => i !== removeIndex);
  const nextProvenance: FrameProvenanceEntry[] = provenance
    .filter((p) => p.sourceReviewId !== sourceReviewId)
    .map((p) => ({
      ...p,
      frameIndex: p.frameIndex > removeIndex ? p.frameIndex - 1 : p.frameIndex,
    }));

  const useContexts = isSceneContextProjectionEnabledForWork(workId);
  let nextContexts = parseSceneContextsV1(parent.scene_contexts_v1);
  if (useContexts) {
    nextContexts = removeSceneContextBySourceReviewId(
      nextContexts,
      sourceReviewId
    ).map((c) =>
      c.projectsToFrameIndex > removeIndex
        ? { ...c, projectsToFrameIndex: c.projectsToFrameIndex - 1 }
        : c
    );
  }

  await updateSceneFramesAndProvenance(
    supabase,
    workId,
    parent.tsid,
    nextFrames,
    nextProvenance,
    useContexts ? { sceneContexts: nextContexts } : undefined
  );

  return {
    ok: true,
    readingRouteTsid: parent.tsid,
    sourceReviewId,
  };
}

export async function listFrameProjections(
  supabase: SupabaseClient,
  workId: string
): Promise<
  Array<{
    sourceReviewId: string;
    readingRouteTsid: string;
    frameIndex: number;
    caption: string;
    contextId?: string;
  }>
> {
  const { data, error } = await supabase
    .from("scenes")
    .select(
      "work_id, tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, discovery_source_review_id, frame_provenance_v1"
    )
    .eq("work_id", workId)
    .not("discovery_source_review_id", "is", null);

  if (error) throw new Error(error.message);
  const rows = (data as SceneRowWithProvenance[] | null) ?? [];
  const out: Array<{
    sourceReviewId: string;
    readingRouteTsid: string;
    frameIndex: number;
    caption: string;
    contextId?: string;
  }> = [];

  for (const row of rows) {
    const frames = parseStoryImagesV2(row.story_images_v2);
    for (const p of parseFrameProvenance(row.frame_provenance_v1)) {
      out.push({
        sourceReviewId: p.sourceReviewId,
        readingRouteTsid: row.tsid,
        frameIndex: p.frameIndex,
        caption: frames[p.frameIndex]?.caption ?? "",
        ...(p.sourceContextId ? { contextId: p.sourceContextId } : {}),
      });
    }
  }
  return out;
}
