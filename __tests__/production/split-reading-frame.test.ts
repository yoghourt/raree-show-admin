import { describe, expect, it } from "vitest";

import {
  draftProductionBeatsFromCaption,
  reindexContextsAfterSplit,
  reindexProvenanceAfterSplit,
  shiftIndexAfterSplit,
  spliceFramesAtIndex,
} from "@/lib/production/split-reading-frame";
import type { FrameProvenanceEntry } from "@/lib/rollout/scenes-server";
import type { SceneContextRecord } from "@/lib/scene-context/types";

const HEAVY_CAPTION =
  "When Yuan Shao boldly opposes him and draws his sword in defiance, Dong Zhuo threatens him, prompting Yuan Shao to storm out of the palace to rally eastern resistance while Dong Zhuo elevates Emperor Xian and seizes absolute power.";

describe("draftProductionBeatsFromCaption", () => {
  it("splits a one-sentence causal chain on prompting/while", () => {
    const drafts = draftProductionBeatsFromCaption(HEAVY_CAPTION);
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    expect(drafts.some((d) => /draws his sword|threatens/i.test(d.summary))).toBe(
      true
    );
    expect(drafts.some((d) => /Emperor Xian|seizes/i.test(d.summary))).toBe(
      true
    );
  });
});

describe("spliceFramesAtIndex", () => {
  it("replaces one frame with N caption-only frames", () => {
    const next = spliceFramesAtIndex(
      [
        { url: "https://old/a.jpg", caption: "A" },
        { url: "", caption: HEAVY_CAPTION },
        { url: "", caption: "C" },
      ],
      1,
      [{ summary: "Yuan Shao draws." }, { summary: "Dong Zhuo seizes power." }]
    );
    expect(next).toHaveLength(4);
    expect(next[1]?.url).toBe("");
    expect(next[1]?.caption).toMatch(/draws/);
    expect(next[2]?.caption).toMatch(/seizes/);
    expect(next[3]?.caption).toBe("C");
  });
});

describe("reindex after split", () => {
  it("drops the split index and shifts later frames", () => {
    expect(shiftIndexAfterSplit(0, 1, 3)).toBe(0);
    expect(shiftIndexAfterSplit(1, 1, 3)).toBeNull();
    expect(shiftIndexAfterSplit(2, 1, 3)).toBe(4);
  });

  it("reindexes provenance and contexts", () => {
    const provenance: FrameProvenanceEntry[] = [
      { sourceReviewId: "a", frameIndex: 0 },
      { sourceReviewId: "b", frameIndex: 1 },
      { sourceReviewId: "c", frameIndex: 2 },
    ];
    const nextP = reindexProvenanceAfterSplit(provenance, 1, 3);
    expect(nextP.map((e) => e.frameIndex)).toEqual([0, 4]);

    const contexts = [
      { projectsToFrameIndex: 1 },
      { projectsToFrameIndex: 2 },
    ] as SceneContextRecord[];
    const nextC = reindexContextsAfterSplit(contexts, 1, 3);
    expect(nextC.map((c) => c.projectsToFrameIndex)).toEqual([4]);
  });
});
