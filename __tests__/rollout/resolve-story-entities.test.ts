/**
 * IMPLEMENT-SCC-001-L2-A — Route membership must not expand from related refs.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/characters", () => ({
  getAll: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/locations", () => ({
  getAll: vi.fn(),
  create: vi.fn(),
}));

import * as charactersApi from "@/lib/characters";
import * as locationsApi from "@/lib/locations";
import { resolveStoryRelatedEntities } from "@/lib/rollout/resolve-story-entities";

describe("resolveStoryRelatedEntities (L2-A)", () => {
  beforeEach(() => {
    vi.mocked(charactersApi.getAll).mockResolvedValue([
      {
        id: "1",
        workId: "work-1",
        tsid: "char_arya",
        name: "Arya",
        house: "Stark",
        description: "",
        signatureQuote: null,
        portraitUrl: "",
        createdAt: "2026-08-08T00:00:00.000Z",
      },
    ] as Awaited<ReturnType<typeof charactersApi.getAll>>);
    vi.mocked(locationsApi.getAll).mockResolvedValue([
      {
        id: "1",
        workId: "work-1",
        tsid: "loc_winterfell",
        name: "Winterfell",
        region: "North",
        description: "",
        map_focus_x: null,
        map_focus_y: null,
        createdAt: "2026-08-08T00:00:00.000Z",
      },
    ] as Awaited<ReturnType<typeof locationsApi.getAll>>);
    vi.mocked(charactersApi.create).mockReset();
    vi.mocked(locationsApi.create).mockReset();
  });

  it("does not expand relatedCharacterRefs onto characterIds when empty", async () => {
    const resolved = await resolveStoryRelatedEntities("work-1", {
      workId: "work-1",
      sourceReviewId: "rev-story-a",
      title: "Story A",
      summary: "",
      acceptedAt: "2026-08-08T00:00:00.000Z",
      relatedCharacterRefs: [
        {
          sourceReviewId: "rev-char",
          name: "Arya",
          matchedTsid: "char_arya",
        },
      ],
      relatedLocationRefs: [
        {
          sourceReviewId: "rev-loc",
          name: "Winterfell",
          matchedTsid: "loc_winterfell",
        },
      ],
      characterIds: [],
      locationId: null,
    });

    expect(resolved.characterIds).toEqual([]);
    expect(resolved.locationId).toBeNull();
    expect(resolved.relatedCharacterRefs).toEqual([]);
    expect(resolved.relatedLocationRefs).toEqual([]);
    expect(charactersApi.create).not.toHaveBeenCalled();
    expect(locationsApi.create).not.toHaveBeenCalled();
  });

  it("honors only explicit characterIds / locationId", async () => {
    const resolved = await resolveStoryRelatedEntities("work-1", {
      workId: "work-1",
      sourceReviewId: "rev-story-a",
      title: "Story A",
      summary: "",
      acceptedAt: "2026-08-08T00:00:00.000Z",
      relatedCharacterRefs: [
        { sourceReviewId: "rev-char", name: "Arya", matchedTsid: "char_arya" },
      ],
      characterIds: ["char_arya"],
      locationId: "loc_winterfell",
    });

    expect(resolved.characterIds).toEqual(["char_arya"]);
    expect(resolved.locationId).toBe("loc_winterfell");
    expect(charactersApi.create).not.toHaveBeenCalled();
  });
});
