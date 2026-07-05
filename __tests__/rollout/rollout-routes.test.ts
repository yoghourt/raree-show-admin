/**
 * Integration tests — Rollout API routes (SPEC-ROL-001)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

const { POST: persistStoryPost } = await import(
  "@/app/api/admin/rollout/story-units/route"
);
const { DELETE: deleteStoryDelete, PATCH: patchStoryPatch } = await import(
  "@/app/api/admin/rollout/story-units/[storyUnitId]/route"
);
const { POST: createLinkPost } = await import(
  "@/app/api/admin/rollout/story-scene-links/route"
);
const { POST: importStagingPost } = await import(
  "@/app/api/admin/rollout/staging/import/route"
);

function makeAuthedSupabase(workExists = true) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: workExists ? { id: "work-1", title: "Test Work" } : null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
}

const validStoryStaging = {
  workId: "work-1",
  sourceReviewId: "rev-story-1",
  title: "Northern arc",
  summary: "Editorial story unit",
  acceptedAt: "2026-07-05T00:00:00.000Z",
};

describe("POST /api/admin/rollout/staging/import", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it("returns validated queue without calling Discovery routes", async () => {
    makeAuthedSupabase();
    const res = await importStagingPost(
      new Request("http://localhost/api/admin/rollout/staging/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: "work-1",
          storyUnits: [validStoryStaging],
        }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.queue.storyStaging).toHaveLength(1);
  });

  it("rejects workId mismatch on staging", async () => {
    makeAuthedSupabase();
    const res = await importStagingPost(
      new Request("http://localhost/api/admin/rollout/staging/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: "work-1",
          storyUnits: [{ ...validStoryStaging, workId: "work-2" }],
        }),
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("WORK_MISMATCH");
  });
});

describe("POST /api/admin/rollout/story-units", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it("persists story unit with provenance", async () => {
    makeAuthedSupabase();

    const storyInsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: "unit-uuid",
        work_id: "work-1",
        source_review_id: "rev-story-1",
        title: "Northern arc",
        summary: "Editorial story unit",
        boundary_hint: null,
        approved_at: "2026-07-05T01:00:00.000Z",
        approved_by: "user-1",
        status: "active",
      },
      error: null,
    });
    const storyInsertSelect = vi.fn().mockReturnValue({ single: storyInsertSingle });
    const storyInsert = vi.fn().mockReturnValue({ select: storyInsertSelect });

    mockFrom.mockImplementation((table: string) => {
      if (table === "works") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: "work-1", title: "Test Work" },
        });
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
      }
      if (table === "story_units") {
        return { insert: storyInsert };
      }
      return { select: vi.fn() };
    });

    const res = await persistStoryPost(
      new Request("http://localhost/api/admin/rollout/story-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workId: "work-1", staging: validStoryStaging }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.storyUnit.sourceReviewId).toBe("rev-story-1");
    expect(storyInsert).toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/rollout/story-units/[storyUnitId] (update)", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it("updates story unit fields", async () => {
    makeAuthedSupabase();

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "unit-uuid",
        work_id: "work-1",
        source_review_id: "rev-story-1",
        title: "Updated title",
        summary: "Updated summary",
        boundary_hint: "hint",
        approved_at: "2026-07-05T00:00:00.000Z",
        approved_by: "user-1",
        status: "active",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const secondEq = vi.fn().mockReturnValue({ select });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const update = vi.fn().mockReturnValue({ eq: firstEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === "works") {
        const workMaybeSingle = vi.fn().mockResolvedValue({
          data: { id: "work-1", title: "Test Work" },
        });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle: workMaybeSingle }),
          }),
        };
      }
      if (table === "story_units") {
        return { update };
      }
      return { select: vi.fn() };
    });

    const res = await patchStoryPatch(
      new Request("http://localhost/api/admin/rollout/story-units/unit-uuid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: "work-1",
          title: "Updated title",
          summary: "Updated summary",
          boundaryHint: "hint",
        }),
      }),
      { params: Promise.resolve({ storyUnitId: "unit-uuid" }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.storyUnit.title).toBe("Updated title");
    expect(update).toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/rollout/story-units/[storyUnitId] (unpersist)", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it("unpersists story unit and returns staging when no links exist", async () => {
    makeAuthedSupabase();

    mockFrom.mockImplementation((table: string) => {
      if (table === "works") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: "work-1", title: "Test Work" },
        });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
        };
      }
      if (table === "story_units") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: "unit-uuid",
            work_id: "work-1",
            source_review_id: "rev-story-1",
            title: "Northern arc",
            summary: "",
            boundary_hint: null,
            approved_at: "2026-07-05T00:00:00.000Z",
            approved_by: "user-1",
            status: "active",
          },
        });
        const deleteEq = vi.fn().mockResolvedValue({ error: null });
        const deleteSecondEq = vi.fn().mockReturnValue({ eq: deleteEq });
        const deleteFirstEq = vi.fn().mockReturnValue({ eq: deleteSecondEq });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
          delete: vi.fn().mockReturnValue({ eq: deleteFirstEq }),
        };
      }
      if (table === "story_scene_links") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const res = await deleteStoryDelete(
      new Request(
        "http://localhost/api/admin/rollout/story-units/unit-uuid?workId=work-1",
        { method: "DELETE" }
      ),
      { params: Promise.resolve({ storyUnitId: "unit-uuid" }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.staging.sourceReviewId).toBe("rev-story-1");
    expect(json.staging.title).toBe("Northern arc");
  });

  it("returns UNPERSIST_BLOCKED when links exist", async () => {
    makeAuthedSupabase();

    mockFrom.mockImplementation((table: string) => {
      if (table === "works") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: "work-1", title: "Test Work" },
        });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
        };
      }
      if (table === "story_units") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: "unit-uuid",
            work_id: "work-1",
            source_review_id: "rev-story-1",
            title: "Northern arc",
            summary: "",
            boundary_hint: null,
            approved_at: "2026-07-05T00:00:00.000Z",
            approved_by: "user-1",
            status: "active",
          },
        });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        };
      }
      if (table === "story_scene_links") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const res = await deleteStoryDelete(
      new Request(
        "http://localhost/api/admin/rollout/story-units/unit-uuid?workId=work-1",
        { method: "DELETE" }
      ),
      { params: Promise.resolve({ storyUnitId: "unit-uuid" }) }
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("UNPERSIST_BLOCKED");
  });
});

describe("POST /api/admin/rollout/story-scene-links", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  it("rejects duplicate link with LINK_ALREADY_EXISTS", async () => {
    makeAuthedSupabase();

    mockFrom.mockImplementation((table: string) => {
      if (table === "works") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: "work-1", title: "Test Work" },
        });
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
      }
      if (table === "story_units") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: "unit-uuid",
            work_id: "work-1",
            source_review_id: "r1",
            title: "Story",
            summary: "",
            boundary_hint: null,
            approved_at: "2026-07-05T00:00:00.000Z",
            approved_by: "user-1",
            status: "active",
          },
        });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        };
      }
      if (table === "scenes") {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { tsid: "scene_1" } });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        };
      }
      if (table === "story_scene_links") {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: "link-1",
            work_id: "work-1",
            story_unit_id: "unit-uuid",
            scene_tsid: "scene_1",
            linked_at: "2026-07-05T00:00:00.000Z",
            linked_by: "user-1",
            source: "operator_projection_accept",
          },
        });
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ maybeSingle }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const res = await createLinkPost(
      new Request("http://localhost/api/admin/rollout/story-scene-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId: "work-1",
          storyUnitId: "550e8400-e29b-41d4-a716-446655440000",
          sceneTsid: "scene_1",
        }),
      })
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("LINK_ALREADY_EXISTS");
  });
});
