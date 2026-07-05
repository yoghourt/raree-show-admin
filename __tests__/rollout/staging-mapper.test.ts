/**
 * SPEC-ROL-001 §4.6 — staging mapper tests
 */

import { describe, expect, it } from "vitest";

import { mapSceneStagingToCreatePayload } from "@/lib/rollout/staging-mapper";

describe("mapSceneStagingToCreatePayload", () => {
  it("maps valid staging to scene create payload", () => {
    const result = mapSceneStagingToCreatePayload({
      workId: "work-1",
      sourceReviewId: "rev-1",
      title: "The Wall",
      chapter_number: 3,
      chapter_title: "Jon",
      summary: "Night watch",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.title).toBe("The Wall");
      expect(result.payload.chapter_number).toBe(3);
      expect(result.payload.chapter_title).toBe("Jon");
      expect(result.payload.summary).toBe("Night watch");
      expect(result.payload.tags).toEqual([]);
      expect(result.payload.characterIds).toEqual([]);
      expect(result.payload.locationId).toBeNull();
    }
  });

  it("coerces string chapter_number", () => {
    const result = mapSceneStagingToCreatePayload({
      workId: "work-1",
      sourceReviewId: "rev-2",
      title: "Scene",
      chapter_number: "12",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.chapter_number).toBe(12);
    }
  });

  it("rejects invalid chapter_number", () => {
    const result = mapSceneStagingToCreatePayload({
      workId: "work-1",
      sourceReviewId: "rev-3",
      title: "Scene",
      chapter_number: "abc",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects empty title", () => {
    const result = mapSceneStagingToCreatePayload({
      workId: "work-1",
      sourceReviewId: "rev-4",
      title: "   ",
      chapter_number: 1,
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
  });
});
