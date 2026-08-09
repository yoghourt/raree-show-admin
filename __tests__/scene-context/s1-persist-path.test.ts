/**
 * IMPLEMENT-SCC-001-S1 — Context path persist (mocked Supabase)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const getByTsidMock = vi.fn();
const getWithContextsMock = vi.fn();
const getByDiscoveryMock = vi.fn();

vi.mock("@/lib/rollout/scenes-server", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/rollout/scenes-server")
  >("@/lib/rollout/scenes-server");
  return {
    ...actual,
    getSceneRowByTsid: (...args: unknown[]) => getByTsidMock(...args),
    getSceneRowWithContextsByTsid: (...args: unknown[]) =>
      getWithContextsMock(...args),
    getSceneRowByDiscoverySourceReviewId: (...args: unknown[]) =>
      getByDiscoveryMock(...args),
    updateSceneFramesAndProvenance: (...args: unknown[]) => updateMock(...args),
  };
});

describe("persistReadingFrameFromSceneStaging Context path", () => {
  beforeEach(() => {
    vi.resetModules();
    updateMock.mockReset();
    getByTsidMock.mockReset();
    getWithContextsMock.mockReset();
    getByDiscoveryMock.mockReset();
    process.env.SCENE_CONTEXT_PROJECTION_ENABLED = "1";
    delete process.env.SCENE_CONTEXT_WORK_ALLOWLIST;
  });

  it("writes scene_contexts_v1 and does not mutate Route archive fields", async () => {
    const parent = {
      work_id: "work-1",
      tsid: "scene_route_1",
      title: "Arc",
      chapter_number: 1,
      chapter_title: null,
      summary: "",
      tags: [],
      story_images_v2: [],
      discovery_source_review_id: "rev-story-1",
      frame_provenance_v1: [],
      scene_contexts_v1: [],
    };
    getWithContextsMock.mockResolvedValue(parent);
    updateMock.mockResolvedValue(parent);

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    };

    const { persistReadingFrameFromSceneStaging } = await import(
      "@/lib/rollout/reading-frame-persist"
    );

    const result = await persistReadingFrameFromSceneStaging(
      supabase as never,
      "work-1",
      {
        workId: "work-1",
        sourceReviewId: "rev-scene-1",
        parentStorySourceReviewId: "rev-story-1",
        parentStoryTitle: "Arc",
        chapter_number: 1,
        title: "Courtyard",
        summary: "Household faces the gate.",
        rendererExpression: {
          environment: "winter courtyard",
          characters: [{ role: "guard", visual: "cloaked figure mid-ground" }],
          action: "stands facing gate",
          composition: "wide courtyard view",
        },
        acceptedAt: "2026-08-08T00:00:00.000Z",
      },
      { parentRouteTsid: "scene_route_1" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contextPath).toBe(true);
    expect(result.contextId).toBe("ctx_rev-scene-1");
    expect(updateMock).toHaveBeenCalledTimes(1);
    const [, , , frames, provenance, options] = updateMock.mock.calls[0]!;
    expect(frames).toEqual([
      { url: "", caption: "Household faces the gate." },
    ]);
    expect(provenance[0].sourceContextId).toBe("ctx_rev-scene-1");
    expect(options.sceneContexts).toHaveLength(1);
    expect(options.sceneContexts[0].contextId).toBe("ctx_rev-scene-1");
    // update patch must not include character_ids / location_id — only frames/provenance/contexts
  });

  it("uses legacy path when flag off", async () => {
    process.env.SCENE_CONTEXT_PROJECTION_ENABLED = "0";
    const parent = {
      work_id: "work-1",
      tsid: "scene_route_1",
      title: "Arc",
      chapter_number: 1,
      chapter_title: null,
      summary: "",
      tags: [],
      story_images_v2: [],
      discovery_source_review_id: "rev-story-1",
      frame_provenance_v1: [],
    };
    getByTsidMock.mockResolvedValue(parent);
    updateMock.mockResolvedValue(parent);

    const { persistReadingFrameFromSceneStaging } = await import(
      "@/lib/rollout/reading-frame-persist"
    );

    const result = await persistReadingFrameFromSceneStaging(
      {} as never,
      "work-1",
      {
        workId: "work-1",
        sourceReviewId: "rev-scene-2",
        parentStorySourceReviewId: "rev-story-1",
        parentStoryTitle: "Arc",
        chapter_number: 1,
        title: "Courtyard",
        acceptedAt: "2026-08-08T00:00:00.000Z",
      },
      { parentRouteTsid: "scene_route_1" }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contextPath).toBe(false);
    expect(result.contextId).toBeUndefined();
    const options = updateMock.mock.calls[0]?.[5];
    expect(options).toBeUndefined();
  });
});
