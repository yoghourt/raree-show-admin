/**
 * Unit tests — DiscoveryReviewSnapshot round-trip & hasReviewProgress logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  saveDiscoveryReviewSnapshot,
  loadDiscoveryReviewSnapshot,
  clearDiscoveryReviewSnapshot,
  type DiscoveryReviewSnapshot,
} from "@/lib/discovery/review-session-storage";
import type { ProposeError } from "@/lib/discovery/propose-types";
import type { DiscoverySession } from "@/lib/discovery/types";

// Mock sessionStorage for node environment
const store: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const key of Object.keys(store)) delete store[key]; },
};
vi.stubGlobal("sessionStorage", mockSessionStorage);

// ── helpers ──────────────────────────────────────────────────────────────────

const WORK_ID = "work-abc";
const OPERATOR_ID = "op-123";
const SESSION_ID = "sess-001";

function makeSession(state: DiscoverySession["state"] = "review_pending"): DiscoverySession {
  return {
    sessionId: SESSION_ID,
    workId: WORK_ID,
    operatorId: OPERATOR_ID,
    state,
    narrative: {
      excerpts: [],
      operatorSummary: null,
      inputMode: "excerpt_bundle",
      summaryAttested: false,
    },
    lockedAt: state === "narrative_locked" || state === "review_pending"
      ? new Date().toISOString()
      : null,
    createdAt: new Date().toISOString(),
  };
}

function makeSnapshot(overrides: Partial<DiscoveryReviewSnapshot> = {}): DiscoveryReviewSnapshot {
  return {
    sessionId: SESSION_ID,
    workId: WORK_ID,
    operatorId: OPERATOR_ID,
    session: makeSession(),
    candidates: [],
    reviewItems: [],
    acceptedStoryUnits: [],
    acceptedSceneCandidates: [],
    savedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("DiscoveryReviewSnapshot — basic round-trip", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("saves and loads a snapshot without proposeError", () => {
    const snap = makeSnapshot();
    saveDiscoveryReviewSnapshot(snap);
    const loaded = loadDiscoveryReviewSnapshot(WORK_ID, OPERATOR_ID, SESSION_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe(SESSION_ID);
    expect(loaded!.proposeError).toBeUndefined();
  });

  it("persists proposeError with partial failures and reloads it", () => {
    const proposeError: ProposeError = {
      code: "PARTIAL_PROPOSE_FAILURE",
      message: "story failed",
      errors: [{ candidateType: "story", code: "GEN_FAILED", message: "timeout" }],
    };
    const snap = makeSnapshot({ proposeError });
    saveDiscoveryReviewSnapshot(snap);

    const loaded = loadDiscoveryReviewSnapshot(WORK_ID, OPERATOR_ID, SESSION_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.proposeError?.code).toBe("PARTIAL_PROPOSE_FAILURE");
    expect(loaded!.proposeError?.errors).toHaveLength(1);
    expect(loaded!.proposeError?.errors![0].candidateType).toBe("story");
  });

  it("persists proposeError with null and reloads it", () => {
    const snap = makeSnapshot({ proposeError: null });
    saveDiscoveryReviewSnapshot(snap);

    const loaded = loadDiscoveryReviewSnapshot(WORK_ID, OPERATOR_ID, SESSION_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.proposeError).toBeNull();
  });

  it("clears snapshot correctly", () => {
    saveDiscoveryReviewSnapshot(makeSnapshot());
    clearDiscoveryReviewSnapshot(WORK_ID, OPERATOR_ID, SESSION_ID);
    expect(loadDiscoveryReviewSnapshot(WORK_ID, OPERATOR_ID, SESSION_ID)).toBeNull();
  });

  it("returns null for mismatched sessionId", () => {
    saveDiscoveryReviewSnapshot(makeSnapshot());
    expect(loadDiscoveryReviewSnapshot(WORK_ID, OPERATOR_ID, "other-session")).toBeNull();
  });
});

describe("hasReviewProgress — failed types keep snapshot alive", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("snapshot survives when only proposeError with errors is present", () => {
    const proposeError: ProposeError = {
      code: "PARTIAL_PROPOSE_FAILURE",
      message: "character failed",
      errors: [{ candidateType: "character", code: "GEN_FAILED", message: "timeout" }],
    };
    const snap = makeSnapshot({
      session: makeSession("narrative_locked"),
      reviewItems: [],
      acceptedStoryUnits: [],
      acceptedSceneCandidates: [],
      proposeError,
    });
    saveDiscoveryReviewSnapshot(snap);

    const loaded = loadDiscoveryReviewSnapshot(WORK_ID, OPERATOR_ID, SESSION_ID);
    expect(loaded).not.toBeNull();
    expect(loaded!.proposeError?.errors).toHaveLength(1);
  });
});
