/**
 * IMPLEMENT-SCC-001-L2-B — Story A display ∪ child scenes/Contexts only
 */

import { describe, expect, it } from "vitest";

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  aggregateStoryRelatedFromSceneStagings,
  aggregateStoryRelatedRefs,
  formatStoryRelatedAggregateLine,
} from "@/lib/scene-context/aggregate-story-refs";
import type { SceneContextRecord } from "@/lib/scene-context/types";

function sceneStaging(
  overrides: Partial<AcceptedSceneCandidateStaging> & {
    sourceReviewId: string;
    parentStorySourceReviewId: string;
  }
): AcceptedSceneCandidateStaging {
  return {
    workId: "work-1",
    title: "Beat",
    chapter_number: 1,
    acceptedAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("aggregateStoryRelatedRefs (L2-B)", () => {
  it("Story A union excludes Story B-only appearance/location cues", () => {
    const storyAScenes = [
      sceneStaging({
        sourceReviewId: "rev-scene-a1",
        parentStorySourceReviewId: "rev-story-a",
        visualIntent: {
          characters: [{ role: "mother", name: "Fantine" }],
          emotion: "tender",
          purpose: "parting",
          relationship: null,
        },
        rendererExpression: {
          environment: "Paris street at night",
          characters: [{ role: "mother", visual: "thin shawl" }],
          action: "holds child",
          composition: "medium",
        },
      }),
    ];
    const storyBScenes = [
      sceneStaging({
        sourceReviewId: "rev-scene-b1",
        parentStorySourceReviewId: "rev-story-b",
        visualIntent: {
          characters: [{ role: "assassin", name: "Arya" }],
          emotion: "cold",
          purpose: "strike",
          relationship: null,
        },
        rendererExpression: {
          environment: "Winterfell courtyard",
          characters: [{ role: "assassin", visual: "hooded" }],
          action: "draws blade",
          composition: "close",
        },
      }),
    ];

    const aggA = aggregateStoryRelatedFromSceneStagings(storyAScenes);
    const aggB = aggregateStoryRelatedFromSceneStagings(storyBScenes);

    expect(aggA.characters.map((c) => c.name)).toEqual(["Fantine"]);
    expect(aggA.locations.map((l) => l.label)).toContain(
      "Paris street at night"
    );
    expect(aggA.characters.map((c) => c.name)).not.toContain("Arya");
    expect(aggA.locations.map((l) => l.label).join(" ")).not.toContain(
      "Winterfell"
    );

    expect(aggB.characters.map((c) => c.name)).toEqual(["Arya"]);
    expect(aggB.characters.map((c) => c.name)).not.toContain("Fantine");
  });

  it("prefers Context records over staging when both provided", () => {
    const contexts: SceneContextRecord[] = [
      {
        contextId: "ctx_a",
        workId: "work-1",
        readingRouteTsid: "scene_route_a",
        storyDeliveryHint: {
          parentStorySourceReviewId: "rev-story-a",
          parentStoryTitle: "A",
        },
        editorialAssociation: {
          editorialSceneSourceReviewId: "rev-scene-a1",
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
          environmentFromExpression: "Paris street at night",
          archiveTsid: "loc_paris",
        },
        creationFacingVisualExpression: null,
        readerFacingNarrativeContext: { beatSummary: "Beat" },
        projectsToFrameIndex: 0,
        createdAt: "2026-08-08T00:00:00.000Z",
        updatedAt: "2026-08-08T00:00:00.000Z",
      },
    ];

    const stagingNoise = [
      sceneStaging({
        sourceReviewId: "rev-scene-b1",
        parentStorySourceReviewId: "rev-story-b",
        visualIntent: {
          characters: [{ role: "assassin", name: "Arya" }],
          emotion: "cold",
          purpose: "strike",
          relationship: null,
        },
        rendererExpression: {
          environment: "Winterfell",
          characters: [{ role: "assassin", visual: "hooded" }],
          action: "strike",
          composition: "close",
        },
      }),
    ];

    const agg = aggregateStoryRelatedRefs({
      contexts,
      sceneStagings: stagingNoise,
    });

    expect(agg.characters.map((c) => c.name)).toEqual(["Fantine"]);
    expect(agg.characters[0]!.archiveTsid).toBe("char_fantine");
    expect(agg.characters.map((c) => c.name)).not.toContain("Arya");
    expect(formatStoryRelatedAggregateLine(agg, { alreadyExistsLabel: "已存在" })).toContain(
      "Fantine（已存在）"
    );
  });
});
