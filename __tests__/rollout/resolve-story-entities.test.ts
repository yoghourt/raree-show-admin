/**
 * IMPLEMENT-SCC-001-L3-C — staging membership cleared; never Route ownership.
 */

import { describe, expect, it } from "vitest";

import { resolveStoryRelatedEntities } from "@/lib/rollout/resolve-story-entities";

describe("resolveStoryRelatedEntities (L3-C)", () => {
  it("clears refs and membership fields (columns dropped)", async () => {
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
      characterIds: ["char_arya"],
      locationId: "loc_winterfell",
    });

    expect(resolved.characterIds).toEqual([]);
    expect(resolved.locationId).toBeNull();
    expect(resolved.relatedCharacterRefs).toEqual([]);
    expect(resolved.relatedLocationRefs).toEqual([]);
  });
});
