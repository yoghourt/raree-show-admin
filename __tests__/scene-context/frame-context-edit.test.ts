/**
 * IMPLEMENT-SCC-001-L4-A — Frame ↔ Context edit helpers
 */

import { describe, expect, it } from "vitest";

import {
  appearancesFromCharacterTsids,
  appearancesFromExpressionCharacters,
  enrichContextArchiveRefsFromWork,
  ensureContextForFrame,
  removeFrameWithContexts,
  swapFramesWithContexts,
  syncFrameContextAppearanceFromExpression,
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

describe("appearancesFromExpressionCharacters", () => {
  const archive = [
    { tsid: "char_catelyn", name: "Catelyn Stark" },
    { tsid: "char_eddard", name: "Eddard Stark" },
    { tsid: "char_robert", name: "Robert Baratheon" },
    { tsid: "char_jon_snow", name: "Jon Snow" },
    { tsid: "char_jon_arryn", name: "Jon Arryn" },
  ];

  it("matches exact archive names and unique given names", () => {
    const appearances = appearancesFromExpressionCharacters(
      [
        { role: "Catelyn Stark", visual: "auburn hair, travel cloak" },
        { role: "King Robert", visual: "black-bearded king on horseback" },
      ],
      archive
    );
    expect(appearances.map((a) => a.archiveTsid)).toEqual([
      "char_catelyn",
      "char_robert",
    ]);
    expect(appearances[0]?.name).toBe("Catelyn Stark");
    expect(appearances[0]?.visual).toBe("auburn hair, travel cloak");
  });

  it("skips generic extras and ambiguous given names", () => {
    const appearances = appearancesFromExpressionCharacters(
      [
        { role: "man", visual: "soldier" },
        { role: "Jon", visual: "dark-haired youth" },
        { role: "Catelyn", visual: "auburn hair" },
      ],
      archive
    );
    expect(appearances.map((a) => a.archiveTsid)).toEqual(["char_catelyn"]);
  });

  it("dedupes the same archive character listed twice", () => {
    const appearances = appearancesFromExpressionCharacters(
      [
        { role: "Eddard Stark", visual: "dark cloak" },
        { role: "Eddard", visual: "same man closer" },
      ],
      archive
    );
    expect(appearances.map((a) => a.archiveTsid)).toEqual(["char_eddard"]);
  });
});

describe("syncFrameContextAppearanceFromExpression", () => {
  it("replaces existing appearance and creates Context when missing", () => {
    const archive = [
      { tsid: "char_catelyn", name: "Catelyn Stark" },
      { tsid: "char_eddard", name: "Eddard Stark" },
    ];
    const expression = {
      environment: "kingsroad, rain",
      action: "the party rides north",
      composition: "wide traveling group",
      characters: [
        { role: "Catelyn Stark", visual: "travel cloak" },
        { role: "Eddard Stark", visual: "dark cloak" },
      ],
    };
    const stale = ctx(0, "ctx_stale");
    const next = syncFrameContextAppearanceFromExpression({
      workId: "work-1",
      readingRouteTsid: "scene_1",
      frameIndex: 0,
      frame: { url: "", caption: "Catelyn and Ned ride north" },
      contexts: [stale],
      routeTitle: "Arc",
      chapter_number: 1,
      chapter_title: null,
      expression,
      archiveCharacters: archive,
      now: "2026-08-30T00:00:00.000Z",
    });
    const synced = next.find((c) => c.contextId === "ctx_stale");
    expect(synced?.characterAppearanceContext.map((a) => a.archiveTsid)).toEqual(
      ["char_catelyn", "char_eddard"]
    );

    const created = syncFrameContextAppearanceFromExpression({
      workId: "work-1",
      readingRouteTsid: "scene_1",
      frameIndex: 1,
      frame: { url: "", caption: "same beat" },
      contexts: [],
      routeTitle: "Arc",
      chapter_number: 1,
      chapter_title: null,
      expression,
      archiveCharacters: archive,
      now: "2026-08-30T00:00:00.000Z",
    });
    expect(created).toHaveLength(1);
    expect(
      created[0]?.characterAppearanceContext.map((a) => a.archiveTsid)
    ).toEqual(["char_catelyn", "char_eddard"]);
  });
});
