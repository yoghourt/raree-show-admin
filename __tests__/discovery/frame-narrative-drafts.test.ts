import { describe, expect, it } from "vitest";

import {
  canDraftScenesFromSourceHeadings,
  clausesFromStorySummary,
  expectedSceneCount,
  requiredSceneStepsFromStories,
  resolveParentStoryCandidateId,
  sceneCandidatesFromRequiredSteps,
} from "@/lib/discovery/frame-narrative-drafts";
import { headingBlocksFromSource } from "@/lib/discovery/granularity-gate/text";
import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
import { SOURCE_EXCERPT } from "../../scripts/discovery-scene-spike/source";

const story: DiscoveryCandidate = {
  candidateId: "story-1",
  candidateType: "story",
  workId: "work-1",
  displayName: "The Peach Garden Oath and the Rise of Volunteers",
  summary:
    "Liu Bei, Guan Yu, and Zhang Fei unite in a sworn brotherhood during the Yellow Turban Rebellion, securing merchant patronage and forging iconic weapons to launch their military campaign with a decisive victory at Daxing Mountain before encountering the arrogance of Dong Zhuo.",
  fields: {
    title: "The Peach Garden Oath and the Rise of Volunteers",
    summary:
      "Liu Bei, Guan Yu, and Zhang Fei unite in a sworn brotherhood during the Yellow Turban Rebellion, securing merchant patronage and forging iconic weapons to launch their military campaign with a decisive victory at Daxing Mountain before encountering the arrogance of Dong Zhuo.",
  },
};

describe("headingBlocksFromSource", () => {
  it("unpacks numbered Source outline bodies", () => {
    const blocks = headingBlocksFromSource(SOURCE_EXCERPT);
    expect(blocks.map((b) => b.title)).toEqual([
      "黄巾起义与招兵榜文",
      "涿县偶遇与桃园结义",
      "中山豪商资助与神兵初成",
      "大兴山首战告捷",
      "救援董卓与遭遇冷落",
    ]);
    expect(blocks[1]!.body).toContain("桃园");
    expect(blocks[3]!.body).toContain("程远志");
    expect(blocks[4]!.body).toContain("提刀欲入帐斩杀董卓");
  });
});

describe("requiredSceneStepsFromStories", () => {
  it("uses Source headings when a single Story would otherwise compress the outline", () => {
    const bundles = requiredSceneStepsFromStories([story], SOURCE_EXCERPT);
    expect(expectedSceneCount(bundles)).toBe(5);
    expect(bundles[0]!.steps[3]).toBe("大兴山首战告捷");
  });

  it("splits a packed English Story summary when Source has no headings", () => {
    const clauses = clausesFromStorySummary(story.summary);
    expect(clauses.length).toBeGreaterThanOrEqual(2);
    const bundles = requiredSceneStepsFromStories([story], "prose without numbers");
    expect(expectedSceneCount(bundles)).toBeGreaterThanOrEqual(2);
  });
});

describe("sceneCandidatesFromRequiredSteps", () => {
  it("drafts one Scene per heading using Source paragraphs, not the Story one-liner", () => {
    const bundles = requiredSceneStepsFromStories([story], SOURCE_EXCERPT);
    const scenes = sceneCandidatesFromRequiredSteps({
      workId: "work-1",
      bundles,
      sourceText: SOURCE_EXCERPT,
    });
    expect(canDraftScenesFromSourceHeadings([story], SOURCE_EXCERPT)).toBe(true);
    expect(scenes).toHaveLength(5);
    expect(scenes.map((s) => s.displayName)).toContain("大兴山首战告捷");
    const daxing = scenes.find((s) => s.displayName === "大兴山首战告捷");
    expect(daxing?.summary).toContain("张飞挺枪而出");
    expect(daxing?.summary).not.toMatch(/Peach Garden/i);
    expect(
      scenes.every(
        (s) =>
          "parentStoryCandidateId" in s.fields &&
          s.fields.parentStoryCandidateId === "story-1"
      )
    ).toBe(true);
  });
});

describe("resolveParentStoryCandidateId", () => {
  it("keeps a Scene when the model invents a parent id for a single Story", () => {
    expect(
      resolveParentStoryCandidateId("invented-id", [story], "Oath", "summary")
    ).toBe("story-1");
  });
});
