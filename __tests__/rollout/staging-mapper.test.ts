/**
 * SPEC-ROL-001 §4.6 — staging mapper tests
 */

import { describe, expect, it } from "vitest";

import { mapSceneStagingToReadingRoutePayload } from "@/lib/rollout/staging-mapper";

describe("mapSceneStagingToReadingRoutePayload", () => {
  it("maps valid staging to reading route create payload", () => {
    const result = mapSceneStagingToReadingRoutePayload({
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
      expect(result.payload.story_images_v2).toBeNull();
    }
  });

  it("coerces string chapter_number", () => {
    const result = mapSceneStagingToReadingRoutePayload({
      workId: "work-1",
      sourceReviewId: "rev-2",
      title: "Reading Route",
      chapter_number: "12",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.chapter_number).toBe(12);
    }
  });

  it("rejects invalid chapter_number", () => {
    const result = mapSceneStagingToReadingRoutePayload({
      workId: "work-1",
      sourceReviewId: "rev-3",
      title: "Reading Route",
      chapter_number: "abc",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
  });

  it("rejects empty title", () => {
    const result = mapSceneStagingToReadingRoutePayload({
      workId: "work-1",
      sourceReviewId: "rev-4",
      title: "   ",
      chapter_number: 1,
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
  });
});
