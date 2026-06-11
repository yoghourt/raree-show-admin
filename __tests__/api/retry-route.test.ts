/**
 * Integration tests — app/api/admin/ai/suggest/retry/route.ts
 *
 * Verifies:
 *   RT-INV-11 / AC-10: Batch Retry — one HTTP call for N queued fields
 *   §13.5: sessionId is correlation-only; server must NOT reject missing/null sessionId
 *   §9.5: Narrative Regenerate uses same endpoint (single retryField)
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

function mockWorkTitle(title = "测试作品") {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { title } });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
}

// ── Mock suggest-service ──────────────────────────────────────────────────

const mockGenerateRetrySuggestions = vi.fn();

vi.mock("@/lib/ai/suggest-service", () => ({
  generateRetrySuggestions: mockGenerateRetrySuggestions,
}));

const { POST } = await import("@/app/api/admin/ai/suggest/retry/route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/ai/suggest/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/ai/suggest/retry", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
    mockGenerateRetrySuggestions.mockReset();
  });

  it("401 — unauthenticated request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        scopeField: "Arya",
        retryFields: [{ field: "house", previousSuggestion: "Baratheon", feedback: null }],
      })
    );
    expect(res.status).toBe(401);
  });

  it("RT-INV-11: all queued fields processed in a single function call", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockWorkTitle();
    mockGenerateRetrySuggestions.mockResolvedValue({
      items: [
        { field: "house", value: "Stark", confidence: "yellow", classification: "narrative", sources: [] },
        { field: "description", value: "A skilled fighter", confidence: "yellow", classification: "narrative", sources: [] },
      ],
      errors: [],
    });

    const retryFields = [
      { field: "house", previousSuggestion: "Baratheon", feedback: "Wrong family" },
      { field: "description", previousSuggestion: "Short bio", feedback: null },
    ];

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        scopeField: "Arya Stark",
        retryFields,
      })
    );

    expect(res.status).toBe(200);
    // Verify generateRetrySuggestions was called exactly once with ALL fields
    expect(mockGenerateRetrySuggestions).toHaveBeenCalledTimes(1);
    expect(mockGenerateRetrySuggestions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ field: "house" }),
        expect.objectContaining({ field: "description" }),
      ]),
      expect.objectContaining({ entityType: "character", scopeFieldValue: "Arya Stark" })
    );
  });

  it("§13.5: missing sessionId is valid (correlation-only)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockWorkTitle();
    mockGenerateRetrySuggestions.mockResolvedValue({ items: [], errors: [] });

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        scopeField: "Test",
        // sessionId omitted — must be valid
        retryFields: [{ field: "house", previousSuggestion: "old", feedback: null }],
      })
    );
    expect(res.status).toBe(200);
  });

  it("§13.5: null sessionId is valid (correlation-only)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockWorkTitle();
    mockGenerateRetrySuggestions.mockResolvedValue({ items: [], errors: [] });

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        scopeField: "Test",
        sessionId: null,  // explicit null — must be valid
        retryFields: [{ field: "house", previousSuggestion: "old", feedback: null }],
      })
    );
    expect(res.status).toBe(200);
  });

  it("§9.5 Narrative Regenerate: single retryField is valid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockWorkTitle();
    mockGenerateRetrySuggestions.mockResolvedValue({
      items: [
        { field: "description", value: "Regenerated narrative", confidence: "yellow", classification: "narrative", sources: [] },
      ],
      errors: [],
    });

    const res = await POST(
      makeRequest({
        workId: "work-1",
        entityType: "character",
        scopeField: "Arya Stark",
        retryFields: [
          {
            field: "description",
            previousSuggestion: "Original description",
            feedback: "Make it longer",
          },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { suggestions: Array<{ field: string; value: string }> };
    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0].field).toBe("description");
  });
});
