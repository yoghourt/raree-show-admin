/**
 * SPEC-ROL-001 §4.6 — Reading Route staging → Runtime ReadingRoute create payload
 * L3-C: no Route membership fields on create payload.
 */

import { z } from "zod";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import { parseSceneChapterNumber } from "@/lib/discovery/scene-chapter-number";
import type { ReadingRoute } from "@/lib/types";

const readingRouteCreateSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  chapter_number: z.number().int().min(1, "chapter_number must be at least 1"),
  chapter_title: z.string().nullable(),
  summary: z.string(),
  tags: z.array(z.string()),
  story_images_v2: z.null(),
});

export type ReadingRouteCreatePayload = Omit<
  ReadingRoute,
  "tsid" | "workId" | "order_index"
>;

export type ReadingRouteMappingResult =
  | { ok: true; payload: ReadingRouteCreatePayload }
  | { ok: false; fieldErrors: Record<string, string[]> };

export function mapSceneStagingToReadingRoutePayload(
  staging: AcceptedSceneCandidateStaging
): ReadingRouteMappingResult {
  const chapterNumber = parseSceneChapterNumber(staging.chapter_number);
  if (chapterNumber === null) {
    return {
      ok: false,
      fieldErrors: { chapter_number: ["chapter_number must be a valid number"] },
    };
  }

  const raw = {
    title: staging.title.trim(),
    chapter_number: chapterNumber,
    chapter_title:
      staging.chapter_title == null
        ? null
        : String(staging.chapter_title).trim() || null,
    summary: staging.summary?.trim() ?? "",
    tags: [] as string[],
    story_images_v2: null,
  };

  const parsed = readingRouteCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  return { ok: true, payload: parsed.data };
}
