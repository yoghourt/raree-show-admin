/**
 * IMPLEMENT-SCC-001-L3-C — Route membership columns sunset.
 */

import { describe, expect, it } from "vitest";

import {
  relatedLineFromRouteRow,
  toUpdateRowWithoutMembership,
} from "@/lib/scenes";
import { rowToReadingRoute } from "@/lib/rollout/scenes-server";

describe("L3-C Route membership schema sunset", () => {
  it("update patch has no character_ids / location_id", () => {
    const patch = toUpdateRowWithoutMembership({
      title: "Arc",
      chapter_number: 1,
      chapter_title: null,
      summary: "s",
      tags: [],
      story_images_v2: [{ url: "", caption: "beat" }],
    });

    expect(patch).not.toHaveProperty("character_ids");
    expect(patch).not.toHaveProperty("location_id");
    expect(Object.keys(patch).sort()).toEqual(
      [
        "chapter_number",
        "chapter_title",
        "scene_contexts_v1",
        "story_images_v2",
        "summary",
        "tags",
        "title",
      ].sort()
    );
  });

  it("rowToReadingRoute does not map membership columns", () => {
    const route = rowToReadingRoute({
      work_id: "work-1",
      tsid: "scene_1",
      title: "Arc",
      chapter_number: 1,
      chapter_title: null,
      summary: "s",
      tags: [],
      story_images_v2: [],
      discovery_source_review_id: "rev-1",
      frame_provenance_v1: [],
    });

    expect(route).not.toHaveProperty("characterIds");
    expect(route).not.toHaveProperty("locationId");
    expect(route.tsid).toBe("scene_1");
  });

  it("related line still aggregates from Contexts", () => {
    const line = relatedLineFromRouteRow({
      scene_contexts_v1: [
        {
          contextId: "ctx_1",
          workId: "work-1",
          readingRouteTsid: "scene_1",
          storyDeliveryHint: {
            parentStorySourceReviewId: "rev-story",
            parentStoryTitle: "Arc",
          },
          editorialAssociation: {
            editorialSceneSourceReviewId: "rev-scene",
            associationKind: "editorial_scene_to_scene_context",
          },
          narrativeMoment: {
            title: "Beat",
            summary: null,
            chapter_number: 1,
            chapter_title: null,
          },
          characterAppearanceContext: [
            { role: "mother", name: "Fantine", archiveTsid: "char_fantine" },
          ],
          locationContext: {
            environmentFromExpression: "Paris street",
          },
          creationFacingVisualExpression: null,
          readerFacingNarrativeContext: { beatSummary: "Beat" },
          projectsToFrameIndex: 0,
          createdAt: "2026-08-09T00:00:00.000Z",
          updatedAt: "2026-08-09T00:00:00.000Z",
        },
      ],
      frame_provenance_v1: [],
    });

    expect(line).toContain("Fantine");
    expect(line).toContain("Paris street");
  });
});
