/**
 * SPEC-ROL-001 — rollout queue storage tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadRolloutQueue,
  markStoryReviewIdProcessed,
  mergeRolloutQueue,
  removeStoryStagingByReviewId,
  saveRolloutQueue,
} from "@/lib/rollout/rollout-queue-storage";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  });
});

describe("rollout queue storage", () => {
  it("persists and loads queue by workId and operatorId", () => {
    const queue = {
      workId: "work-1",
      storyStaging: [
        {
          workId: "work-1",
          sourceReviewId: "r1",
          title: "Story A",
          summary: "s",
          acceptedAt: "2026-07-05T00:00:00.000Z",
        },
      ],
      sceneStaging: [],
      updatedAt: "2026-07-05T00:00:00.000Z",
    };

    saveRolloutQueue("work-1", "op-1", queue);
    const loaded = loadRolloutQueue("work-1", "op-1");
    expect(loaded.storyStaging).toHaveLength(1);
    expect(loaded.storyStaging[0].title).toBe("Story A");
  });

  it("merges staging without duplicates", () => {
    const base = loadRolloutQueue("work-1", "op-1");
    const merged = mergeRolloutQueue(base, {
      storyUnits: [
        {
          workId: "work-1",
          sourceReviewId: "r1",
          title: "Story A",
          summary: "s",
          acceptedAt: "2026-07-05T00:00:00.000Z",
        },
        {
          workId: "work-1",
          sourceReviewId: "r1",
          title: "Story A",
          summary: "s",
          acceptedAt: "2026-07-05T00:00:00.000Z",
        },
      ],
    });
    expect(merged.storyStaging).toHaveLength(1);
  });

  it("removes story staging by sourceReviewId", () => {
    const queue = mergeRolloutQueue(loadRolloutQueue("work-1", "op-1"), {
      storyUnits: [
        {
          workId: "work-1",
          sourceReviewId: "r1",
          title: "Story A",
          summary: "s",
          acceptedAt: "2026-07-05T00:00:00.000Z",
        },
      ],
    });
    const next = removeStoryStagingByReviewId(queue, "r1");
    expect(next.storyStaging).toHaveLength(0);
  });

  it("marks story review id processed and blocks re-import via processed list", () => {
    const queue = mergeRolloutQueue(loadRolloutQueue("work-1", "op-1"), {
      storyUnits: [
        {
          workId: "work-1",
          sourceReviewId: "r1",
          title: "Story A",
          summary: "s",
          acceptedAt: "2026-07-05T00:00:00.000Z",
        },
      ],
    });
    const next = markStoryReviewIdProcessed(queue, "r1");
    expect(next.storyStaging).toHaveLength(0);
    expect(next.processedStoryReviewIds).toContain("r1");
  });
});
