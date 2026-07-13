/**
 * Hotfix — Scene staging → Reading Frame on parent Reading Route
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  getSceneRowByDiscoverySourceReviewId,
  getSceneRowByTsid,
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
    }
  | {
      ok: false;
      code:
        | "PARENT_STORY_NOT_PERSISTED"
        | "STAGING_INVALID"
        | "ALREADY_PROJECTED"
        | "SCENE_NOT_FOUND";
      message: string;
    };

function captionFromStaging(staging: AcceptedSceneCandidateStaging): string {
  // Frame caption = Scene progression text only (never parent Story summary).
  // Default: scene title. Optional scene summary appends when operator filled it.
  const title = staging.title.trim();
  const summary = staging.summary?.trim();
  if (!title) return summary || "";
  if (summary && summary !== title) return `${title} — ${summary}`;
  return title;
}

function frameFromStaging(staging: AcceptedSceneCandidateStaging): ReadingFrame {
  return { url: "", caption: captionFromStaging(staging) };
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

  let parent: SceneRowWithProvenance | null = null;
  if (options?.parentRouteTsid) {
    parent = await getSceneRowByTsid(supabase, workId, options.parentRouteTsid);
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
  }

  if (!parent?.discovery_source_review_id) {
    return {
      ok: false,
      code: "PARENT_STORY_NOT_PERSISTED",
      message:
        "Parent Reading Route not persisted for parentStorySourceReviewId",
    };
  }

  const frames = parseStoryImagesV2(parent.story_images_v2);
  let provenance = parseFrameProvenance(parent.frame_provenance_v1);
  const existing = provenance.find(
    (p) => p.sourceReviewId === staging.sourceReviewId
  );

  const nextFrame = frameFromStaging(staging);

  if (existing) {
    frames[existing.frameIndex] = nextFrame;
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
    };
  }

  const frameIndex = frames.length;
  frames.push(nextFrame);
  provenance = [
    ...provenance,
    { sourceReviewId: staging.sourceReviewId, frameIndex },
  ];

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
  };
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
    parent = await getSceneRowByTsid(supabase, workId, params.readingRouteTsid);
  }

  if (!parent) {
    // Scan discovery routes for provenance match
    const { data, error } = await supabase
      .from("scenes")
      .select(
        "work_id, tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, location_id, character_ids, discovery_source_review_id, frame_provenance_v1"
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
      sourceReviewId: p.sourceReviewId,
      frameIndex: p.frameIndex > removeIndex ? p.frameIndex - 1 : p.frameIndex,
    }));

  await updateSceneFramesAndProvenance(
    supabase,
    workId,
    parent.tsid,
    nextFrames,
    nextProvenance
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
  }>
> {
  const { data, error } = await supabase
    .from("scenes")
    .select(
      "work_id, tsid, title, chapter_number, chapter_title, summary, tags, story_images_v2, location_id, character_ids, discovery_source_review_id, frame_provenance_v1"
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
  }> = [];

  for (const row of rows) {
    const frames = parseStoryImagesV2(row.story_images_v2);
    for (const p of parseFrameProvenance(row.frame_provenance_v1)) {
      out.push({
        sourceReviewId: p.sourceReviewId,
        readingRouteTsid: row.tsid,
        frameIndex: p.frameIndex,
        caption: frames[p.frameIndex]?.caption ?? "",
      });
    }
  }
  return out;
}
