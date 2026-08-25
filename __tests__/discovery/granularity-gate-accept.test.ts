/**
 * IMPLEMENT-GRANULARITY-GATE-001 — Propose → Review Accept blocking
 *
 * Gate algorithm evidence remains in __tests__/spikes/granularity-gate-001.test.ts.
 * This file proves FAIL cannot Accept, PASS can continue Review, and unlabeled
 * paraphrase is not a deterministic error.
 */

import { describe, expect, it } from "vitest";

import {
  GRANULARITY_GATE_ACCEPT_BLOCKED,
  GRANULARITY_GATE_CONTEXT_REQUIRED,
  GRANULARITY_GATE_REPROPOSE_ACTION,
  invariantSet,
  runGranularityGate,
} from "@/lib/discovery/granularity-gate";
import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
import {
  createReviewItems,
  prepareAcceptReview,
  prepareAcceptStoryWithChildScenes,
} from "@/lib/discovery/review-state";
import { authorityForSingleStory } from "@/lib/discovery/required-unit-authority";
import type { NarrativeInputBundle } from "@/lib/discovery/types";
import { MINIMAL_RENDERER_EXPRESSION } from "@/lib/discovery/visual-contract";
import {
  FIXTURE_A,
  FIXTURE_B,
  FIXTURE_C,
  FIXTURE_D,
} from "../../scripts/granularity-gate-spike/fixtures";
import type { GranularityInput } from "../../scripts/granularity-gate-spike/types";

function narrativeFromSource(sourceText: string): NarrativeInputBundle {
  return {
    excerpts: [{ text: sourceText, orderIndex: 0 }],
    operatorSummary: null,
    inputMode: "excerpt_bundle",
  };
}

function candidatesFromInput(input: GranularityInput): DiscoveryCandidate[] {
  const workId = "work-test";
  const stories: DiscoveryCandidate[] = input.stories.map((story) => ({
    candidateId: story.id,
    candidateType: "story",
    workId,
    displayName: story.title,
    summary: story.summary,
    fields: { title: story.title, summary: story.summary },
  }));
  const scenes: DiscoveryCandidate[] = input.frames.map((frame, index) => ({
    candidateId: frame.id,
    candidateType: "scene",
    workId,
    displayName: frame.title,
    summary: frame.caption,
    fields: {
      parentStoryCandidateId: frame.parentStoryId,
      chapter_number: index + 1,
      title: frame.title,
      summary: frame.caption,
      rendererExpression: MINIMAL_RENDERER_EXPRESSION,
    },
  }));
  return [...stories, ...scenes];
}

function captionPresenceAuthority(storyId: string, phrases: string[]) {
  return authorityForSingleStory(storyId, [
    {
      unitId: "U-FIXTURE",
      kind: "event",
      expected: "fixture caption presence",
      relationEvidence: [phrases],
    },
  ]);
}

function acceptFirstStory(
  input: GranularityInput,
  labels?: GranularityInput["labels"],
  phrases: string[] = ["Hand of the King"]
) {
  const items = createReviewItems(candidatesFromInput(input));
  const story = items.find((item) => item.candidate.candidateType === "story");
  if (!story) throw new Error("expected a story candidate");
  return {
    items,
    story,
    result: prepareAcceptStoryWithChildScenes(
      items,
      story.reviewId,
      [],
      { characters: [], locations: [] },
      { narrative: narrativeFromSource(input.sourceText), labels },
      captionPresenceAuthority(story.candidate.candidateId, phrases)
    ),
  };
}

describe("IMPLEMENT-GRANULARITY-GATE-001 production Accept boundary", () => {
  it("FAIL action is RE-PROPOSE (existing Propose re-run), not repair", () => {
    expect(GRANULARITY_GATE_REPROPOSE_ACTION).toBe("RE-PROPOSE");
  });

  it("Case A — 5 Stories × 1 Frame → Gate FAIL → Accept blocked", () => {
    const gate = runGranularityGate(FIXTURE_A.input);
    expect(gate.status).toBe("FAIL");
    expect(invariantSet(gate).has("G1")).toBe(true);
    expect(invariantSet(gate).has("G4")).toBe(true);

    const { result } = acceptFirstStory(FIXTURE_A.input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(GRANULARITY_GATE_ACCEPT_BLOCKED);
  });

  it("Case B — 1 Story × N Frames → Gate PASS → Accept may continue", () => {
    const gate = runGranularityGate(FIXTURE_B.input);
    expect(gate.status).toBe("PASS");

    const { result } = acceptFirstStory(FIXTURE_B.input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected accept");
    expect(result.sceneStagings).toHaveLength(4);
  });

  it("Case C — 1 Story × 1 Frame → Gate PASS → Accept may continue", () => {
    const gate = runGranularityGate(FIXTURE_C.input);
    expect(gate.status).toBe("PASS");

    const { result } = acceptFirstStory(FIXTURE_C.input, undefined, ["Jon Arryn"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected accept");
    expect(result.sceneStagings).toHaveLength(1);
  });

  it("Case D — annotated plot turn missing from caption → G3 FAIL → Accept blocked", () => {
    const gate = runGranularityGate(FIXTURE_D.input);
    expect(gate.status).toBe("FAIL");
    expect(invariantSet(gate).has("G3")).toBe(true);

    const { result } = acceptFirstStory(
      FIXTURE_D.input,
      FIXTURE_D.input.labels
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(GRANULARITY_GATE_ACCEPT_BLOCKED);
    expect(result.fieldErrors?.some((e) => e.startsWith("G3:"))).toBe(true);
  });

  it("Case E — semantic paraphrase without annotation is not a deterministic error", () => {
    const input: GranularityInput = {
      sourceText:
        "After the rescue, the youngest brother almost struck the commander.",
      stories: [
        {
          id: "story-paraphrase",
          title: "Contempt After Rescue",
          summary:
            "Zhang Fei nearly kills Dong Zhuo until Liu Bei and Guan Yu restrain him.",
        },
      ],
      frames: [
        {
          id: "frame-paraphrase",
          parentStoryId: "story-paraphrase",
          title: "Held Back",
          caption:
            "The youngest sworn brother almost struck the rescued commander, but his siblings held him back.",
        },
      ],
    };

    const gate = runGranularityGate(input);
    const g3Error = gate.violations.some(
      (v) => v.invariant === "G3" && v.severity === "error"
    );
    expect(g3Error).toBe(false);
    expect(gate.status).toBe("PASS");

    const { result } = acceptFirstStory(input, undefined, ["held him back"]);
    expect(result.ok).toBe(true);
  });

  it("character Accept is not blocked by Story/Frame topology FAIL", () => {
    const items = createReviewItems([
      ...candidatesFromInput(FIXTURE_A.input),
      {
        candidateId: "char-1",
        candidateType: "character",
        workId: "work-test",
        displayName: "Liu Bei",
        summary: "Sworn brother",
        fields: { name: "Liu Bei", house: "Han", description: "Leader" },
      },
    ]);
    const character = items.find(
      (item) => item.candidate.candidateType === "character"
    );
    if (!character) throw new Error("expected character");
    const result = prepareAcceptReview(
      items,
      character.reviewId,
      [],
      { narrative: narrativeFromSource(FIXTURE_A.input.sourceText) }
    );
    expect(result.ok).toBe(true);
  });

  it("location Accept is not blocked by Story/Frame topology FAIL", () => {
    const items = createReviewItems([
      ...candidatesFromInput(FIXTURE_A.input),
      {
        candidateId: "loc-1",
        candidateType: "location",
        workId: "work-test",
        displayName: "Zhuozhou",
        summary: "Commandery",
        fields: { name: "Zhuozhou", region: "Youzhou", description: "Town" },
      },
    ]);
    const location = items.find(
      (item) => item.candidate.candidateType === "location"
    );
    if (!location) throw new Error("expected location");
    const result = prepareAcceptReview(items, location.reviewId);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected location accept");
    expect(result.kind).toBe("location_staging");
  });

  it("character Accept without narrative remains ungated", () => {
    const items = createReviewItems([
      {
        candidateId: "char-1",
        candidateType: "character",
        workId: "work-test",
        displayName: "Liu Bei",
        summary: "Sworn brother",
        fields: { name: "Liu Bei", house: "Han" },
      },
    ]);
    const result = prepareAcceptReview(items, items[0]!.reviewId);
    expect(result.ok).toBe(true);
  });
});

describe("CLOSE-GRANULARITY-GATE-001 — no ungated Story/Frame Accept", () => {
  it("Case A — narrative present + 1 Story × N Frames → Gate PASS → Accept succeeds", () => {
    const { result } = acceptFirstStory(FIXTURE_B.input);
    expect(result.ok).toBe(true);
  });

  it("Case B — narrative present + 5×1 → GRANULARITY_GATE_BLOCKED", () => {
    const { result } = acceptFirstStory(FIXTURE_A.input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(GRANULARITY_GATE_ACCEPT_BLOCKED);
  });

  it("Case C — missing narrative blocks Story Accept", () => {
    const items = createReviewItems(candidatesFromInput(FIXTURE_C.input));
    const story = items.find((item) => item.candidate.candidateType === "story");
    if (!story) throw new Error("expected story");
    const result = prepareAcceptReview(items, story.reviewId);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(GRANULARITY_GATE_CONTEXT_REQUIRED);
  });

  it("Case C — missing narrative blocks Scene Accept", () => {
    const items = createReviewItems(candidatesFromInput(FIXTURE_C.input));
    const scene = items.find((item) => item.candidate.candidateType === "scene");
    if (!scene) throw new Error("expected scene");
    const result = prepareAcceptReview(items, scene.reviewId);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(GRANULARITY_GATE_CONTEXT_REQUIRED);
  });

  it("Case C — missing narrative blocks Story cascade Accept", () => {
    const items = createReviewItems(candidatesFromInput(FIXTURE_C.input));
    const story = items.find((item) => item.candidate.candidateType === "story");
    if (!story) throw new Error("expected story");
    const result = prepareAcceptStoryWithChildScenes(items, story.reviewId);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(GRANULARITY_GATE_CONTEXT_REQUIRED);
  });

  it("production Accept path carries session.narrative into the Gate", () => {
    const narrative = narrativeFromSource(FIXTURE_B.input.sourceText);
    const items = createReviewItems(candidatesFromInput(FIXTURE_B.input));
    const story = items.find((item) => item.candidate.candidateType === "story");
    if (!story) throw new Error("expected story");
    const gate = runGranularityGate(
      {
        ...FIXTURE_B.input,
        sourceText: narrative.excerpts[0]!.text,
      }
    );
    expect(gate.status).toBe("PASS");
    const result = prepareAcceptStoryWithChildScenes(
      items,
      story.reviewId,
      [],
      { characters: [], locations: [] },
      { narrative },
      captionPresenceAuthority(story.candidate.candidateId, ["Hand of the King"])
    );
    expect(result.ok).toBe(true);
  });
});
