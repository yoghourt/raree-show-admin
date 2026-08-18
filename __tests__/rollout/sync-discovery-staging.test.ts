/**
 * SPEC-ROL-001 — sync Discovery staging into Rollout queue
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscoveryReviewSnapshot } from "@/lib/discovery/review-session-storage";
import {
  appendCharacterStagingToRolloutQueue,
  appendSceneStagingToRolloutQueue,
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
          sourceCandidateId: "cand-story-1",
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

  it("recovers character staging from accepted review items when snapshot has no acceptedCharacters", () => {
    const snapshot: DiscoveryReviewSnapshot = {
      sessionId: "sess-1",
      workId: "work-1",
      operatorId: "op-1",
      session: {} as DiscoveryReviewSnapshot["session"],
      candidates: [],
      reviewItems: [
        {
          reviewId: "rev-char-recover",
          status: "accepted",
          candidate: {
            candidateId: "cand-char",
            candidateType: "character",
            workId: "work-1",
            displayName: "Guan Yu",
            summary: "Oath brother",
            fields: { name: "Guan Yu", house: "Shu", description: "General" },
          },
        },
      ],
      acceptedStoryUnits: [],
      acceptedSceneCandidates: [],
      savedAt: "2026-07-05T00:00:00.000Z",
    };
    store.set(
      "discovery_review_snapshot:work-1:op-1:sess-1",
      JSON.stringify(snapshot)
    );
    const queue = syncRolloutQueueFromDiscovery("work-1", "op-1");
    expect(queue.characterStaging).toHaveLength(1);
    expect(queue.characterStaging?.[0]?.name).toBe("Guan Yu");
  });

  it("appends story staging immediately on accept path", () => {
    appendStoryStagingToRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-2",
      sourceCandidateId: "cand-2",
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
          sourceCandidateId: "cand-done",
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
      sourceCandidateId: "cand-dismiss",
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

  it("passes parent Story fields on scene staging into rollout queue", () => {
    appendSceneStagingToRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-scene-1",
      parentStorySourceReviewId: "rev-story-1",
      parentStoryTitle: "Northern arc",
      chapter_number: 1,
      title: "Courtyard",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });
    const queue = loadRolloutQueue("work-1", "op-1");
    expect(queue.readingRouteStaging).toHaveLength(1);
    expect(queue.readingRouteStaging[0]?.parentStorySourceReviewId).toBe(
      "rev-story-1"
    );
    expect(queue.readingRouteStaging[0]?.parentStoryTitle).toBe("Northern arc");
  });

  it("appends character staging immediately on accept path", () => {
    appendCharacterStagingToRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-char-1",
      sourceCandidateId: "cand-char-1",
      name: "Liu Bei",
      house: "Shu",
      description: "Sworn brother",
      signatureQuote: null,
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });
    const queue = loadRolloutQueue("work-1", "op-1");
    expect(queue.characterStaging).toHaveLength(1);
    expect(queue.characterStaging?.[0]?.name).toBe("Liu Bei");
  });

  it("reads legacy sceneStaging alias from storage", () => {
    store.set(
      "rollout_queue:work-1:op-1",
      JSON.stringify({
        workId: "work-1",
        storyStaging: [],
        sceneStaging: [
          {
            workId: "work-1",
            sourceReviewId: "rev-legacy",
            parentStorySourceReviewId: "rev-parent",
            parentStoryTitle: "Parent",
            chapter_number: 2,
            title: "Legacy Scene",
            acceptedAt: "2026-07-05T00:00:00.000Z",
          },
        ],
        updatedAt: "2026-07-05T00:00:00.000Z",
      })
    );
    const queue = loadRolloutQueue("work-1", "op-1");
    expect(queue.readingRouteStaging).toHaveLength(1);
    expect(queue.readingRouteStaging[0]?.title).toBe("Legacy Scene");
  });
});
