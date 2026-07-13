/**
 * Hotfix — Projection Engine unit tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildProjectionValidationChecklist } from "@/lib/rollout/projection-engine";
import { projectionSceneStagingSchema } from "@/lib/rollout/schemas";

describe("projectionSceneStagingSchema", () => {
  it("requires parent Story refs", () => {
    const missing = projectionSceneStagingSchema.safeParse({
      workId: "work-1",
      sourceReviewId: "rev-scene",
      chapter_number: 1,
      title: "Courtyard",
      acceptedAt: "2026-07-12T00:00:00.000Z",
    });
    expect(missing.success).toBe(false);

    const ok = projectionSceneStagingSchema.safeParse({
      workId: "work-1",
      sourceReviewId: "rev-scene",
      parentStorySourceReviewId: "rev-story",
      parentStoryTitle: "Arrival",
      chapter_number: 1,
      title: "Courtyard",
      acceptedAt: "2026-07-12T00:00:00.000Z",
    });
    expect(ok.success).toBe(true);
  });
});

describe("buildProjectionValidationChecklist", () => {
  it("surfaces parent and field gates", () => {
    const items = buildProjectionValidationChecklist({
      hasParentStoryRef: true,
      parentStoryPersisted: false,
      fieldsValid: true,
      notAlreadyProjected: true,
      linkTargetOk: true,
    });
    expect(items.find((i) => i.id === "parent_persisted")?.ok).toBe(false);
    expect(items.find((i) => i.id === "fields")?.ok).toBe(true);
  });
});

describe("validateSceneProjection (mocked Hotfix)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("fails when parent Reading Route is not persisted", async () => {
    vi.doMock("@/lib/rollout/story-units", () => ({
      getActiveStoryUnitBySourceReviewId: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/rollout/reading-frame-persist", () => ({
      persistReadingFrameFromSceneStaging: vi.fn(),
      unpersistReadingFrame: vi.fn(),
    }));

    const { validateSceneProjection } = await import(
      "@/lib/rollout/projection-engine"
    );

    const result = await validateSceneProjection({} as never, {
      workId: "work-1",
      staging: {
        workId: "work-1",
        sourceReviewId: "rev-scene",
        parentStorySourceReviewId: "rev-story",
        parentStoryTitle: "Arc",
        chapter_number: 1,
        title: "Courtyard",
        acceptedAt: "2026-07-12T00:00:00.000Z",
      },
      mode: "create",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PARENT_STORY_NOT_PERSISTED");
    }
  });

  it("succeeds when parent Reading Route exists", async () => {
    vi.doMock("@/lib/rollout/story-units", () => ({
      getActiveStoryUnitBySourceReviewId: vi.fn().mockResolvedValue({
        id: "scene_parent",
        workId: "work-1",
        sourceReviewId: "rev-story",
        title: "Arc",
        summary: "",
        approvedAt: "2026-07-12T00:00:00.000Z",
        status: "active",
      }),
    }));
    vi.doMock("@/lib/rollout/reading-frame-persist", () => ({
      persistReadingFrameFromSceneStaging: vi.fn(),
      unpersistReadingFrame: vi.fn(),
    }));

    const { validateSceneProjection } = await import(
      "@/lib/rollout/projection-engine"
    );

    const result = await validateSceneProjection({} as never, {
      workId: "work-1",
      staging: {
        workId: "work-1",
        sourceReviewId: "rev-scene",
        parentStorySourceReviewId: "rev-story",
        parentStoryTitle: "Arc",
        chapter_number: 1,
        title: "Courtyard",
        acceptedAt: "2026-07-12T00:00:00.000Z",
      },
      mode: "create",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parentRouteTsid).toBe("scene_parent");
    }
  });
});

describe("executeSceneProjection (mocked Hotfix)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("appends Frame on parent Route without creating Approved Scene", async () => {
    vi.doMock("@/lib/rollout/story-units", () => ({
      getActiveStoryUnitBySourceReviewId: vi.fn().mockResolvedValue({
        id: "scene_parent",
        workId: "work-1",
        sourceReviewId: "rev-story",
        title: "Arc",
        summary: "",
        approvedAt: "2026-07-12T00:00:00.000Z",
        status: "active",
      }),
    }));
    vi.doMock("@/lib/rollout/reading-frame-persist", () => ({
      persistReadingFrameFromSceneStaging: vi.fn().mockResolvedValue({
        ok: true,
        readingRouteTsid: "scene_parent",
        frameIndex: 0,
        sourceReviewId: "rev-scene",
      }),
      unpersistReadingFrame: vi.fn(),
    }));

    const { executeSceneProjection } = await import(
      "@/lib/rollout/projection-engine"
    );

    const result = await executeSceneProjection({} as never, {
      workId: "work-1",
      staging: {
        workId: "work-1",
        sourceReviewId: "rev-scene",
        parentStorySourceReviewId: "rev-story",
        parentStoryTitle: "Arc",
        chapter_number: 1,
        title: "Courtyard",
        acceptedAt: "2026-07-12T00:00:00.000Z",
      },
      mode: "create",
      operatorId: "user-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.readingRouteTsid).toBe("scene_parent");
      expect(result.frameIndex).toBe(0);
      expect(result.approvedSceneUnit).toBeUndefined();
    }
  });
});
