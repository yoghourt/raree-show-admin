/**
 * Unit tests — Discovery Human Review state machine
 *
 * SPEC-D3-002 D3-RC-REV-* / D3-AC-IMP-REV-07
 */

import { describe, it, expect } from "vitest";

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

  it("story accept returns staging object", () => {
    const items = createReviewItems([
      makeCandidate({
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
    }
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
