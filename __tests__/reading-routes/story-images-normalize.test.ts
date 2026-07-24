import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Mirrors ReadingRouteForm story_images_v2 preprocess — caption-only frames
 * from Discovery/Rollout must survive edit/save.
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
      .filter((item) => item.url.trim() !== "" || item.caption.trim() !== "");
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

  it("drops fully blank segments only", () => {
    const parsed = storyImagesSchema.parse([
      { url: "", caption: "" },
      { url: "https://cdn.example.com/a.jpg", caption: "ok" },
    ]);
    expect(parsed).toEqual([
      { url: "https://cdn.example.com/a.jpg", caption: "ok" },
    ]);
  });
});
