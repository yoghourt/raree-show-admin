import { describe, expect, it } from "vitest";

import { deriveProductionPlan } from "@/lib/production/derive-tasks";
import type { Character, ReadingRoute, Work } from "@/lib/types";

const work = (overrides: Partial<Work> = {}): Work => ({
  id: "w1",
  tsid: "work_1",
  title: "Test",
  description: "",
  coverImage: "https://example.com/cover.jpg",
  sourceProfileId: null,
  createdAt: "",
  ...overrides,
});

const character = (overrides: Partial<Character> = {}): Character => ({
  id: "c1",
  tsid: "char_1",
  name: "A",
  house: "",
  description: "",
  signatureQuote: null,
  portraitUrl: "",
  workId: "w1",
  createdAt: "",
  ...overrides,
});

const route = (overrides: Partial<ReadingRoute> = {}): ReadingRoute => ({
  workId: "w1",
  tsid: "scene_1",
  title: "R1",
  chapter_number: 1,
  chapter_title: null,
  summary: "",
  tags: [],
  story_images_v2: [{ url: "", caption: "hello" }],
  locationId: null,
  characterIds: [],
  ...overrides,
});

describe("deriveProductionPlan", () => {
  it("derives frame and portrait gaps from Assets", () => {
    const plan = deriveProductionPlan({
      work: work(),
      characters: [character()],
      routes: [route()],
    });
    expect(plan.tasks.some((t) => t.kind === "complete_character_portrait")).toBe(
      true
    );
    expect(plan.tasks.some((t) => t.kind === "fill_frame_url")).toBe(true);
    expect(plan.progressPercent).toBeLessThan(100);
  });

  it("reports complete when Assets satisfy profile", () => {
    const plan = deriveProductionPlan({
      work: work(),
      characters: [
        character({ portraitUrl: "https://res.cloudinary.com/x/image.jpg" }),
      ],
      routes: [
        route({
          story_images_v2: [
            { url: "https://res.cloudinary.com/x/f.jpg", caption: "hello" },
          ],
        }),
      ],
    });
    expect(plan.tasks).toHaveLength(0);
    expect(plan.progressPercent).toBe(100);
  });
});
