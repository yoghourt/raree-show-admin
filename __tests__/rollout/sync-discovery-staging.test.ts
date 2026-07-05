/**
 * SPEC-ROL-001 — sync Discovery staging into Rollout queue
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscoveryReviewSnapshot } from "@/lib/discovery/review-session-storage";
import {
  appendStoryStagingToRolloutQueue,
  syncRolloutQueueFromDiscovery,
} from "@/lib/rollout/sync-discovery-staging";
import {
  dismissStoryStagingItem,
  loadRolloutQueue,
  markStoryReviewIdProcessed,
  mergeRolloutQueue,
  restoreStoryStagingItem,
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
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  });
});

describe("sync-discovery-staging", () => {
  it("merges accepted story staging from Discovery snapshot on sync", () => {
    const snapshot: DiscoveryReviewSnapshot = {
      sessionId: "sess-1",
      workId: "work-1",
      operatorId: "op-1",
      session: {} as DiscoveryReviewSnapshot["session"],
      candidates: [],
      reviewItems: [],
      acceptedStoryUnits: [
        {
          workId: "work-1",
          sourceReviewId: "rev-1",
          title: "Northern arc",
          summary: "Story summary",
          acceptedAt: "2026-07-05T00:00:00.000Z",
        },
      ],
      acceptedSceneCandidates: [],
      savedAt: "2026-07-05T00:00:00.000Z",
    };

    store.set(
      "discovery_review_snapshot:work-1:op-1:sess-1",
      JSON.stringify(snapshot)
    );

    const queue = syncRolloutQueueFromDiscovery("work-1", "op-1");
    expect(queue.storyStaging).toHaveLength(1);
    expect(queue.storyStaging[0].title).toBe("Northern arc");
  });

  it("appends story staging immediately on accept path", () => {
    appendStoryStagingToRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-2",
      title: "Immediate",
      summary: "s",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    const queue = syncRolloutQueueFromDiscovery("work-1", "op-1");
    expect(queue.storyStaging.some((s) => s.sourceReviewId === "rev-2")).toBe(
      true
    );
  });

  it("does not re-import story staging after sourceReviewId is marked processed", () => {
    const snapshot: DiscoveryReviewSnapshot = {
      sessionId: "sess-1",
      workId: "work-1",
      operatorId: "op-1",
      session: {} as DiscoveryReviewSnapshot["session"],
      candidates: [],
      reviewItems: [],
      acceptedStoryUnits: [
        {
          workId: "work-1",
          sourceReviewId: "rev-done",
          title: "Done story",
          summary: "s",
          acceptedAt: "2026-07-05T00:00:00.000Z",
        },
      ],
      acceptedSceneCandidates: [],
      savedAt: "2026-07-05T00:00:00.000Z",
    };

    store.set(
      "discovery_review_snapshot:work-1:op-1:sess-1",
      JSON.stringify(snapshot)
    );

    const processed = markStoryReviewIdProcessed(
      loadRolloutQueue("work-1", "op-1"),
      "rev-done"
    );
    saveRolloutQueue("work-1", "op-1", processed);

    const queue = syncRolloutQueueFromDiscovery("work-1", "op-1");
    expect(queue.storyStaging).toHaveLength(0);
    expect(queue.processedStoryReviewIds).toContain("rev-done");
  });

  it("dismisses and restores story staging without re-import from discovery", () => {
    const staging = {
      workId: "work-1",
      sourceReviewId: "rev-dismiss",
      title: "Dismiss me",
      summary: "s",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    };
    const queue = dismissStoryStagingItem(
      mergeRolloutQueue(loadRolloutQueue("work-1", "op-1"), {
        storyUnits: [staging],
      }),
      "rev-dismiss"
    );
    saveRolloutQueue("work-1", "op-1", queue);
    expect(queue.storyStaging).toHaveLength(0);
    expect(queue.dismissedStoryStaging).toHaveLength(1);

    store.set(
      "discovery_review_snapshot:work-1:op-1:sess-1",
      JSON.stringify({
        sessionId: "sess-1",
        workId: "work-1",
        operatorId: "op-1",
        session: {},
        candidates: [],
        reviewItems: [],
        acceptedStoryUnits: [staging],
        acceptedSceneCandidates: [],
        savedAt: "2026-07-05T00:00:00.000Z",
      })
    );

    const synced = syncRolloutQueueFromDiscovery("work-1", "op-1");
    expect(synced.storyStaging).toHaveLength(0);

    const restored = restoreStoryStagingItem(synced, "rev-dismiss");
    expect(restored.storyStaging).toHaveLength(1);
    expect(restored.dismissedStoryStaging).toHaveLength(0);
  });
});
