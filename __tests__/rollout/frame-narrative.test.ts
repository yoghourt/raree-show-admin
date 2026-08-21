import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  frameNarrativeDraftFromStaging,
  isReadingNarrativelyComplete,
  projectFrameSlot,
  readerNarrativeFrames,
} from "@/lib/rollout/frame-narrative";
import { parseStoryImagesV2 } from "@/lib/rollout/scenes-server";

describe("Frame Narrative draft → caption", () => {
  it("Case 1: confirmed Scene draft becomes caption; Story.summary does not", () => {
    const persist = readFileSync(
      path.join(process.cwd(), "lib/rollout/reading-frame-persist.ts"),
      "utf8"
    );
    expect(persist).toContain("frameNarrativeDraftFromStaging");
    expect(persist).not.toContain("captionFromStaging");
    expect(persist).not.toMatch(/parent\.summary/);

    expect(
      frameNarrativeDraftFromStaging({
        summary: "Zhang Fei slays Deng Mao",
        title: "Duel",
      })
    ).toBe("Zhang Fei slays Deng Mao");
    expect(
      projectFrameSlot(undefined, "Zhang Fei slays Deng Mao").caption
    ).toBe("Zhang Fei slays Deng Mao");

    const frames = [{ url: "", caption: "Zhang Fei slays Deng Mao" }];
    expect(readerNarrativeFrames(frames)[0]?.caption).toBe(
      "Zhang Fei slays Deng Mao"
    );
  });

  it("Case 2: re-project preserves Human Frame Narrative", () => {
    const existing = {
      url: "https://res.cloudinary.com/x/kept.png",
      caption: "Human edited caption",
    };
    const next = projectFrameSlot(existing, "Discovery would overwrite this");
    expect(next.caption).toBe("Human edited caption");
    expect(next.url).toBe(existing.url);
  });

  it("Case 3: 0 Frame / empty caption is not reading-complete", () => {
    expect(isReadingNarrativelyComplete([])).toBe(false);
    expect(isReadingNarrativelyComplete(null)).toBe(false);
    expect(
      isReadingNarrativelyComplete([{ url: "", caption: "" }])
    ).toBe(false);
  });

  it("Case 4: Story → N Frames keeps sequence", () => {
    const parsed = parseStoryImagesV2([
      { url: "", caption: "Beat one" },
      { url: "", caption: "Beat two" },
      { url: "", caption: "Beat three" },
    ]);
    expect(parsed).toHaveLength(3);
    expect(readerNarrativeFrames(parsed)).toHaveLength(3);
    expect(isReadingNarrativelyComplete(parsed)).toBe(true);
  });

  it("Case 5: production Discovery does not pass Work Canon", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app/works/[workId]/discovery/page.tsx"),
      "utf8"
    );
    expect(page).not.toContain("requiredUnitAuthority");
    expect(page).not.toContain("workCanon");
  });

  it("Propose treats Scene.summary as Frame Narrative draft", () => {
    const propose = readFileSync(
      path.join(process.cwd(), "lib/discovery/propose-service.ts"),
      "utf8"
    );
    expect(propose).toContain("Frame Narrative draft");
    expect(propose).toContain("one Scene per Reader step");
    expect(propose).not.toContain("scene 1-4");
    expect(propose).not.toContain("They are NOT Reading Frame Narrative");
  });
});
