/**
 * Integration tests — app/api/admin/ai/suggest/route.ts
 *
 * Verifies:
 *   §7.6 validation rules:
 *     - 400 SCOPE_MISSING: scopeField absent or empty
 *     - 422 INVALID_FIELD_REQUEST: scope or asset field in emptyFields
 *     - 404 ENTITY_NOT_FOUND: entityId not in workId
 *   AC-01: no database write (endpoint returns candidates only)
 *   RT-INV-11: tested via separate retry route test
 *
 * Tests use a mocked Supabase server client and suggest-service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock supabase-server ──────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

// ── Mock suggest-service ──────────────────────────────────────────────────

vi.mock("@/lib/ai/suggest-service", () => ({
  generateSuggestions: vi.fn().mockResolvedValue({
    items: [
      {
        field: "house",
        value: "Stark",
        confidence: "yellow",
        classification: "narrative",
        sources: [],
      },
    ],
    errors: [],
  }),
}));

// Import AFTER mocks are set up
const { POST } = await import("@/app/api/admin/ai/suggest/route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/ai/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeAuthedSupabase(entityExists = true) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

  const maybeSingle = vi.fn().mockResolvedValue({ data: entityExists ? { tsid: "char_123" } : null });
  const neq = vi.fn().mockReturnValue({ maybeSingle });
  const eq2 = vi.fn().mockReturnValue({ neq, maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2, maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  mockFrom.mockReturnValue({ select });
}

describe("POST /api/admin/ai/suggest — §7.6 validation", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it("401 — unauthenticated request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      makeRequest({ workId: "w1", entityType: "character", entityId: "new", scopeField: "Arya", emptyFields: [] })
    );
    expect(res.status).toBe(401);
  });

  it("400 SCOPE_MISSING — scopeField absent", async () => {
    makeAuthedSupabase();

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        entityId: "new",
        scopeField: "",          // empty
        emptyFields: [],
      })
    );
    const body = await res.json() as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("SCOPE_MISSING");
  });

  it("422 INVALID_FIELD_REQUEST — scope field in emptyFields (AC-15)", async () => {
    makeAuthedSupabase();

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        entityId: "new",
        scopeField: "Arya Stark",
        emptyFields: [
          { field: "name", copilot_route: "fact" },   // scope field — invalid
        ],
      })
    );
    const body = await res.json() as { error: { code: string; fields: string[] } };
    expect(res.status).toBe(422);
    expect(body.error.code).toBe("INVALID_FIELD_REQUEST");
    expect(body.error.fields).toContain("name");
  });

  it("422 INVALID_FIELD_REQUEST — asset field in emptyFields (AC-29)", async () => {
    makeAuthedSupabase();

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        entityId: "new",
        scopeField: "Arya Stark",
        emptyFields: [
          { field: "portraitUrl", copilot_route: "narrative" }, // asset — invalid
        ],
      })
    );
    const body = await res.json() as { error: { code: string; fields: string[] } };
    expect(res.status).toBe(422);
    expect(body.error.code).toBe("INVALID_FIELD_REQUEST");
    expect(body.error.fields).toContain("portraitUrl");
  });

  it("404 ENTITY_NOT_FOUND — entityId not in workId (§14.2, AC-14)", async () => {
    makeAuthedSupabase(false);  // entity does not exist

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        entityId: "char_nonexistent",
        scopeField: "Arya Stark",
        emptyFields: [{ field: "house", copilot_route: "fact" }],
      })
    );
    const body = await res.json() as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe("ENTITY_NOT_FOUND");
  });

  it("200 — entityId=new passes entity check (creation flow, §3.3)", async () => {
    makeAuthedSupabase();

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        entityId: "new",
        scopeField: "Arya Stark",
        emptyFields: [{ field: "house", copilot_route: "fact" }],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { suggestions: unknown[] };
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  it("200 — valid request returns suggestions (AC-01: no DB write triggered)", async () => {
    makeAuthedSupabase();

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        entityId: "new",
        scopeField: "Arya Stark",
        emptyFields: [{ field: "house", copilot_route: "fact" }],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { suggestions: Array<{ field: string; classification: string; confidence: string }> };
    expect(body.suggestions[0].field).toBe("house");
    // Verify response shape — no DB write is triggered by this endpoint
    expect(body.suggestions[0].classification).toBeDefined();
    expect(body.suggestions[0].confidence).toBeDefined();
  });
});
