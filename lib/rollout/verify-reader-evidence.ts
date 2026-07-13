/**
 * Story Structure reader-evidence gate (Constitution appendix).
 * Write is incomplete unless Runtime row is readable: title + frame captions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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
        | "CAPTION_COUNT_MISMATCH";
      message: string;
    };

/**
 * Read back a persisted Reading Route and assert minimum Story Structure evidence:
 * 1) non-empty title
 * 2) expected number of non-empty captions (when frames were written)
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
  const expected = options?.expectedCaptionCount;

  if (typeof expected === "number" && expected > 0) {
    if (captions.length === 0) {
      return {
        ok: false,
        code: "CAPTIONS_MISSING",
        message: "写入后读回失败：画面说明未落库（读者看不到 caption）",
      };
    }
    if (captions.length < expected) {
      return {
        ok: false,
        code: "CAPTION_COUNT_MISMATCH",
        message: `写入后读回失败：期望 ${expected} 条画面说明，实际 ${captions.length} 条`,
      };
    }
  }

  return {
    ok: true,
    routeTsid: row.tsid,
    title,
    captionCount: captions.length,
  };
}
