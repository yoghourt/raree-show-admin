/**
 * Story Structure reader-evidence gate (Constitution appendix).
 * Write is incomplete unless Runtime row is readable: title + Frame Narrative.
 *
 * Frame Narrative = story_images_v2[].caption (IMPLEMENT-RFN-001).
 * Story.summary / Scene.summary MUST NOT count as Reader text.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isReadingNarrativelyComplete } from "@/lib/rollout/frame-narrative";
import {
  getSceneRowByTsid,
  parseStoryImagesV2,
} from "@/lib/rollout/scenes-server";

export type ReaderEvidenceResult =
  | {
      ok: true;
      routeTsid: string;
      title: string;
      captionCount: number;
    }
  | {
      ok: false;
      code:
        | "ROUTE_NOT_FOUND"
        | "TITLE_MISSING"
        | "CAPTIONS_MISSING"
        | "CAPTION_COUNT_MISMATCH"
        | "NARRATIVE_MISSING";
      message: string;
    };

/**
 * Read back a persisted Reading Route and assert Reader eligibility:
 * 1) non-empty title
 * 2) at least one Frame Narrative (non-empty caption)
 * 3) optional expectedCaptionCount when the caller projected N Frames
 */
export async function verifyReaderEvidence(
  supabase: SupabaseClient,
  workId: string,
  routeTsid: string,
  options?: { expectedCaptionCount?: number }
): Promise<ReaderEvidenceResult> {
  const row = await getSceneRowByTsid(supabase, workId, routeTsid);
  if (!row) {
    return {
      ok: false,
      code: "ROUTE_NOT_FOUND",
      message: "写入后读回失败：找不到故事",
    };
  }

  const title = row.title?.trim() ?? "";
  if (!title) {
    return {
      ok: false,
      code: "TITLE_MISSING",
      message: "写入后读回失败：故事缺少标题（读者不可见）",
    };
  }

  const frames = parseStoryImagesV2(row.story_images_v2);
  const captions = frames
    .map((f) => f.caption.trim())
    .filter((c) => c.length > 0);

  if (!isReadingNarrativelyComplete(frames) || captions.length === 0) {
    return {
      ok: false,
      code: "NARRATIVE_MISSING",
      message:
        "故事还没有 Reader 叙事帧（Frame Narrative）。仅有 Story.summary 不能进入阅读完成态。",
    };
  }

  const expected = options?.expectedCaptionCount;
  if (typeof expected === "number" && expected > 0 && captions.length < expected) {
    return {
      ok: false,
      code: "CAPTION_COUNT_MISMATCH",
      message: `写入后读回失败：期望 ${expected} 条画面说明，实际 ${captions.length} 条`,
    };
  }

  return {
    ok: true,
    routeTsid: row.tsid,
    title,
    captionCount: captions.length,
  };
}
