/**
 * IMPLEMENT-RIE-001 — Candidate-level Information Equivalence on Accept.
 *
 * Validator evidence for B_KEEP / B_LOSS / compression / trap remains in
 * __tests__/spikes/rie-002.test.ts. This file proves production Accept
 * cannot proceed on IE FAIL / missing claims, and cannot bypass Granularity.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  INFORMATION_EQUIVALENCE_BLOCKED,
  RIE_001_CLAIMED_REQUIRED_UNITS,
  evaluateInformationEquivalence,
  type ClaimedRequiredUnit,
} from "@/lib/discovery/information-equivalence";
import {
  GRANULARITY_GATE_ACCEPT_BLOCKED,
  GRANULARITY_GATE_CONTEXT_REQUIRED,
  runGranularityGate,
} from "@/lib/discovery/granularity-gate";
import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
import {
  createReviewItems,
  prepareAcceptReview,
  prepareAcceptStoryWithChildScenes,
} from "@/lib/discovery/review-state";
import {
  AUTHORITY_BIND_INCOMPLETE,
  authorityForSingleStory,
  workCanonFromRequiredClaims,
  type RequiredUnitAuthorityContext,
} from "@/lib/discovery/required-unit-authority";
import type { NarrativeInputBundle } from "@/lib/discovery/types";
import { MINIMAL_RENDERER_EXPRESSION } from "@/lib/discovery/visual-contract";
import { FIXTURE_A } from "../../scripts/granularity-gate-spike/fixtures";
import type { GranularityInput } from "../../scripts/granularity-gate-spike/types";
import {
  GRANULARITY_INPUTS,
  compressionCaptionsOmitOptionalDetail,
  trapCaptionHasAllEntities,
} from "../../scripts/rie-002-spike/fixtures";

function authorityForClaims(
  storyId: string,
  claims: ClaimedRequiredUnit[]
): RequiredUnitAuthorityContext {
  return authorityForSingleStory(storyId, claims);
}

const RIE_CLAIMS = RIE_001_CLAIMED_REQUIRED_UNITS;
const TRAP_CLAIMS = RIE_001_CLAIMED_REQUIRED_UNITS.filter((u) =>
  [
    "U-RESCUE",
    "U-SCORN",
    "U-ATTEMPT",
    "U-PREVENT",
    "U-ATTEMPT-PREVENTED",
  ].includes(u.unitId)
);
const EARLY_CLAIMS = RIE_001_CLAIMED_REQUIRED_UNITS.filter((u) =>
  ["U-REBELLION", "U-NOTICE", "U-MEET-OATH", "U-ARMS", "U-DAXING"].includes(
    u.unitId
  )
);

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

function acceptStory(
  input: GranularityInput,
  authority?: RequiredUnitAuthorityContext
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
      { narrative: narrativeFromSource(input.sourceText) },
      authority
    ),
  };
}

describe("IMPLEMENT-RIE-001 production Accept boundary", () => {
  it("1. IE PASS → Story Accept allowed (B_KEEP)", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.A_KEEP).status).toBe("PASS");
    const { result } = acceptStory(
      GRANULARITY_INPUTS.A_KEEP,
      authorityForClaims("story-arc", RIE_CLAIMS)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected accept");
    expect(result.sceneStagings).toHaveLength(4);
  });

  it("2. IE FAIL → Story Accept blocked (B_LOSS)", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.B_LOSS).status).toBe("PASS");
    const { result } = acceptStory(
      GRANULARITY_INPUTS.B_LOSS,
      authorityForClaims("story-arc", RIE_CLAIMS)
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(INFORMATION_EQUIVALENCE_BLOCKED);
    expect(result.fieldErrors?.some((e) => e.includes("U-ATTEMPT-PREVENTED"))).toBe(
      true
    );
    expect(result.fieldErrors?.some((e) => e.includes("ENTITY_OVERLAP_ONLY"))).toBe(
      true
    );
  });

  it("3. missing Work Canon does not block Story Accept", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.A_KEEP).status).toBe("PASS");
    const { result } = acceptStory(GRANULARITY_INPUTS.A_KEEP);
    expect(result.ok).toBe(true);
  });

  it("3b. Canon without Story Bind → AUTHORITY_BIND_INCOMPLETE", () => {
    const { result } = acceptStory(GRANULARITY_INPUTS.A_KEEP, {
      workCanon: workCanonFromRequiredClaims(RIE_CLAIMS),
      storyBinds: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(AUTHORITY_BIND_INCOMPLETE);
  });

  it("3c. Propose-like claims are not an Accept field — missing Canon still allows Accept", () => {
    const { result } = acceptStory(GRANULARITY_INPUTS.A_KEEP);
    expect(result.ok).toBe(true);
  });

  it("4. Granularity FAIL → IE does not bypass Granularity", () => {
    expect(runGranularityGate(FIXTURE_A.input).status).toBe("FAIL");
    const { result } = acceptStory(
      FIXTURE_A.input,
      authorityForClaims(FIXTURE_A.input.stories[0]!.id, RIE_CLAIMS)
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(GRANULARITY_GATE_ACCEPT_BLOCKED);
  });

  it("5. Granularity PASS + IE FAIL → blocked", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.B_LOSS).status).toBe("PASS");
    const { result } = acceptStory(
      GRANULARITY_INPUTS.B_LOSS,
      authorityForClaims("story-arc", RIE_CLAIMS)
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(INFORMATION_EQUIVALENCE_BLOCKED);
  });

  it("6. B_KEEP → IE PASS on captions", () => {
    const frames = GRANULARITY_INPUTS.A_KEEP.frames.map((f) => ({
      id: f.id,
      caption: f.caption,
    }));
    const ie = evaluateInformationEquivalence({
      frames,
      claimedRequiredUnits: RIE_001_CLAIMED_REQUIRED_UNITS,
    });
    expect(ie.status).toBe("PASS");
    expect(
      ie.units.find((u) => u.unitId === "U-ATTEMPT-PREVENTED")?.status
    ).toBe("PRESENT");
  });

  it("7. B_LOSS → IE FAIL on compound unit", () => {
    const frames = GRANULARITY_INPUTS.B_LOSS.frames.map((f) => ({
      id: f.id,
      caption: f.caption,
    }));
    const ie = evaluateInformationEquivalence({
      frames,
      claimedRequiredUnits: RIE_001_CLAIMED_REQUIRED_UNITS,
    });
    expect(ie.status).toBe("FAIL");
    const compound = ie.units.find((u) => u.unitId === "U-ATTEMPT-PREVENTED");
    expect(compound?.status).toBe("LOST");
    expect(compound?.reason).toBe("ENTITY_OVERLAP_ONLY");
  });

  it("8. Reasonable compression → IE PASS", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.C_COMPRESSION).status).toBe(
      "PASS"
    );
    expect(compressionCaptionsOmitOptionalDetail()).toBe(true);
    const { result } = acceptStory(
      GRANULARITY_INPUTS.C_COMPRESSION,
      authorityForClaims("story-compressed", RIE_CLAIMS)
    );
    expect(result.ok).toBe(true);
  });

  it("9. Entity overlap only → IE FAIL ENTITY_OVERLAP_ONLY", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.D_TRAP).status).toBe("PASS");
    expect(trapCaptionHasAllEntities()).toBe(true);
    const { result } = acceptStory(
      GRANULARITY_INPUTS.D_TRAP,
      authorityForClaims("story-trap", TRAP_CLAIMS)
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe(INFORMATION_EQUIVALENCE_BLOCKED);
    expect(result.fieldErrors?.some((e) => e.includes("ENTITY_OVERLAP_ONLY"))).toBe(
      true
    );
  });

  it("10. Character Accept is unaffected by IE FAIL topology", () => {
    const items = createReviewItems([
      ...candidatesFromInput(GRANULARITY_INPUTS.B_LOSS),
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
    const result = prepareAcceptReview(items, character.reviewId);
    expect(result.ok).toBe(true);
  });

  it("11. Location Accept is unaffected by IE FAIL topology", () => {
    const items = createReviewItems([
      ...candidatesFromInput(GRANULARITY_INPUTS.B_LOSS),
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
    expect(result.kind).toBe("entity_prefill");
  });

  it("12. no ungated Story/Frame Accept path", () => {
    const items = createReviewItems(
      candidatesFromInput(GRANULARITY_INPUTS.A_KEEP)
    );
    const story = items.find((item) => item.candidate.candidateType === "story");
    const scene = items.find((item) => item.candidate.candidateType === "scene");
    if (!story || !scene) throw new Error("expected story and scene");

    const missingNarrative = prepareAcceptReview(items, story.reviewId);
    expect(missingNarrative.ok).toBe(false);
    if (missingNarrative.ok) throw new Error("expected block");
    expect(missingNarrative.code).toBe(GRANULARITY_GATE_CONTEXT_REQUIRED);

    const missingClaims = prepareAcceptReview(
      items,
      story.reviewId,
      [],
      { narrative: narrativeFromSource(GRANULARITY_INPUTS.A_KEEP.sourceText) }
    );
    expect(missingClaims.ok).toBe(true);

    const sceneMissingNarrative = prepareAcceptReview(items, scene.reviewId);
    expect(sceneMissingNarrative.ok).toBe(false);
    if (sceneMissingNarrative.ok) throw new Error("expected block");
    expect(sceneMissingNarrative.code).toBe(GRANULARITY_GATE_CONTEXT_REQUIRED);

    const cascadeMissing = prepareAcceptStoryWithChildScenes(
      items,
      story.reviewId
    );
    expect(cascadeMissing.ok).toBe(false);
    if (cascadeMissing.ok) throw new Error("expected block");
    expect(cascadeMissing.code).toBe(GRANULARITY_GATE_CONTEXT_REQUIRED);
  });

  it("Story.summary-only information cannot satisfy IE", () => {
    const storySummary =
      GRANULARITY_INPUTS.B_LOSS.stories[0]?.summary ?? "";
    expect(storySummary.toLowerCase()).toContain("attempted to kill");
    expect(storySummary.toLowerCase()).toContain("prevented");

    const frames = GRANULARITY_INPUTS.B_LOSS.frames.map((f) => ({
      id: f.id,
      caption: f.caption,
    }));
    const hay = frames.map((f) => f.caption).join("\n").toLowerCase();
    expect(hay).not.toContain("attempted to kill");
    expect(hay).not.toContain("tries to kill");

    const ie = evaluateInformationEquivalence({
      frames,
      claimedRequiredUnits: RIE_001_CLAIMED_REQUIRED_UNITS,
    });
    expect(ie.status).toBe("FAIL");
    expect(
      ie.units.find((u) => u.unitId === "U-ATTEMPT-PREVENTED")?.status
    ).toBe("LOST");
  });

  it("candidate-level: intact Story is not blocked by another Story's captions", () => {
    const early = GRANULARITY_INPUTS.C_COMPRESSION;
    const trap = GRANULARITY_INPUTS.D_TRAP;
    const mixed: GranularityInput = {
      sourceText: `${early.sourceText}\n${trap.sourceText}`,
      stories: [...early.stories, ...trap.stories],
      frames: [...early.frames, ...trap.frames],
    };
    const items = createReviewItems(candidatesFromInput(mixed));
    const earlyStory = items.find(
      (item) => item.candidate.candidateId === "story-compressed"
    );
    const trapStory = items.find(
      (item) => item.candidate.candidateId === "story-trap"
    );
    if (!earlyStory || !trapStory) throw new Error("expected mixed stories");

    const mixedAuthority: RequiredUnitAuthorityContext = {
      workCanon: workCanonFromRequiredClaims([...EARLY_CLAIMS, ...TRAP_CLAIMS]),
      storyBinds: [
        {
          storyCandidateId: "story-compressed",
          unitIds: EARLY_CLAIMS.map((c) => c.unitId),
        },
        {
          storyCandidateId: "story-trap",
          unitIds: TRAP_CLAIMS.map((c) => c.unitId),
        },
      ],
    };

    const earlyAccept = prepareAcceptStoryWithChildScenes(
      items,
      earlyStory.reviewId,
      [],
      { characters: [], locations: [] },
      { narrative: narrativeFromSource(mixed.sourceText) },
      mixedAuthority
    );
    expect(earlyAccept.ok).toBe(true);

    const trapAccept = prepareAcceptStoryWithChildScenes(
      items,
      trapStory.reviewId,
      [],
      { characters: [], locations: [] },
      { narrative: narrativeFromSource(mixed.sourceText) },
      mixedAuthority
    );
    expect(trapAccept.ok).toBe(false);
    if (trapAccept.ok) throw new Error("expected trap block");
    expect(trapAccept.code).toBe(INFORMATION_EQUIVALENCE_BLOCKED);
  });
});

describe("IMPLEMENT-RIE-001 runtime path evidence", () => {
  it("Propose-shaped Candidate → Granularity → IE → Accept (PASS and FAIL)", () => {
    const passGate = runGranularityGate(GRANULARITY_INPUTS.A_KEEP);
    const failGate = runGranularityGate(GRANULARITY_INPUTS.B_LOSS);
    const passAccept = acceptStory(
      GRANULARITY_INPUTS.A_KEEP,
      authorityForClaims("story-arc", RIE_CLAIMS)
    ).result;
    const failAccept = acceptStory(
      GRANULARITY_INPUTS.B_LOSS,
      authorityForClaims("story-arc", RIE_CLAIMS)
    ).result;

    expect(passGate.status).toBe("PASS");
    expect(failGate.status).toBe("PASS");
    expect(passAccept.ok).toBe(true);
    expect(failAccept.ok).toBe(false);
    if (failAccept.ok) throw new Error("expected FAIL accept block");
    expect(failAccept.code).toBe(INFORMATION_EQUIVALENCE_BLOCKED);
  });

  it("production hook and review-state have no Story/Frame bypass", () => {
    const reviewState = readFileSync(
      path.join(process.cwd(), "lib/discovery/review-state.ts"),
      "utf8"
    );
    expect(reviewState).toContain("informationEquivalenceBlockForItem");
    expect(reviewState).toContain("granularityAcceptBlock");
    expect(reviewState).not.toContain("42c22be9");

    const hook = readFileSync(
      path.join(process.cwd(), "hooks/useDiscoverySession.ts"),
      "utf8"
    );
    expect(hook).toMatch(/prepareAcceptStoryWithChildScenes\(/);
    expect(hook).toMatch(/granularity,\s*authority/);
    expect(hook).toContain("requiredUnitAuthority");
    expect(hook).not.toContain("claimedRequiredUnits");
    expect(hook).not.toContain("42c22be9");

    const page = readFileSync(
      path.join(process.cwd(), "app/works/[workId]/discovery/page.tsx"),
      "utf8"
    );
    expect(page).not.toContain("requiredUnitAuthority");
    expect(page).not.toContain("RIE_001");
    expect(hook).not.toContain("42c22be9");

    const evaluate = readFileSync(
      path.join(process.cwd(), "lib/discovery/information-equivalence/evaluate.ts"),
      "utf8"
    );
    expect(evaluate).not.toMatch(/jaccard|similarity|levenshtein/i);
    expect(evaluate).toContain("Does not read Story.summary");
    expect(evaluate).not.toContain("42c22be9");
  });
});
