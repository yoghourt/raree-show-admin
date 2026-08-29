/**
 * Unit tests — Discovery Human Review state machine
 *
 * SPEC-D3-002 D3-RC-REV-* / D3-AC-IMP-REV-07
 */

import { describe, it, expect } from "vitest";

import { normalizeRawCandidate } from "@/lib/discovery/candidate-validate";
import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
import type { NarrativeInputBundle } from "@/lib/discovery/types";
import { authorityForSingleStory, workCanonFromRequiredClaims } from "@/lib/discovery/required-unit-authority";
import {
  createReviewItems,
  discardReviewItem,
  findReviewDuplicateCandidate,
  getActiveReviewItems,
  getSiblingCandidatesForRegen,
  hasPendingReviewItems,
  markReviewAccepted,
  revokeReviewAccept,
  prepareAcceptReview,
  prepareAcceptStoryWithChildScenes,
  replaceReviewCandidate,
  saveReviewEdit,
  getEffectiveDisplayName,
  validateCharacterAcceptFields,
  characterStagingFromAcceptedReviewItems,
  locationStagingFromAcceptedReviewItems,
} from "@/lib/discovery/review-state";

function makeCandidate(
  overrides: Partial<DiscoveryCandidate> = {}
): DiscoveryCandidate {
  return {
    candidateId: "cand-1",
    candidateType: "character",
    workId: "work-1",
    displayName: "Jon Snow",
    summary: "Bastard of Winterfell",
    fields: {
      name: "Jon Snow",
      house: "Stark",
      description: "Lord Commander",
    },
    ...overrides,
  };
}

/** Authoritative narrative for Story/Frame Accept tests (Gate required). */
const REVIEW_NARRATIVE: NarrativeInputBundle = {
  excerpts: [
    {
      text: "A raven lands in the yard. Maester Luwin reads a one-line death notice: Jon Arryn is dead.",
      orderIndex: 0,
    },
  ],
  operatorSummary: null,
  inputMode: "excerpt_bundle",
};

const GRANULARITY = { narrative: REVIEW_NARRATIVE };

const TEST_CLAIM = {
  unitId: "U-TEST",
  kind: "event" as const,
  expected: "caption present",
  relationEvidence: [
    [
      "Arrival",
      "Courtyard",
      "Kept Courtyard",
      "Bastard of Winterfell",
      "Summary",
      "Scene A",
      "Scene B",
    ],
  ],
};

function storyAuthority(storyCandidateId: string) {
  return authorityForSingleStory(storyCandidateId, [TEST_CLAIM]);
}

function courtyardScene(
  parentStoryCandidateId: string,
  overrides: Partial<DiscoveryCandidate> = {}
): DiscoveryCandidate {
  return makeCandidate({
    candidateId: "scene-cand-1",
    candidateType: "scene",
    displayName: "Courtyard",
    fields: {
      parentStoryCandidateId,
      chapter_number: 1,
      title: "Courtyard",
      summary: "Arrival",
      rendererExpression: {
        environment: "winter courtyard",
        characters: [],
        action: "household stands facing gate",
        composition: "wide courtyard view",
      },
    },
    ...overrides,
  });
}

describe("review item lifecycle", () => {
  it("creates pending items from candidates", () => {
    const items = createReviewItems([makeCandidate()]);
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("pending");
  });

  it("discard removes item from active set", () => {
    const items = createReviewItems([makeCandidate()]);
    const reviewId = items[0]!.reviewId;
    const discarded = discardReviewItem(items, reviewId);
    expect(getActiveReviewItems(discarded)).toHaveLength(0);
    expect(discarded[0]?.status).toBe("discarded");
  });

  it("edit moves item to edited_pending_accept", () => {
    const items = createReviewItems([makeCandidate()]);
    const reviewId = items[0]!.reviewId;
    const edited = saveReviewEdit(items, reviewId, {
      editedDisplayName: "Edited Name",
      editedSummary: "Edited summary",
      editedFields: { name: "Edited Name", house: "Stark" },
    });
    expect(edited[0]?.status).toBe("edited_pending_accept");
    expect(hasPendingReviewItems(edited)).toBe(true);
  });

  it("regen replaces candidate and resets to pending", () => {
    const items = createReviewItems([makeCandidate()]);
    const reviewId = items[0]!.reviewId;
    const replaced = replaceReviewCandidate(
      items,
      reviewId,
      makeCandidate({
        candidateId: "cand-2",
        displayName: "Regenerated",
      })
    );
    expect(replaced[0]?.status).toBe("pending");
    expect(replaced[0]?.candidate.candidateId).toBe("cand-2");
  });

  it("accept marks item accepted", () => {
    const items = createReviewItems([makeCandidate()]);
    const reviewId = items[0]!.reviewId;
    const accepted = markReviewAccepted(items, reviewId);
    expect(accepted[0]?.status).toBe("accepted");
    expect(hasPendingReviewItems(accepted)).toBe(false);
  });

  it("revokeReviewAccept returns story/scene item to pending review", () => {
    const story = makeCandidate({
      candidateType: "story",
      fields: { title: "Arc", summary: "Summary" },
    });
    const items = createReviewItems([story]);
    const reviewId = items[0]!.reviewId;
    const accepted = markReviewAccepted(items, reviewId);
    const revoked = revokeReviewAccept(accepted, reviewId);
    expect(revoked[0]?.status).toBe("pending");
    expect(hasPendingReviewItems(revoked)).toBe(true);
  });

  it("edit after accept keeps accepted status and updates effective name", () => {
    const items = createReviewItems([makeCandidate()]);
    const reviewId = items[0]!.reviewId;
    const accepted = markReviewAccepted(items, reviewId);
    const edited = saveReviewEdit(accepted, reviewId, {
      editedDisplayName: "Gared",
      editedSummary: "Night's Watch deserter",
      editedFields: {
        name: "Gared",
        house: "Night's Watch",
        description: "Deserter caught north of the Wall",
      },
    });
    expect(edited[0]?.status).toBe("accepted");
    expect(getEffectiveDisplayName(edited[0]!)).toBe("Gared");
  });
});

describe("Accept handoff guards", () => {
  it("character accept returns character staging for Rollout queue", () => {
    const items = createReviewItems([makeCandidate()]);
    const result = prepareAcceptReview(items, items[0]!.reviewId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("character_staging");
      if (result.kind === "character_staging") {
        expect(result.staging.name).toBe("Jon Snow");
        expect(result.staging.house).toBe("Stark");
        expect(result.staging.sourceReviewId).toBe(items[0]!.reviewId);
      }
    }
  });

  it("folds Character Archive visual cues into character staging description", () => {
    const items = createReviewItems([
      makeCandidate({
        displayName: "Guan Yu",
        fields: {
          name: "Guan Yu",
          house: "Shu",
          description: "Sworn brother of Liu Bei.",
          characterArchive: {
            identityCues: ["red face", "long beard"],
            costumeCues: ["green battle robe"],
            propCues: ["Green Dragon Crescent Blade"],
          },
        },
      }),
    ]);
    const result = prepareAcceptReview(items, items[0]!.reviewId);
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === "character_staging") {
      expect(result.staging.description).toBe("Sworn brother of Liu Bei.");
      expect(result.staging.description).not.toMatch(/\[视觉身份\]/);
      expect(result.staging.description).not.toContain("green battle robe");
      expect(result.staging.visualIdentity).toMatch(/FACE:.*red face/i);
      expect(result.staging.visualIdentity).toContain("green battle robe");
      expect(result.staging.visualIdentity).toContain("Green Dragon Crescent Blade");
    }
  });

  it("rebuilds character staging from already-accepted review items", () => {
    const pending = createReviewItems([
      makeCandidate({
        candidateId: "cand-liu",
        displayName: "Liu Bei",
        fields: { name: "Liu Bei", house: "Shu" },
      }),
    ]);
    const reviewId = pending[0]!.reviewId;
    const staged = characterStagingFromAcceptedReviewItems(
      markReviewAccepted(pending, reviewId)
    );
    expect(staged).toHaveLength(1);
    expect(staged[0]?.name).toBe("Liu Bei");
    expect(staged[0]?.house).toBe("Shu");
  });

  it("location accept returns location staging for Rollout queue", () => {
    const items = createReviewItems([
      makeCandidate({
        candidateId: "loc-1",
        candidateType: "location",
        displayName: "Zhuozhou",
        fields: {
          name: "Zhuozhou",
          region: "Youzhou",
          description: "Commandery town",
        },
      }),
    ]);
    const result = prepareAcceptReview(items, items[0]!.reviewId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("location_staging");
      if (result.kind === "location_staging") {
        expect(result.staging.name).toBe("Zhuozhou");
        expect(result.staging.region).toBe("Youzhou");
        expect(result.staging.sourceReviewId).toBe(items[0]!.reviewId);
      }
    }
  });

  it("rebuilds location staging from already-accepted review items", () => {
    const pending = createReviewItems([
      makeCandidate({
        candidateId: "cand-zhuo",
        candidateType: "location",
        displayName: "Zhuozhou",
        fields: { name: "Zhuozhou", region: "Youzhou" },
      }),
    ]);
    const reviewId = pending[0]!.reviewId;
    const staged = locationStagingFromAcceptedReviewItems(
      markReviewAccepted(pending, reviewId)
    );
    expect(staged).toHaveLength(1);
    expect(staged[0]?.name).toBe("Zhuozhou");
    expect(staged[0]?.region).toBe("Youzhou");
  });

  it("seeds empty scene cast/place from batch character and location names", () => {
    const items = createReviewItems([
      makeCandidate({
        candidateId: "story-cand-1",
        candidateType: "story",
        displayName: "Arc",
        fields: { title: "Arc", summary: "Summary" },
      }),
      makeCandidate({
        candidateId: "scene-empty",
        candidateType: "scene",
        displayName: "Gate",
        fields: {
          parentStoryCandidateId: "story-cand-1",
          chapter_number: 1,
          title: "Liu Bei at Zhuozhou",
          summary: "Arrival at the commandery",
          rendererExpression: {
            environment: "unspecified place",
            characters: [],
            action: "standing",
            composition: "wide view",
          },
        },
      }),
      makeCandidate({
        candidateId: "char-liu",
        candidateType: "character",
        displayName: "Liu Bei",
        fields: { name: "Liu Bei", house: "Han" },
      }),
      makeCandidate({
        candidateId: "loc-zhuo",
        candidateType: "location",
        displayName: "Zhuozhou",
        fields: { name: "Zhuozhou", region: "Youzhou" },
      }),
    ]);
    const storyResult = prepareAcceptReview(
      items,
      items[0]!.reviewId,
      [],
      GRANULARITY,
      storyAuthority("story-cand-1")
    );
    expect(storyResult.ok).toBe(true);
    if (!storyResult.ok || storyResult.kind !== "story_staging") {
      throw new Error("expected story staging");
    }
    const accepted = markReviewAccepted(items, items[0]!.reviewId);
    const sceneResult = prepareAcceptReview(
      accepted,
      items[1]!.reviewId,
      [storyResult.staging],
      GRANULARITY,
      storyAuthority("story-cand-1")
    );
    expect(sceneResult.ok).toBe(true);
    if (!sceneResult.ok || sceneResult.kind !== "scene_staging") {
      throw new Error("expected scene staging");
    }
    expect(
      sceneResult.staging.visualIntent?.characters?.map((c) => c.name)
    ).toContain("Liu Bei");
    expect(sceneResult.staging.rendererExpression?.environment).toBe("Zhuozhou");
  });

  it("story accept returns staging object with sourceCandidateId", () => {
    const items = createReviewItems([
      makeCandidate({
        candidateId: "story-cand-1",
        candidateType: "story",
        displayName: "Red Wedding Arc",
        fields: {
          title: "Red Wedding Arc",
          summary: "Robb's campaign ends at the Twins",
        },
      }),
      courtyardScene("story-cand-1"),
    ]);
    const result = prepareAcceptReview(items, items[0]!.reviewId, [], GRANULARITY, storyAuthority("story-cand-1"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("story_staging");
      if (result.kind === "story_staging") {
        expect(result.staging.sourceCandidateId).toBe("story-cand-1");
      }
    }
  });

  it("blocks scene accept when parent Story is not accepted", () => {
    const story = makeCandidate({
      candidateId: "story-cand-1",
      candidateType: "story",
      displayName: "Arc",
      fields: { title: "Arc", summary: "Summary" },
    });
    const scene = makeCandidate({
      candidateId: "scene-cand-1",
      candidateType: "scene",
      displayName: "Courtyard",
      fields: {
        parentStoryCandidateId: "story-cand-1",
        chapter_number: 1,
        title: "Courtyard",
        rendererExpression: {
          environment: "winter courtyard",
          characters: [],
          action: "household stands facing gate",
          composition: "wide courtyard view",
        },
      },
    });
    const items = createReviewItems([story, scene]);
    const result = prepareAcceptReview(items, items[1]!.reviewId, [], GRANULARITY, storyAuthority("story-cand-1"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PARENT_STORY_NOT_ACCEPTED");
    }
  });

  it("scene accept writes parent Story staging fields", () => {
    const story = makeCandidate({
      candidateId: "story-cand-1",
      candidateType: "story",
      displayName: "Arc",
      fields: { title: "The Arc", summary: "Summary" },
    });
    const scene = makeCandidate({
      candidateId: "scene-cand-1",
      candidateType: "scene",
      displayName: "Courtyard",
      fields: {
        parentStoryCandidateId: "story-cand-1",
        chapter_number: 1,
        title: "Courtyard",
        summary: "Arrival",
        rendererExpression: {
          environment: "winter courtyard",
          characters: [],
          action: "household stands facing gate",
          composition: "wide courtyard view",
        },
      },
    });
    const items = createReviewItems([story, scene]);
    const storyAccept = prepareAcceptReview(items, items[0]!.reviewId, [], GRANULARITY, storyAuthority("story-cand-1"));
    expect(storyAccept.ok).toBe(true);
    if (!storyAccept.ok || storyAccept.kind !== "story_staging") {
      throw new Error("expected story staging");
    }
    const acceptedItems = markReviewAccepted(items, items[0]!.reviewId);
    const sceneAccept = prepareAcceptReview(
      acceptedItems,
      items[1]!.reviewId,
      [storyAccept.staging],
      GRANULARITY,
      storyAuthority("story-cand-1")
    );
    expect(sceneAccept.ok).toBe(true);
    if (sceneAccept.ok && sceneAccept.kind === "scene_staging") {
      expect(sceneAccept.staging.parentStorySourceReviewId).toBe(
        items[0]!.reviewId
      );
      expect(sceneAccept.staging.parentStoryTitle).toBe("The Arc");
      expect(sceneAccept.staging.rendererExpression?.environment).toBe(
        "winter courtyard"
      );
    }
  });

  it("prepareAcceptStoryWithChildScenes cascades valid child scenes", () => {
    const story = makeCandidate({
      candidateId: "story-cand-1",
      candidateType: "story",
      displayName: "Arc",
      fields: { title: "The Arc", summary: "Summary" },
    });
    const sceneOk = makeCandidate({
      candidateId: "scene-cand-1",
      candidateType: "scene",
      displayName: "Courtyard",
      fields: {
        parentStoryCandidateId: "story-cand-1",
        chapter_number: 1,
        title: "Courtyard",
        rendererExpression: {
          environment: "winter courtyard",
          characters: [],
          action: "household stands facing gate",
          composition: "wide courtyard view",
        },
      },
    });
    const sceneBad = makeCandidate({
      candidateId: "scene-cand-2",
      candidateType: "scene",
      displayName: "Broken",
      fields: {
        parentStoryCandidateId: "story-cand-1",
        chapter_number: 0,
        title: "Broken",
        rendererExpression: {
          environment: "winter courtyard",
          characters: [],
          action: "household stands facing gate",
          composition: "wide courtyard view",
        },
      },
    });
    const char = makeCandidate({
      candidateId: "char-1",
      candidateType: "character",
      displayName: "Arya",
      fields: { name: "Arya", house: "Stark" },
    });
    const items = createReviewItems([story, sceneOk, sceneBad, char]);
    const cascade = prepareAcceptStoryWithChildScenes(
      items,
      items[0]!.reviewId,
      [],
      {
        characters: [{ name: "Arya", tsid: "char_arya" }],
        locations: [],
      },
      GRANULARITY,
      storyAuthority("story-cand-1")
    );
    expect(cascade.ok).toBe(true);
    if (!cascade.ok) throw new Error("expected cascade ok");
    expect(cascade.sceneStagings).toHaveLength(1);
    expect(cascade.sceneStagings[0]!.title).toBe("Courtyard");
    // L2-A: MUST NOT batch-fill Story Route membership from Work character batch
    expect(cascade.storyStaging.relatedCharacterRefs).toEqual([]);
    expect(cascade.storyStaging.relatedLocationRefs).toEqual([]);
    expect(cascade.storyStaging.characterIds).toEqual([]);
    expect(cascade.storyStaging.locationId).toBeNull();
    // Character Archive candidate is NOT cascade-accepted with Story
    expect(cascade.acceptedReviewIds).not.toContain(items[3]!.reviewId);
    expect(cascade.acceptedReviewIds).toEqual([
      items[0]!.reviewId,
      items[1]!.reviewId,
    ]);
    expect(cascade.sceneErrors).toHaveLength(1);
    expect(cascade.sceneErrors[0]!.code).toBe("ACCEPT_VALIDATION_FAILED");
  });

  it("L2-A: Story A Accept MUST NOT inherit Story B-only entities via Work batch", () => {
    const storyA = makeCandidate({
      candidateId: "story-a",
      candidateType: "story",
      displayName: "Story A",
      fields: { title: "Story A", summary: "Arc A" },
    });
    const storyB = makeCandidate({
      candidateId: "story-b",
      candidateType: "story",
      displayName: "Story B",
      fields: { title: "Story B", summary: "Arc B" },
    });
    const sceneA = makeCandidate({
      candidateId: "scene-a",
      candidateType: "scene",
      displayName: "Scene A",
      fields: {
        parentStoryCandidateId: "story-a",
        chapter_number: 1,
        title: "Scene A",
        rendererExpression: {
          environment: "quiet hall",
          characters: [{ role: "lead", visual: "alone" }],
          action: "stands",
          composition: "wide",
        },
      },
    });
    const sceneB = makeCandidate({
      candidateId: "scene-b",
      candidateType: "scene",
      displayName: "Scene B",
      fields: {
        parentStoryCandidateId: "story-b",
        chapter_number: 1,
        title: "Scene B",
        visualIntent: {
          characters: [{ role: "assassin", name: "Arya" }],
          emotion: "cold",
          purpose: "strike",
          relationship: null,
        },
        rendererExpression: {
          environment: "winter courtyard",
          characters: [{ role: "assassin", visual: "hooded" }],
          action: "draws blade",
          composition: "close",
        },
      },
    });
    const arya = makeCandidate({
      candidateId: "char-arya",
      candidateType: "character",
      displayName: "Arya",
      fields: { name: "Arya", house: "Stark" },
    });
    const winterfell = makeCandidate({
      candidateId: "loc-wf",
      candidateType: "location",
      displayName: "Winterfell",
      fields: { name: "Winterfell", region: "North" },
    });

    const items = createReviewItems([
      storyA,
      storyB,
      sceneA,
      sceneB,
      arya,
      winterfell,
    ]);

    const cascadeA = prepareAcceptStoryWithChildScenes(
      items,
      items[0]!.reviewId,
      [],
      {
        characters: [{ name: "Arya", tsid: "char_arya" }],
        locations: [{ name: "Winterfell", tsid: "loc_winterfell" }],
      },
      GRANULARITY,
      {
        workCanon: workCanonFromRequiredClaims([
          { ...TEST_CLAIM, unitId: "U-TEST-A" },
          { ...TEST_CLAIM, unitId: "U-TEST-B" },
        ]),
        storyBinds: [
          { storyCandidateId: "story-a", unitIds: ["U-TEST-A"] },
          { storyCandidateId: "story-b", unitIds: ["U-TEST-B"] },
        ],
      }
    );
    expect(cascadeA.ok).toBe(true);
    if (!cascadeA.ok) throw new Error("expected cascade A ok");

    expect(cascadeA.storyStaging.title).toBe("Story A");
    expect(cascadeA.storyStaging.characterIds).toEqual([]);
    expect(cascadeA.storyStaging.locationId).toBeNull();
    expect(cascadeA.storyStaging.relatedCharacterRefs).toEqual([]);
    expect(cascadeA.storyStaging.relatedLocationRefs).toEqual([]);
    // Arya / Winterfell remain pending — Work Archive, not Story A membership
    expect(cascadeA.acceptedReviewIds).not.toContain(items[4]!.reviewId);
    expect(cascadeA.acceptedReviewIds).not.toContain(items[5]!.reviewId);
    expect(cascadeA.acceptedReviewIds).toEqual([
      items[0]!.reviewId,
      items[2]!.reviewId,
    ]);
  });

  it("prepareAcceptStoryWithChildScenes skips discarded child scenes", () => {
    const story = makeCandidate({
      candidateId: "story-cand-1",
      candidateType: "story",
      displayName: "Arc",
      fields: { title: "The Arc", summary: "Summary" },
    });
    const sceneKeep = makeCandidate({
      candidateId: "scene-keep",
      candidateType: "scene",
      displayName: "Kept Courtyard",
      fields: {
        parentStoryCandidateId: "story-cand-1",
        chapter_number: 1,
        title: "Kept Courtyard",
        rendererExpression: {
          environment: "winter courtyard",
          characters: [],
          action: "household stands facing gate",
          composition: "wide courtyard view",
        },
      },
    });
    const sceneDiscard = makeCandidate({
      candidateId: "scene-cand-1",
      candidateType: "scene",
      displayName: "Courtyard",
      fields: {
        parentStoryCandidateId: "story-cand-1",
        chapter_number: 2,
        title: "Courtyard",
        rendererExpression: {
          environment: "winter courtyard",
          characters: [],
          action: "household stands facing gate",
          composition: "wide courtyard view",
        },
      },
    });
    let items = createReviewItems([story, sceneKeep, sceneDiscard]);
    items = discardReviewItem(items, items[2]!.reviewId);
    const cascade = prepareAcceptStoryWithChildScenes(
      items,
      items[0]!.reviewId,
      [],
      { characters: [], locations: [] },
      GRANULARITY,
      storyAuthority("story-cand-1")
    );
    expect(cascade.ok).toBe(true);
    if (!cascade.ok) throw new Error("expected cascade ok");
    expect(cascade.sceneStagings).toHaveLength(1);
    expect(cascade.sceneStagings[0]!.title).toBe("Kept Courtyard");
    expect(cascade.acceptedReviewIds).toEqual([
      items[0]!.reviewId,
      items[1]!.reviewId,
    ]);
  });

  it("requires parentStoryCandidateId on scene fields", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Courtyard",
        summary: "s",
        fields: { chapter_number: 1, title: "Courtyard" },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(false);
  });

  it("blocks accept when character name missing", () => {
    const validation = validateCharacterAcceptFields({ name: "" });
    expect(validation.ok).toBe(false);
  });

  it("prepareAcceptReview fails for missing review id", () => {
    const result = prepareAcceptReview([], "missing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REVIEW_ITEM_NOT_FOUND");
    }
  });
});

describe("regen sibling dedupe", () => {
  it("collects non-discarded siblings excluding current item", () => {
    const items = createReviewItems([
      makeCandidate({ candidateId: "c1", displayName: "A", fields: { name: "A" } }),
      makeCandidate({
        candidateId: "c2",
        displayName: "B",
        fields: { name: "B" },
      }),
      makeCandidate({
        candidateId: "c3",
        displayName: "C",
        fields: { name: "C" },
      }),
    ]);
    const siblings = getSiblingCandidatesForRegen(items, items[2]!.reviewId);
    expect(siblings).toHaveLength(2);
    expect(siblings.map((c) => c.displayName)).toEqual(["A", "B"]);
  });

  it("detects duplicate candidate against siblings", () => {
    const items = createReviewItems([
      makeCandidate({
        candidateId: "c1",
        displayName: "Arya Stark",
        fields: { name: "Arya Stark", house: "Stark" },
      }),
      makeCandidate({
        candidateId: "c2",
        displayName: "Fourth",
        fields: { name: "Fourth Character" },
      }),
    ]);
    const duplicate = findReviewDuplicateCandidate(
      makeCandidate({
        displayName: "Arya Stark",
        fields: { name: "Arya Stark", house: "Stark" },
      }),
      items,
      items[1]!.reviewId
    );
    expect(duplicate?.reviewId).toBe(items[0]!.reviewId);
  });

  it("ignores discarded siblings when checking duplicates", () => {
    const items = createReviewItems([
      makeCandidate({
        candidateId: "c1",
        displayName: "Arya Stark",
        fields: { name: "Arya Stark", house: "Stark" },
      }),
      makeCandidate({
        candidateId: "c2",
        displayName: "Fourth",
        fields: { name: "Fourth Character" },
      }),
    ]);
    const discarded = discardReviewItem(items, items[0]!.reviewId);
    const duplicate = findReviewDuplicateCandidate(
      makeCandidate({
        displayName: "Arya Stark",
        fields: { name: "Arya Stark", house: "Stark" },
      }),
      discarded,
      items[1]!.reviewId
    );
    expect(duplicate).toBeNull();
  });
});

describe("D3-RC-REV-04 — separate from Enrichment", () => {
  it("useDiscoverySession regen uses discovery regen route not suggest retry", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const hookPath = path.resolve("hooks/useDiscoverySession.ts");
    const source = readFileSync(hookPath, "utf8");
    expect(source).toContain("/api/admin/discovery/propose/regen");
    expect(source).not.toContain("/api/admin/ai/suggest/retry");
  });
});
