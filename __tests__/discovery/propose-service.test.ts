/**
 * Unit tests — SPEC-D3-003 propose service, validation, lock verification
 *
 * D3-AC-IMP-PRO-05, OQ-D3-003-05
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  capCandidatesByType,
  normalizeRawCandidate,
} from "@/lib/discovery/candidate-validate";
import {
  EXCERPT_BUNDLE_MIN_PROSE,
  MAX_CANDIDATES_PER_TYPE,
} from "@/lib/discovery/constants";
import { normalizeNarrativeBundle } from "@/lib/discovery/narrative-snapshot";
import {
  isDiscoveryProposeMockMode,
  proposeAllCandidateTypes,
  regenCandidate,
  proposeCandidateTypes,
} from "@/lib/discovery/propose-service";
import { verifyProposeLock } from "@/lib/discovery/propose-verify";
import {
  resetServerLockRegistry,
  setServerLock,
} from "@/lib/discovery/server-session-registry";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

function makeProse(length: number): string {
  const unit = "Narrative prose sentence. ";
  let out = "";
  while (out.length < length) {
    out += unit;
  }
  return out.slice(0, length);
}

const validNarrative: NarrativeInputBundle = {
  excerpts: [{ text: makeProse(EXCERPT_BUNDLE_MIN_PROSE), orderIndex: 0 }],
  operatorSummary: null,
  inputMode: "excerpt_bundle",
  summaryAttested: false,
};

describe("isDiscoveryProposeMockMode", () => {
  it("returns true under vitest", () => {
    expect(isDiscoveryProposeMockMode()).toBe(true);
  });
});

describe("normalizeRawCandidate", () => {
  it("accepts valid character candidate", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Arya Stark",
        summary: "Young Stark daughter.",
        fields: { name: "Arya Stark", house: "Stark" },
      },
      "character",
      "work-1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidate.candidateType).toBe("character");
      expect(result.candidate.workId).toBe("work-1");
    }
  });

  it("rejects asset fields", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Bad",
        summary: "Bad",
        fields: { name: "Bad", portraitUrl: "http://x" },
      },
      "character",
      "work-1"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects story without summary", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Story",
        summary: "x",
        fields: { title: "Story", summary: "" },
      },
      "story",
      "work-1"
    );
    expect(result.ok).toBe(false);
  });
});

describe("capCandidatesByType", () => {
  it("caps at MAX_CANDIDATES_PER_TYPE per type", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      candidateId: `c-${i}`,
      candidateType: "character" as const,
      workId: "work-1",
      displayName: `Char ${i}`,
      summary: "s",
      fields: { name: `Char ${i}` },
    }));
    const capped = capCandidatesByType(many);
    expect(capped).toHaveLength(MAX_CANDIDATES_PER_TYPE);
  });
});

describe("verifyProposeLock", () => {
  const lockedAt = "2026-06-30T12:00:00.000Z";

  beforeEach(() => {
    resetServerLockRegistry();
  });

  it("400 path — NARRATIVE_NOT_LOCKED when no server lock", () => {
    const result = verifyProposeLock(
      "work-1",
      "op-1",
      "sess-1",
      validNarrative,
      lockedAt
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NARRATIVE_NOT_LOCKED");
    }
  });

  it("422 path — NARRATIVE_INVALID on lockedAt mismatch", () => {
    setServerLock("work-1", "op-1", "sess-1", lockedAt, validNarrative);
    const result = verifyProposeLock(
      "work-1",
      "op-1",
      "sess-1",
      validNarrative,
      "2026-06-30T13:00:00.000Z"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NARRATIVE_INVALID");
    }
  });

  it("422 path — NARRATIVE_INVALID on narrative mismatch", () => {
    setServerLock("work-1", "op-1", "sess-1", lockedAt, validNarrative);
    const tampered = {
      ...validNarrative,
      operatorSummary: "tampered",
    };
    const result = verifyProposeLock(
      "work-1",
      "op-1",
      "sess-1",
      tampered,
      lockedAt
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NARRATIVE_INVALID");
    }
  });

  it("passes when snapshot matches", () => {
    setServerLock("work-1", "op-1", "sess-1", lockedAt, validNarrative);
    const result = verifyProposeLock(
      "work-1",
      "op-1",
      "sess-1",
      validNarrative,
      lockedAt
    );
    expect(result.ok).toBe(true);
    expect(normalizeNarrativeBundle(validNarrative)).toBeTruthy();
  });
});

describe("proposeAllCandidateTypes (mock)", () => {
  it("returns candidates for all four types", async () => {
    const { candidates, errors } = await proposeAllCandidateTypes({
      workId: "work-1",
      workTitle: "Test Work",
      narrative: validNarrative,
    });
    expect(errors).toHaveLength(0);
    expect(candidates.length).toBeGreaterThanOrEqual(4);
    const types = new Set(candidates.map((c) => c.candidateType));
    expect(types.has("character")).toBe(true);
    expect(types.has("location")).toBe(true);
    expect(types.has("story")).toBe(true);
    expect(types.has("readingRoute")).toBe(true);
  });
});

describe("proposeCandidateTypes (mock)", () => {
  it("generates only requested types", async () => {
    const result = await proposeCandidateTypes({
      workId: "work-1",
      workTitle: "Test Work",
      narrative: validNarrative,
      candidateTypes: ["readingRoute"],
    });
    expect(result.candidates.every((c) => c.candidateType === "readingRoute")).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);
  });
});

describe("regenCandidate (mock)", () => {
  it("returns a replacement candidate", async () => {
    const { candidates } = await proposeAllCandidateTypes({
      workId: "work-1",
      workTitle: "Test Work",
      narrative: validNarrative,
    });
    const previous = candidates.find((c) => c.candidateType === "character");
    expect(previous).toBeTruthy();

    const result = await regenCandidate({
      workId: "work-1",
      workTitle: "Test Work",
      narrative: validNarrative,
      candidateType: "character",
      previousCandidate: previous!,
      feedback: "More detail please",
    });
    expect(result.candidate).toBeTruthy();
    expect(result.candidate?.candidateType).toBe("character");
  });

  it("rejects regen that duplicates a sibling candidate", async () => {
    const sibling = {
      candidateId: "sibling-1",
      candidateType: "character" as const,
      workId: "work-1",
      displayName: "Eddard Stark",
      summary: "Existing review item",
      fields: { name: "Eddard Stark", house: "Stark" },
    };

    const result = await regenCandidate({
      workId: "work-1",
      workTitle: "Test Work",
      narrative: validNarrative,
      candidateType: "character",
      previousCandidate: {
        candidateId: "prev-1",
        candidateType: "character",
        workId: "work-1",
        displayName: "Fourth Character",
        summary: "Needs regen",
        fields: { name: "Fourth Character" },
      },
      siblingCandidates: [sibling],
      feedback: "Try again",
    });

    expect(result.candidate).toBeUndefined();
    expect(result.error?.code).toBe("REGEN_DUPLICATE");
  });
});
