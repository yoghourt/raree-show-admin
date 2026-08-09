/**
 * IMPLEMENT-SCC-001-L3-A — edits MUST NOT write Route membership.
 */

import { describe, expect, it } from "vitest";

import {
  emptyRouteMembershipApp,
  emptyRouteMembershipDb,
} from "@/lib/rollout/route-membership";
import {
  relatedLineFromRouteRow,
  toUpdateRowWithoutMembership,
} from "@/lib/scenes";

describe("L3-A Route membership demotion", () => {
  it("update patch omits character_ids and location_id", () => {
    const patch = toUpdateRowWithoutMembership({
      title: "Arc",
      chapter_number: 1,
      chapter_title: null,
      summary: "s",
      tags: [],
      story_images_v2: [{ url: "", caption: "beat" }],
      locationId: "loc_pollute",
      characterIds: ["char_pollute"],
    });

    expect(patch).not.toHaveProperty("character_ids");
    expect(patch).not.toHaveProperty("location_id");
    expect(patch.title).toBe("Arc");
    expect(patch.story_images_v2).toEqual([{ url: "", caption: "beat" }]);
  });

  it("insert membership helpers are empty", () => {
    expect(emptyRouteMembershipDb()).toEqual({
      location_id: "",
      character_ids: [],
    });
    expect(emptyRouteMembershipApp()).toEqual({
      locationId: null,
      characterIds: [],
    });
  });

  it("related line prefers Context aggregate over Route membership fields", () => {
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
