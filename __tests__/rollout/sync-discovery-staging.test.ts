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
  updateCharacterStagingInRolloutQueue,
  updateSceneStagingInRolloutQueue,
  updateStoryStagingInRolloutQueue,
} from "@/lib/rollout/sync-discovery-staging";
import {
  dismissStoryStagingItem,
  deleteDismissedStoryStagingItem,
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

  it("recovers location staging from accepted review items when snapshot has no acceptedLocations", () => {
    const snapshot: DiscoveryReviewSnapshot = {
      sessionId: "sess-1",
      workId: "work-1",
      operatorId: "op-1",
      session: {} as DiscoveryReviewSnapshot["session"],
      candidates: [],
      reviewItems: [
        {
          reviewId: "rev-loc-recover",
          status: "accepted",
          candidate: {
            candidateId: "cand-loc",
            candidateType: "location",
            workId: "work-1",
            displayName: "Zhuozhou",
            summary: "Commandery",
            fields: { name: "Zhuozhou", region: "Youzhou", description: "Town" },
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
    expect(queue.locationStaging).toHaveLength(1);
    expect(queue.locationStaging?.[0]?.name).toBe("Zhuozhou");
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

  it("deletes dismissed story staging without restoring or re-importing", () => {
    const staging = {
      workId: "work-1",
      sourceReviewId: "rev-delete",
      sourceCandidateId: "cand-delete",
      title: "Delete me",
      summary: "s",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    };
    const dismissed = dismissStoryStagingItem(
      mergeRolloutQueue(loadRolloutQueue("work-1", "op-1"), {
        storyUnits: [staging],
      }),
      "rev-delete"
    );
    const deleted = deleteDismissedStoryStagingItem(dismissed, "rev-delete");
    saveRolloutQueue("work-1", "op-1", deleted);
    expect(deleted.storyStaging).toHaveLength(0);
    expect(deleted.dismissedStoryStaging).toHaveLength(0);
    expect(deleted.dismissedStoryReviewIds).toContain("rev-delete");

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
    expect(synced.dismissedStoryStaging).toHaveLength(0);
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

  it("keeps scene staging order when updating a middle frame's cast", () => {
    const parent = "rev-story-1";
    const frames = [
      {
        workId: "work-1",
        sourceReviewId: "rev-scene-a",
        parentStorySourceReviewId: parent,
        chapter_number: 1,
        title: "Frame A",
        acceptedAt: "2026-07-05T00:00:00.000Z",
      },
      {
        workId: "work-1",
        sourceReviewId: "rev-scene-b",
        parentStorySourceReviewId: parent,
        chapter_number: 1,
        title: "Frame B",
        acceptedAt: "2026-07-05T00:00:01.000Z",
      },
      {
        workId: "work-1",
        sourceReviewId: "rev-scene-c",
        parentStorySourceReviewId: parent,
        chapter_number: 1,
        title: "Frame C",
        acceptedAt: "2026-07-05T00:00:02.000Z",
      },
    ];
    for (const frame of frames) {
      appendSceneStagingToRolloutQueue("work-1", "op-1", frame);
    }

    updateSceneStagingInRolloutQueue("work-1", "op-1", {
      ...frames[1],
      title: "Frame B edited",
      rendererExpression: {
        environment: "courtyard",
        characters: [{ role: "Liu Bei", visual: "present" }],
        action: "standing",
        composition: "wide view",
      },
    });

    const queue = loadRolloutQueue("work-1", "op-1");
    expect(queue.readingRouteStaging.map((s) => s.sourceReviewId)).toEqual([
      "rev-scene-a",
      "rev-scene-b",
      "rev-scene-c",
    ]);
    expect(queue.readingRouteStaging[1]?.title).toBe("Frame B edited");
  });

  it("keeps story and character staging order when editing in place", () => {
    appendStoryStagingToRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-story-a",
      title: "Story A",
      summary: "a",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });
    appendStoryStagingToRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-story-b",
      title: "Story B",
      summary: "b",
      acceptedAt: "2026-07-05T00:00:01.000Z",
    });
    appendCharacterStagingToRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-char-a",
      name: "Liu Bei",
      house: "Shu",
      description: "sworn",
      signatureQuote: null,
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });
    appendCharacterStagingToRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-char-b",
      name: "Guan Yu",
      house: "Shu",
      description: "general",
      signatureQuote: null,
      acceptedAt: "2026-07-05T00:00:01.000Z",
    });

    updateStoryStagingInRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-story-a",
      title: "Story A edited",
      summary: "a",
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });
    updateCharacterStagingInRolloutQueue("work-1", "op-1", {
      workId: "work-1",
      sourceReviewId: "rev-char-a",
      name: "Liu Bei",
      house: "Shu",
      description: "edited",
      signatureQuote: null,
      acceptedAt: "2026-07-05T00:00:00.000Z",
    });

    const queue = loadRolloutQueue("work-1", "op-1");
    expect(queue.storyStaging.map((s) => s.sourceReviewId)).toEqual([
      "rev-story-a",
      "rev-story-b",
    ]);
    expect(queue.storyStaging[0]?.title).toBe("Story A edited");
    expect(queue.characterStaging?.map((s) => s.sourceReviewId)).toEqual([
      "rev-char-a",
      "rev-char-b",
    ]);
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
