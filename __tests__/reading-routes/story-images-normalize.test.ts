import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Mirrors ReadingRouteForm story_images_v2 preprocess — caption-only and empty
 * Frame slots from persist must survive edit/save (IMPLEMENT-RFN-001).
 */
const storyImagesSchema = z.preprocess(
  (v) => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const rec = item as { url?: unknown; caption?: unknown };
        return {
          url: typeof rec.url === "string" ? rec.url : "",
          caption: typeof rec.caption === "string" ? rec.caption : "",
        };
      })
  },
  z
    .array(
      z.object({
        url: z.string(),
        caption: z.string(),
      })
    )
    .default([])
);

describe("story_images_v2 form normalize", () => {
  it("keeps Discovery caption-only frames", () => {
    const parsed = storyImagesSchema.parse([
      { url: "", caption: "Children find the direwolf" },
      { url: null, caption: "Bring pups to Winterfell" },
      { caption: "Missing url key" },
    ]);
    expect(parsed).toEqual([
      { url: "", caption: "Children find the direwolf" },
      { url: "", caption: "Bring pups to Winterfell" },
      { url: "", caption: "Missing url key" },
    ]);
  });

  it("keeps empty Frame slots (Story → N persist placeholders)", () => {
    const parsed = storyImagesSchema.parse([
      { url: "", caption: "" },
      { url: "https://cdn.example.com/a.jpg", caption: "ok" },
    ]);
    expect(parsed).toEqual([
      { url: "", caption: "" },
      { url: "https://cdn.example.com/a.jpg", caption: "ok" },
    ]);
  });
});
