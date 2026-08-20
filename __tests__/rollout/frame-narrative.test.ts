import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  isReadingNarrativelyComplete,
  projectFrameSlot,
  readerNarrativeFrames,
} from "@/lib/rollout/frame-narrative";
import { parseStoryImagesV2 } from "@/lib/rollout/scenes-server";

describe("IMPLEMENT-RFN-001 Frame Narrative contract", () => {
  it("Case 1: Reader Narrative is caption, not Scene.summary", () => {
    const persist = readFileSync(
      path.join(process.cwd(), "lib/rollout/reading-frame-persist.ts"),
      "utf8"
    );
    expect(persist).not.toContain("captionFromStaging");
    expect(persist).not.toMatch(/caption:\s*staging\.summary/);
    expect(persist).toContain("projectFrameSlot");

    const frames = [
      { url: "", caption: "Frame Narrative the Reader sees" },
    ];
    expect(readerNarrativeFrames(frames)[0]?.caption).toBe(
      "Frame Narrative the Reader sees"
    );
    expect(isReadingNarrativelyComplete(frames)).toBe(true);
  });

  it("Case 2: re-project preserves Human Frame Narrative", () => {
    const existing = {
      url: "https://res.cloudinary.com/x/kept.png",
      caption: "Human edited caption",
    };
    const next = projectFrameSlot(existing);
    expect(next.caption).toBe("Human edited caption");
    expect(next.url).toBe(existing.url);
    expect(next.caption).not.toBe("Scene.summary would have been here");
  });

  it("Case 3: 0 Frame / empty caption is not reading-complete", () => {
    expect(isReadingNarrativelyComplete([])).toBe(false);
    expect(isReadingNarrativelyComplete(null)).toBe(false);
    expect(
      isReadingNarrativelyComplete([{ url: "", caption: "" }])
    ).toBe(false);
    expect(
      isReadingNarrativelyComplete([{ url: "https://x/a.jpg", caption: "  " }])
    ).toBe(false);
  });

  it("Case 4: Story → N Frames keeps sequence and empty slots", () => {
    const parsed = parseStoryImagesV2([
      { url: "", caption: "" },
      { url: "", caption: "Second beat" },
      { url: "", caption: "Third beat" },
    ]);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.caption).toBe("");
    expect(readerNarrativeFrames(parsed)).toHaveLength(2);
    expect(isReadingNarrativelyComplete(parsed)).toBe(true);

    const next = projectFrameSlot(undefined);
    expect(next).toEqual({ url: "", caption: "" });
  });

  it("Case 5: production Discovery does not pass Work Canon", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app/works/[workId]/discovery/page.tsx"),
      "utf8"
    );
    expect(page).not.toContain("requiredUnitAuthority");
    expect(page).not.toContain("workCanon");

    const reviewState = readFileSync(
      path.join(process.cwd(), "lib/discovery/review-state.ts"),
      "utf8"
    );
    expect(reviewState).toContain(
      "Work Canon is not a production Accept prerequisite"
    );
  });
});
