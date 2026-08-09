/**
 * IMPLEMENT-SCC-001-L3-B — Historical Scene Context backfill planner.
 *
 * Builds Context candidates from Frame provenance / caption.
 * MUST NOT use Route character_ids / location_id as ownership source.
 */

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import type { FrameProvenanceEntry } from "@/lib/rollout/scenes-server";
import {
  parseFrameProvenance,
  parseStoryImagesV2,
} from "@/lib/rollout/scenes-server";
import {
  associateStagingToSceneContext,
  upsertSceneContext,
  type SceneContextArchiveCatalog,
} from "@/lib/scene-context/associate";
import { parseSceneContextsV1 } from "@/lib/scene-context/parse";
import type { SceneContextRecord } from "@/lib/scene-context/types";

export type BackfillRouteInput = {
  tsid: string;
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  discovery_source_review_id: string | null;
  story_images_v2: unknown;
  frame_provenance_v1: unknown;
  scene_contexts_v1?: unknown;
  /**
   * Present only so callers can prove we ignore them.
   * MUST NOT feed Context appearance/location ownership.
   */
  character_ids?: string[] | null;
  location_id?: string | null;
};

export type BackfillAction =
  | {
      kind: "skip";
      sourceReviewId: string;
      frameIndex: number;
      reason: "already_has_context" | "no_source_review_id";
    }
  | {
      kind: "add";
      sourceReviewId: string;
      frameIndex: number;
      reason: "from_provenance" | "from_caption";
      context: SceneContextRecord;
    };

export type BackfillPlan = {
  workId: string;
  readingRouteTsid: string;
  existingCount: number;
  actions: BackfillAction[];
  nextContexts: SceneContextRecord[];
  addedCount: number;
  skippedCount: number;
};

function stagingFromProvenance(params: {
  workId: string;
  route: BackfillRouteInput;
  entry: FrameProvenanceEntry;
  caption: string;
}): AcceptedSceneCandidateStaging {
  const caption = params.caption.trim();
  const title =
    caption ||
    params.entry.visualIntent?.purpose?.trim() ||
    `Frame ${params.entry.frameIndex + 1}`;
  return {
    workId: params.workId,
    sourceReviewId: params.entry.sourceReviewId,
    parentStorySourceReviewId:
      params.route.discovery_source_review_id?.trim() || "",
    parentStoryTitle: params.route.title.trim(),
    chapter_number: params.route.chapter_number,
    chapter_title: params.route.chapter_title,
    title,
    summary: caption || undefined,
    visualIntent: params.entry.visualIntent ?? null,
    rendererExpression: params.entry.rendererExpression,
    acceptedAt: new Date(0).toISOString(),
  };
}

/**
 * Plan additive Context backfill for one Reading Route.
 * Idempotent: existing editorial sourceReviewId → skip.
 */
export function planSceneContextBackfill(input: {
  workId: string;
  route: BackfillRouteInput;
  archive?: SceneContextArchiveCatalog;
  now?: string;
  /** When provenance lacks Expression, still create minimal Context from caption (default true). */
  allowCaptionMinimal?: boolean;
}): BackfillPlan {
  const allowCaptionMinimal = input.allowCaptionMinimal !== false;
  const frames = parseStoryImagesV2(input.route.story_images_v2);
  const provenance = parseFrameProvenance(input.route.frame_provenance_v1);
  let contexts = parseSceneContextsV1(input.route.scene_contexts_v1);
  const existingIds = new Set(
    contexts.map((c) => c.editorialAssociation.editorialSceneSourceReviewId)
  );

  const actions: BackfillAction[] = [];
  // Intentionally unused — document anti-pollution: never read for ownership.
  void input.route.character_ids;
  void input.route.location_id;

  for (const entry of provenance) {
    const sourceReviewId = entry.sourceReviewId?.trim() ?? "";
    if (!sourceReviewId) {
      actions.push({
        kind: "skip",
        sourceReviewId: "",
        frameIndex: entry.frameIndex,
        reason: "no_source_review_id",
      });
      continue;
    }
    if (existingIds.has(sourceReviewId)) {
      actions.push({
        kind: "skip",
        sourceReviewId,
        frameIndex: entry.frameIndex,
        reason: "already_has_context",
      });
      continue;
    }

    const caption = frames[entry.frameIndex]?.caption ?? "";
    const hasExpression = Boolean(entry.rendererExpression);
    if (!hasExpression && !allowCaptionMinimal) {
      continue;
    }

    const staging = stagingFromProvenance({
      workId: input.workId,
      route: input.route,
      entry,
      caption,
    });
    const context = associateStagingToSceneContext(staging, {
      readingRouteTsid: input.route.tsid,
      frameIndex: entry.frameIndex,
      now: input.now,
      archive: input.archive,
    });
    contexts = upsertSceneContext(contexts, context);
    existingIds.add(sourceReviewId);
    actions.push({
      kind: "add",
      sourceReviewId,
      frameIndex: entry.frameIndex,
      reason: hasExpression ? "from_provenance" : "from_caption",
      context,
    });
  }

  const addedCount = actions.filter((a) => a.kind === "add").length;
  const skippedCount = actions.filter((a) => a.kind === "skip").length;

  return {
    workId: input.workId,
    readingRouteTsid: input.route.tsid,
    existingCount: parseSceneContextsV1(input.route.scene_contexts_v1).length,
    actions,
    nextContexts: contexts,
    addedCount,
    skippedCount,
  };
}

/** True when plan would not change Context set size / keys (no adds). */
export function isBackfillPlanNoop(plan: BackfillPlan): boolean {
  return plan.addedCount === 0;
}
