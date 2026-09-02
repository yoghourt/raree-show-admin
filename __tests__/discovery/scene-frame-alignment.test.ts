import { describe, expect, it } from "vitest";

import { estimateBeatsInCaption } from "@/lib/discovery/granularity-gate/analyze";
import { runGranularityGate } from "@/lib/discovery/granularity-gate/gate";
import { draftSceneBeatsFromSummary } from "@/lib/discovery/split-scene-beats";
import { authorExpressionsForSplitBeats } from "@/lib/discovery/split-scene-expressions";
import { replaceSceneWithSplitBeats } from "@/lib/discovery/review-state";
import type { DiscoveryReviewItem } from "@/lib/discovery/review-types";
import type { SceneCandidateFields } from "@/lib/discovery/propose-types";
import { isStubRendererExpression } from "@/lib/discovery/visual-contract";

describe("estimateBeatsInCaption / G5", () => {
  it("flags multi-sentence causal captions as multi-beat", () => {
    const caption =
      "Decades of imperial corruption bring the dynasty to ruin. Zhang Jue launches the Yellow Turban Rebellion. Liu Yan issues an urgent call for volunteer recruits across towns.";
    expect(estimateBeatsInCaption(caption)).toBeGreaterThanOrEqual(3);

    const result = runGranularityGate({
      sourceText: "Chapter 1\n\nProse.",
      stories: [
        {
          id: "story_1",
          title: "Rise",
          summary: "An arc about the rebellion.",
        },
      ],
      frames: [
        {
          id: "scene_1",
          parentStoryId: "story_1",
          title: "Opening",
          caption,
        },
      ],
    });
    expect(result.status).toBe("FAIL");
    expect(
      result.violations.some(
        (v) => v.invariant === "G5" && v.severity === "error"
      )
    ).toBe(true);
  });

  it("passes a single-beat caption", () => {
    const caption =
      "Liu Yan posts blank recruitment boards and townsfolk gather to volunteer.";
    expect(estimateBeatsInCaption(caption)).toBe(1);
    const result = runGranularityGate({
      sourceText: "Chapter 1\n\nProse.",
      stories: [
        { id: "story_1", title: "Rise", summary: "Recruitment call." },
      ],
      frames: [
        {
          id: "scene_1",
          parentStoryId: "story_1",
          title: "Recruit",
          caption,
        },
      ],
    });
    expect(
      result.violations.some((v) => v.invariant === "G5" && v.severity === "error")
    ).toBe(false);
  });
});

describe("draftSceneBeatsFromSummary", () => {
  it("splits multi-sentence summaries into editable beats", () => {
    const drafts = draftSceneBeatsFromSummary(
      "Zhang Jue rises in yellow cloth. Officers call for recruits. Heroes answer the boards."
    );
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    expect(drafts.every((d) => d.summary.trim().length > 0)).toBe(true);
  });
});

describe("replaceSceneWithSplitBeats", () => {
  it("replaces one scene with N edited_pending_accept scenes", () => {
    const fields: SceneCandidateFields = {
      parentStoryCandidateId: "story_cand",
      chapter_number: 1,
      title: "Opening",
      summary: "One long beat",
      rendererExpression: {
        environment: "town",
        characters: [],
        action: "gather",
        composition: "wide",
      },
    };
    const items: DiscoveryReviewItem[] = [
      {
        reviewId: "rev_scene",
        status: "pending",
        candidate: {
          candidateId: "cand_scene",
          workId: "work-1",
          candidateType: "scene",
          displayName: "Opening",
          summary: "One long beat",
          fields,
        },
      },
    ];
    const next = replaceSceneWithSplitBeats(items, "rev_scene", [
      {
        title: "Rise",
        summary: "Zhang Jue rises.",
        rendererExpression: {
          environment: "village road",
          characters: [{ role: "Zhang Jue", visual: "yellow headcloth" }],
          action: "rebel leader raises banner",
          composition: "medium wide shot, faces secondary",
        },
      },
      {
        title: "Recruit",
        summary: "Liu Yan calls recruits.",
        rendererExpression: {
          environment: "county gate",
          characters: [{ role: "Liu Yan", visual: "official robes" }],
          action: "blank recruitment board centered",
          composition: "wide shot, board in foreground",
        },
      },
    ]);
    const active = next.filter((i) => i.status !== "discarded");
    expect(active).toHaveLength(2);
    expect(active.every((i) => i.status === "edited_pending_accept")).toBe(
      true
    );
    expect(next.some((i) => i.reviewId === "rev_scene" && i.status === "discarded")).toBe(
      true
    );
    const riseFields = active[0]!.editedFields as SceneCandidateFields;
    expect(riseFields.rendererExpression.action).toMatch(/banner/i);
    expect(riseFields.rendererExpression.characters[0]?.visual).toMatch(
      /yellow/i
    );
  });
});

describe("authorExpressionsForSplitBeats (mock)", () => {
  it("returns non-stub Expression per beat", async () => {
    const result = await authorExpressionsForSplitBeats({
      workId: "work-1",
      workTitle: "Romance of the Three Kingdoms",
      narrative: {
        excerpts: [
          {
            text: "Yellow Turbans rise. Officers call recruits.",
            orderIndex: 0,
          },
        ],
        inputMode: "excerpt_bundle",
        operatorSummary: null,
      },
      beats: [
        { title: "Rise", summary: "Zhang Jue rises in yellow cloth." },
        { title: "Recruit", summary: "Liu Yan posts recruitment boards." },
      ],
    });
    expect(result.beats).toHaveLength(2);
    expect(
      result.beats.every((b) => !isStubRendererExpression(b.rendererExpression))
    ).toBe(true);
    expect(result.beats[0]!.rendererExpression.action).not.toEqual(
      result.beats[0]!.summary
    );
    expect(result.beats[1]!.rendererExpression.action).not.toEqual(
      result.beats[1]!.summary
    );
  });
});
