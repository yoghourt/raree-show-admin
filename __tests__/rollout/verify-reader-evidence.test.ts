import { describe, expect, it } from "vitest";

import { verifyReaderEvidence } from "@/lib/rollout/verify-reader-evidence";

function mockSupabase(row: Record<string, unknown> | null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: row, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    },
  } as never;
}

describe("verifyReaderEvidence", () => {
  it("fails when route missing", async () => {
    const result = await verifyReaderEvidence(
      mockSupabase(null),
      "work_1",
      "scene_missing"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ROUTE_NOT_FOUND");
  });

  it("fails when title empty", async () => {
    const result = await verifyReaderEvidence(
      mockSupabase({
        work_id: "work_1",
        tsid: "scene_1",
        title: "  ",
        chapter_number: 1,
        chapter_title: null,
        summary: "s",
        tags: null,
        story_images_v2: [{ url: "", caption: "c" }],
        discovery_source_review_id: "r1",
        frame_provenance_v1: [],
      }),
      "work_1",
      "scene_1",
      { expectedCaptionCount: 1 }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TITLE_MISSING");
  });

  it("passes title + caption-only frames", async () => {
    const result = await verifyReaderEvidence(
      mockSupabase({
        work_id: "work_1",
        tsid: "scene_1",
        title: "Tracking the Wildlings",
        chapter_number: 1,
        chapter_title: null,
        summary: "route summary must not be required as caption",
        tags: null,
        story_images_v2: [
          { url: "", caption: "Frame one" },
          { url: "", caption: "Frame two" },
        ],
        discovery_source_review_id: "r1",
        frame_provenance_v1: [],
      }),
      "work_1",
      "scene_1",
      { expectedCaptionCount: 2 }
    );
    expect(result).toEqual({
      ok: true,
      routeTsid: "scene_1",
      title: "Tracking the Wildlings",
      captionCount: 2,
    });
  });
});
