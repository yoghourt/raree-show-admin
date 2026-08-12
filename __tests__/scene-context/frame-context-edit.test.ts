/**
 * IMPLEMENT-SCC-001-L4-A — Frame ↔ Context edit helpers
 */

import { describe, expect, it } from "vitest";

import {
  appearancesFromCharacterTsids,
  enrichContextArchiveRefsFromWork,
  ensureContextForFrame,
  removeFrameWithContexts,
  swapFramesWithContexts,
} from "@/lib/scene-context/frame-context-edit";
import type { SceneContextRecord } from "@/lib/scene-context/types";

const ctx = (
  frameIndex: number,
  id: string
): SceneContextRecord => ({
  contextId: id,
  workId: "work-1",
  readingRouteTsid: "scene_1",
  storyDeliveryHint: {
    parentStorySourceReviewId: "",
    parentStoryTitle: "Arc",
  },
  editorialAssociation: {
    editorialSceneSourceReviewId: id.replace("ctx_", ""),
    associationKind: "editorial_scene_to_scene_context",
  },
  narrativeMoment: {
    title: `F${frameIndex}`,
    summary: null,
    chapter_number: 1,
    chapter_title: null,
  },
  characterAppearanceContext: [
    { role: "c", name: `N${frameIndex}`, archiveTsid: `char_${frameIndex}` },
  ],
  locationContext: { environmentFromExpression: "" },
  creationFacingVisualExpression: null,
  readerFacingNarrativeContext: { beatSummary: `F${frameIndex}` },
  projectsToFrameIndex: frameIndex,
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
});

describe("swapFramesWithContexts", () => {
  it("swaps frames and remaps Context indices (not Route membership)", () => {
    const frames = [
      { url: "", caption: "A" },
      { url: "", caption: "B" },
      { url: "", caption: "C" },
    ];
    const contexts = [ctx(0, "ctx_a"), ctx(1, "ctx_b"), ctx(2, "ctx_c")];
    const next = swapFramesWithContexts(frames, contexts, 0, 1);
    expect(next.frames.map((f) => f.caption)).toEqual(["B", "A", "C"]);
    expect(
      next.contexts.find((c) => c.contextId === "ctx_a")?.projectsToFrameIndex
    ).toBe(1);
    expect(
      next.contexts.find((c) => c.contextId === "ctx_b")?.projectsToFrameIndex
    ).toBe(0);
    expect(
      next.contexts.find((c) => c.contextId === "ctx_a")
        ?.characterAppearanceContext[0]?.archiveTsid
    ).toBe("char_0");
  });
});

describe("removeFrameWithContexts", () => {
  it("drops Context at removed index and decrements higher", () => {
    const frames = [
      { url: "", caption: "A" },
      { url: "", caption: "B" },
      { url: "", caption: "C" },
    ];
    const contexts = [ctx(0, "ctx_a"), ctx(1, "ctx_b"), ctx(2, "ctx_c")];
    const next = removeFrameWithContexts(frames, contexts, 1);
    expect(next.frames.map((f) => f.caption)).toEqual(["A", "C"]);
    expect(next.contexts.map((c) => c.contextId).sort()).toEqual([
      "ctx_a",
      "ctx_c",
    ]);
    expect(
      next.contexts.find((c) => c.contextId === "ctx_c")?.projectsToFrameIndex
    ).toBe(1);
  });
});

describe("ensureContextForFrame", () => {
  it("creates Context owned appearance slot without writing Route fields", () => {
    const frames = [{ url: "", caption: "Beat" }];
    const next = ensureContextForFrame({
      workId: "work-1",
      readingRouteTsid: "scene_1",
      frameIndex: 0,
      frame: frames[0]!,
      contexts: [],
      routeTitle: "Arc",
      chapter_number: 1,
      chapter_title: null,
      now: "2026-08-11T00:00:00.000Z",
    });
    expect(next).toHaveLength(1);
    expect(next[0]!.projectsToFrameIndex).toBe(0);
    expect(next[0]!.characterAppearanceContext).toEqual([]);
    expect(next[0]!.readerFacingNarrativeContext.beatSummary).toBe("Beat");
    expect(next).not.toHaveProperty("character_ids");
  });
});

describe("appearancesFromCharacterTsids", () => {
  it("maps Archive refs onto Context appearance only", () => {
    const apps = appearancesFromCharacterTsids(
      ["char_a", "char_missing"],
      [{ tsid: "char_a", name: "Arya" }]
    );
    expect(apps).toEqual([
      { role: "character", name: "Arya", archiveTsid: "char_a" },
    ]);
  });
});

describe("enrichContextArchiveRefsFromWork", () => {
  it("fills missing archiveTsid from name / environment cues", () => {
    const bare = ctx(0, "ctx_bare");
    bare.characterAppearanceContext = [
      { role: "Ser Waymar Royce", name: "Ser Waymar Royce" },
    ];
    bare.locationContext = {
      environmentFromExpression: "Winterfell courtyard",
    };
    const enriched = enrichContextArchiveRefsFromWork(bare, {
      characters: [{ tsid: "char_waymar", name: "Ser Waymar Royce" }],
      locations: [{ tsid: "loc_winterfell", name: "Winterfell" }],
    });
    expect(enriched?.characterAppearanceContext[0]?.archiveTsid).toBe(
      "char_waymar"
    );
    expect(enriched?.locationContext.archiveTsid).toBe("loc_winterfell");
    expect(
      enrichContextArchiveRefsFromWork(enriched!, {
        characters: [{ tsid: "char_waymar", name: "Ser Waymar Royce" }],
        locations: [{ tsid: "loc_winterfell", name: "Winterfell" }],
      })
    ).toBeNull();
  });
});
