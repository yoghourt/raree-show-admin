/**
 * Integration tests — app/api/admin/discovery/propose/route.ts
 *
 * SPEC-D3-003 D3-AC-IMP-PRO-01 / PRO-02 / PRO-03
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { EXCERPT_BUNDLE_MIN_PROSE } from "@/lib/discovery/constants";
import {
  resetServerLockRegistry,
  setServerLock,
} from "@/lib/discovery/server-session-registry";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

const { POST: proposePost } = await import(
  "@/app/api/admin/discovery/propose/route"
);
const { POST: regenPost } = await import(
  "@/app/api/admin/discovery/propose/regen/route"
);

function makeProse(length: number): string {
  const unit = "Narrative prose sentence. ";
  let out = "";
  while (out.length < length) {
    out += unit;
  }
  return out.slice(0, length);
}

const narrative = {
  excerpts: [{ text: makeProse(EXCERPT_BUNDLE_MIN_PROSE), orderIndex: 0 }],
  operatorSummary: null,
  inputMode: "excerpt_bundle" as const,
  summaryAttested: false,
};

function makeAuthedSupabase(workExists = true) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: workExists ? { id: "work-1", title: "A Game of Thrones" } : null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
}

function makeProposeRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/discovery/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRegenRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/discovery/propose/regen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/discovery/propose", () => {
  const lockedAt = "2026-06-30T12:00:00.000Z";

  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    resetServerLockRegistry();
  });

  it("401 — unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await proposePost(
      makeProposeRequest({
        workId: "work-1",
        sessionId: "sess-1",
        narrative,
        lockedAt,
      })
    );
    expect(res.status).toBe(401);
  });

  it("400 — NARRATIVE_NOT_LOCKED without server lock", async () => {
    makeAuthedSupabase(true);
    const res = await proposePost(
      makeProposeRequest({
        workId: "work-1",
        sessionId: "sess-1",
        narrative,
        lockedAt,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NARRATIVE_NOT_LOCKED");
  });

  it("200 — returns candidates with verified lock (mock mode)", async () => {
    makeAuthedSupabase(true);
    setServerLock("work-1", "user-1", "sess-1", lockedAt, narrative);

    const res = await proposePost(
      makeProposeRequest({
        workId: "work-1",
        sessionId: "sess-1",
        narrative,
        lockedAt,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("review_pending");
    expect(body.candidates.length).toBeGreaterThan(0);
    const types = new Set(
      body.candidates.map((c: { candidateType: string }) => c.candidateType)
    );
    expect(types.has("story")).toBe(true);
    expect(types.has("scene")).toBe(true);
    expect(types.has("readingRoute")).toBe(false);
    const story = body.candidates.find(
      (c: { candidateType: string }) => c.candidateType === "story"
    );
    const scene = body.candidates.find(
      (c: { candidateType: string }) => c.candidateType === "scene"
    );
    expect(scene.fields.parentStoryCandidateId).toBe(story.candidateId);
    expect(body.granularityGate).toBeDefined();
    expect(["PASS", "FAIL"]).toContain(body.granularityGate.status);
    expect(Array.isArray(body.granularityGate.violations)).toBe(true);
  });

  it("does not call insert/update on Supabase (DISC-INV-01)", async () => {
    makeAuthedSupabase(true);
    setServerLock("work-1", "user-1", "sess-1", lockedAt, narrative);
    await proposePost(
      makeProposeRequest({
        workId: "work-1",
        sessionId: "sess-1",
        narrative,
        lockedAt,
      })
    );
    const tableMock = mockFrom.mock.results[0]?.value;
    expect(tableMock.insert).toBeUndefined();
    expect(tableMock.update).toBeUndefined();
    expect(tableMock.upsert).toBeUndefined();
  });

  it("does not import suggest-service", async () => {
    const routePath = await import(
      "@/app/api/admin/discovery/propose/route"
    );
    const source = routePath.POST.toString();
    expect(source).not.toContain("suggest-service");
  });
});

describe("POST /api/admin/discovery/propose/regen", () => {
  const lockedAt = "2026-06-30T12:00:00.000Z";

  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    resetServerLockRegistry();
  });

  it("200 — regen with valid lock", async () => {
    makeAuthedSupabase(true);
    setServerLock("work-1", "user-1", "sess-1", lockedAt, narrative);

    const proposeRes = await proposePost(
      makeProposeRequest({
        workId: "work-1",
        sessionId: "sess-1",
        narrative,
        lockedAt,
      })
    );
    const proposeBody = await proposeRes.json();
    const previous = proposeBody.candidates.find(
      (c: { candidateType: string }) => c.candidateType === "character"
    );

    const res = await regenPost(
      makeRegenRequest({
        workId: "work-1",
        sessionId: "sess-1",
        narrative,
        lockedAt,
        candidateType: "character",
        previousCandidate: previous,
        feedback: "More nuance",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidate.candidateType).toBe("character");
  });
});
