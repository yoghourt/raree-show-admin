/**
 * Unit tests — Discovery Human Review state machine
 *
 * SPEC-D3-002 D3-RC-REV-* / D3-AC-IMP-REV-07
 */

import { describe, it, expect } from "vitest";

import { normalizeRawCandidate } from "@/lib/discovery/candidate-validate";
import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
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
  it("character accept returns entity prefill path", () => {
    const items = createReviewItems([makeCandidate()]);
    const result = prepareAcceptReview(items, items[0]!.reviewId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("entity_prefill");
      if (result.kind === "entity_prefill") {
        expect(result.path).toContain("/characters/new");
        expect(result.path).toContain("discoveryReviewId=");
        expect(result.prefill.source).toBe("discovery_review");
      }
    }
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
    ]);
    const result = prepareAcceptReview(items, items[0]!.reviewId);
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
      },
    });
    const items = createReviewItems([story, scene]);
    const result = prepareAcceptReview(items, items[1]!.reviewId, []);
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
      },
    });
    const items = createReviewItems([story, scene]);
    const storyAccept = prepareAcceptReview(items, items[0]!.reviewId);
    expect(storyAccept.ok).toBe(true);
    if (!storyAccept.ok || storyAccept.kind !== "story_staging") {
      throw new Error("expected story staging");
    }
    const acceptedItems = markReviewAccepted(items, items[0]!.reviewId);
    const sceneAccept = prepareAcceptReview(
      acceptedItems,
      items[1]!.reviewId,
      [storyAccept.staging]
    );
    expect(sceneAccept.ok).toBe(true);
    if (sceneAccept.ok && sceneAccept.kind === "scene_staging") {
      expect(sceneAccept.staging.parentStorySourceReviewId).toBe(
        items[0]!.reviewId
      );
      expect(sceneAccept.staging.parentStoryTitle).toBe("The Arc");
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
      }
    );
    expect(cascade.ok).toBe(true);
    if (!cascade.ok) throw new Error("expected cascade ok");
    expect(cascade.sceneStagings).toHaveLength(1);
    expect(cascade.sceneStagings[0]!.title).toBe("Courtyard");
    expect(cascade.storyStaging.relatedCharacterRefs).toHaveLength(1);
    expect(cascade.storyStaging.relatedCharacterRefs![0]!.matchedTsid).toBe(
      "char_arya"
    );
    expect(cascade.storyStaging.characterIds).toEqual(["char_arya"]);
    expect(cascade.acceptedReviewIds).toContain(items[3]!.reviewId);
    expect(cascade.sceneErrors).toHaveLength(1);
    expect(cascade.sceneErrors[0]!.code).toBe("ACCEPT_VALIDATION_FAILED");
  });

  it("prepareAcceptStoryWithChildScenes skips discarded child scenes", () => {
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
      },
    });
    let items = createReviewItems([story, scene]);
    items = discardReviewItem(items, items[1]!.reviewId);
    const cascade = prepareAcceptStoryWithChildScenes(items, items[0]!.reviewId);
    expect(cascade.ok).toBe(true);
    if (!cascade.ok) throw new Error("expected cascade ok");
    expect(cascade.sceneStagings).toHaveLength(0);
    expect(cascade.acceptedReviewIds).toEqual([items[0]!.reviewId]);
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
