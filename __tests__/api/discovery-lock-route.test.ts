/**
 * Integration tests — app/api/admin/discovery/session/lock/route.ts
 *
 * SPEC-D3-001 §6 / D3-AC-IMP-05 — server re-validates Narrative Gate
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  EXCERPT_BUNDLE_MIN_PROSE,
} from "@/lib/discovery/constants";
import { resetServerLockRegistry } from "@/lib/discovery/server-session-registry";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

const { POST } = await import(
  "@/app/api/admin/discovery/session/lock/route"
);

function makeProse(length: number): string {
  const unit = "Narrative prose sentence. ";
  let out = "";
  while (out.length < length) {
    out += unit;
  }
  return out.slice(0, length);
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/discovery/session/lock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeAuthedSupabase(workExists = true) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: workExists ? { id: "work-1" } : null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
}

const validBody = {
  workId: "work-1",
  sessionId: "sess-1",
  narrative: {
    excerpts: [{ text: makeProse(EXCERPT_BUNDLE_MIN_PROSE), orderIndex: 0 }],
    operatorSummary: null,
    inputMode: "excerpt_bundle",
    summaryAttested: false,
  },
};

describe("POST /api/admin/discovery/session/lock", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    resetServerLockRegistry();
  });

  it("401 — unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("404 — work not accessible", async () => {
    makeAuthedSupabase(false);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("SESSION_NOT_FOUND");
  });

  it("422 — NARRATIVE_GATE_FAILED (keyword list excerpt)", async () => {
    makeAuthedSupabase(true);
    const res = await POST(
      makeRequest({
        ...validBody,
        narrative: {
          ...validBody.narrative,
          excerpts: [
            { text: "Red Wedding, Robb, Walder Frey, Catelyn", orderIndex: 0 },
          ],
        },
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("NARRATIVE_GATE_FAILED");
    expect(body.error.failures.some((f: { ruleId: string }) => f.ruleId === "NG-02" || f.ruleId === "NG-05")).toBe(true);
  });

  it("422 — NARRATIVE_GATE_FAILED (catalogOnly flag)", async () => {
    makeAuthedSupabase(true);
    const res = await POST(
      makeRequest({
        ...validBody,
        catalogOnly: true,
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("NARRATIVE_GATE_FAILED");
    expect(body.error.failures.some((f: { ruleId: string }) => f.ruleId === "NG-06")).toBe(true);
  });

  it("200 — locks narrative after server gate pass", async () => {
    makeAuthedSupabase(true);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("narrative_locked");
    expect(body.sessionId).toBe("sess-1");
    expect(body.lockedAt).toBeTruthy();
  });

  it("409 — SESSION_ALREADY_ACTIVE for second session", async () => {
    makeAuthedSupabase(true);
    await POST(makeRequest(validBody));
    const res = await POST(
      makeRequest({
        ...validBody,
        sessionId: "sess-2",
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("SESSION_ALREADY_ACTIVE");
  });

  it("does not call insert/update on Supabase (DISC-INV-01)", async () => {
    makeAuthedSupabase(true);
    await POST(makeRequest(validBody));
    expect(mockFrom).toHaveBeenCalled();
    const tableMock = mockFrom.mock.results[0]?.value;
    expect(tableMock.insert).toBeUndefined();
    expect(tableMock.update).toBeUndefined();
    expect(tableMock.upsert).toBeUndefined();
  });
});
