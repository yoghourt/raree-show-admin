/**
 * IMPLEMENT-SCC-001-L3-B — backfill planner
 */

import { describe, expect, it } from "vitest";

import {
  isBackfillPlanNoop,
  planSceneContextBackfill,
} from "@/lib/scene-context/backfill-from-provenance";
import { parseSceneContextsV1 } from "@/lib/scene-context/parse";

const baseRoute = {
  tsid: "scene_route_1",
  title: "Arc",
  chapter_number: 1,
  chapter_title: null as string | null,
  discovery_source_review_id: "rev-story-1",
  story_images_v2: [{ url: "", caption: "Household faces the gate." }],
  frame_provenance_v1: [
    {
      sourceReviewId: "rev-scene-1",
      frameIndex: 0,
      visualIntent: {
        characters: [{ role: "guard", name: "Arya" }],
        emotion: "tense",
        purpose: "watch",
        relationship: null,
      },
      rendererExpression: {
        environment: "winter courtyard",
        characters: [{ role: "guard", visual: "cloaked figure" }],
        action: "stands facing gate",
        composition: "wide",
      },
    },
  ],
  scene_contexts_v1: [] as unknown[],
  character_ids: ["char_pollution_should_not_appear"],
  location_id: "loc_pollution_should_not_appear",
};

describe("planSceneContextBackfill (L3-B)", () => {
  it("adds Context from provenance without using Route membership", () => {
    const plan = planSceneContextBackfill({
      workId: "work-1",
      route: baseRoute,
      now: "2026-08-09T00:00:00.000Z",
      archive: {
        characters: [{ name: "Arya", tsid: "char_arya" }],
        locations: [],
      },
    });

    expect(plan.addedCount).toBe(1);
    expect(plan.nextContexts).toHaveLength(1);
    const ctx = plan.nextContexts[0]!;
    expect(ctx.contextId).toBe("ctx_rev-scene-1");
    expect(ctx.characterAppearanceContext.map((c) => c.name)).toEqual(["Arya"]);
    expect(ctx.characterAppearanceContext[0]!.archiveTsid).toBe("char_arya");
    expect(ctx.locationContext.environmentFromExpression).toContain("courtyard");
    // Pollution membership must not become appearance
    expect(
      JSON.stringify(ctx.characterAppearanceContext)
    ).not.toContain("char_pollution_should_not_appear");
    expect(ctx.locationContext.archiveTsid).toBeUndefined();
  });

  it("is idempotent when Context already exists", () => {
    const first = planSceneContextBackfill({
      workId: "work-1",
      route: baseRoute,
      now: "2026-08-09T00:00:00.000Z",
    });
    const second = planSceneContextBackfill({
      workId: "work-1",
      route: {
        ...baseRoute,
        scene_contexts_v1: first.nextContexts,
      },
      now: "2026-08-09T01:00:00.000Z",
    });

    expect(second.addedCount).toBe(0);
    expect(isBackfillPlanNoop(second)).toBe(true);
    expect(second.actions.every((a) => a.kind === "skip")).toBe(true);
    expect(parseSceneContextsV1(second.nextContexts)).toHaveLength(1);
  });

  it("creates minimal Context from caption when Expression missing", () => {
    const plan = planSceneContextBackfill({
      workId: "work-1",
      route: {
        ...baseRoute,
        frame_provenance_v1: [
          { sourceReviewId: "rev-scene-2", frameIndex: 0 },
        ],
        story_images_v2: [{ url: "", caption: "Caption-only beat." }],
      },
      now: "2026-08-09T00:00:00.000Z",
    });

    expect(plan.addedCount).toBe(1);
    expect(plan.actions[0]).toMatchObject({
      kind: "add",
      reason: "from_caption",
    });
    expect(plan.nextContexts[0]!.readerFacingNarrativeContext.beatSummary).toBe(
      "Caption-only beat."
    );
  });
});
