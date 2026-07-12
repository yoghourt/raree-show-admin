/**
 * SPEC-ROL-001 — client Rollout queue (sessionStorage, v1)
 */

import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import type {
  ApprovedStoryUnit,
  ProjectedReadingRouteRecord,
  RolloutQueueSnapshot,
} from "@/lib/rollout/types";

const PREFIX = "rollout_queue:";
export const ROLLOUT_QUEUE_UPDATED_EVENT = "rollout-queue-updated";

function storageKey(workId: string, operatorId: string): string {
  return `${PREFIX}${workId}:${operatorId}`;
}

export function emptyRolloutQueue(
  workId: string,
  operatorId: string
): RolloutQueueSnapshot {
  return {
    workId,
    storyStaging: [],
    readingRouteStaging: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadRolloutQueue(
  workId: string,
  operatorId: string
): RolloutQueueSnapshot {
  if (typeof sessionStorage === "undefined") {
    return emptyRolloutQueue(workId, operatorId);
  }
  const raw = sessionStorage.getItem(storageKey(workId, operatorId));
  if (!raw) {
    return emptyRolloutQueue(workId, operatorId);
  }
  try {
    const parsed = JSON.parse(raw) as RolloutQueueSnapshot & {
      sceneStaging?: AcceptedSceneCandidateStaging[];
      processedSceneReviewIds?: string[];
      dismissedSceneStaging?: AcceptedSceneCandidateStaging[];
      dismissedSceneReviewIds?: string[];
      projectedScenes?: ProjectedReadingRouteRecord[];
    };
    if (parsed.workId !== workId) {
      return emptyRolloutQueue(workId, operatorId);
    }
    return {
      workId,
      storyStaging: parsed.storyStaging ?? [],
      readingRouteStaging: parsed.readingRouteStaging ?? parsed.sceneStaging ?? [],
      processedStoryReviewIds: parsed.processedStoryReviewIds ?? [],
      processedReadingRouteReviewIds: parsed.processedReadingRouteReviewIds ?? parsed.processedSceneReviewIds ?? [],
      dismissedStoryStaging: parsed.dismissedStoryStaging ?? [],
      dismissedReadingRouteStaging: parsed.dismissedReadingRouteStaging ?? parsed.dismissedSceneStaging ?? [],
      dismissedStoryReviewIds: parsed.dismissedStoryReviewIds ?? [],
      dismissedReadingRouteReviewIds: parsed.dismissedReadingRouteReviewIds ?? parsed.dismissedSceneReviewIds ?? [],
      projectedReadingRoutes: parsed.projectedReadingRoutes ?? parsed.projectedScenes ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyRolloutQueue(workId, operatorId);
  }
}

export function saveRolloutQueue(
  workId: string,
  operatorId: string,
  queue: RolloutQueueSnapshot
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(
    storageKey(workId, operatorId),
    JSON.stringify({
      ...queue,
      workId,
      // Prefer sceneStaging going forward; keep readingRouteStaging for Rollout UI / old readers
      sceneStaging: queue.readingRouteStaging,
      updatedAt: new Date().toISOString(),
    })
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ROLLOUT_QUEUE_UPDATED_EVENT, {
        detail: { workId, operatorId },
      })
    );
  }
}

function dedupeStoryStaging(
  items: AcceptedStoryUnitStaging[]
): AcceptedStoryUnitStaging[] {
  const seen = new Set<string>();
  const out: AcceptedStoryUnitStaging[] = [];
  for (const item of items) {
    const key = `${item.sourceReviewId}:${item.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeSceneStaging(
  items: AcceptedSceneCandidateStaging[]
): AcceptedSceneCandidateStaging[] {
  const seen = new Set<string>();
  const out: AcceptedSceneCandidateStaging[] = [];
  for (const item of items) {
    const key = `${item.sourceReviewId}:${item.title}:${item.chapter_number}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function mergeRolloutQueue(
  current: RolloutQueueSnapshot,
  incoming: {
    storyUnits?: AcceptedStoryUnitStaging[];
    sceneCandidates?: AcceptedSceneCandidateStaging[];
  }
): RolloutQueueSnapshot {
  return {
    workId: current.workId,
    storyStaging: dedupeStoryStaging([
      ...current.storyStaging,
      ...(incoming.storyUnits ?? []),
    ]),
    readingRouteStaging: dedupeSceneStaging([
      ...current.readingRouteStaging,
      ...(incoming.sceneCandidates ?? []),
    ]),
    processedStoryReviewIds: current.processedStoryReviewIds ?? [],
    processedReadingRouteReviewIds: current.processedReadingRouteReviewIds ?? [],
    dismissedStoryStaging: current.dismissedStoryStaging ?? [],
    dismissedReadingRouteStaging: current.dismissedReadingRouteStaging ?? [],
    dismissedStoryReviewIds: current.dismissedStoryReviewIds ?? [],
    dismissedReadingRouteReviewIds: current.dismissedReadingRouteReviewIds ?? [],
    projectedReadingRoutes: current.projectedReadingRoutes ?? [],
    updatedAt: new Date().toISOString(),
  };
}

export function removeStoryStagingByReviewId(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...queue,
    storyStaging: queue.storyStaging.filter(
      (s) => s.sourceReviewId !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function removeSceneStagingByReviewId(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...queue,
    readingRouteStaging: queue.readingRouteStaging.filter(
      (s) => s.sourceReviewId !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

function addProcessedReviewId(
  existing: string[] | undefined,
  sourceReviewId: string
): string[] {
  const next = new Set(existing ?? []);
  next.add(sourceReviewId);
  return [...next];
}

export function markStoryReviewIdProcessed(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...removeStoryStagingByReviewId(queue, sourceReviewId),
    processedStoryReviewIds: addProcessedReviewId(
      queue.processedStoryReviewIds,
      sourceReviewId
    ),
  };
}

export function markSceneReviewIdProcessed(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...removeSceneStagingByReviewId(queue, sourceReviewId),
    processedReadingRouteReviewIds: addProcessedReviewId(
      queue.processedReadingRouteReviewIds,
      sourceReviewId
    ),
  };
}

export function unmarkSceneReviewIdProcessed(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...queue,
    processedReadingRouteReviewIds: (queue.processedReadingRouteReviewIds ?? []).filter(
      (id) => id !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

function blockedStoryReviewIds(queue: RolloutQueueSnapshot): Set<string> {
  return new Set([
    ...(queue.processedStoryReviewIds ?? []),
    ...(queue.dismissedStoryReviewIds ?? []),
  ]);
}

function blockedSceneReviewIds(queue: RolloutQueueSnapshot): Set<string> {
  return new Set([
    ...(queue.processedReadingRouteReviewIds ?? []),
    ...(queue.dismissedReadingRouteReviewIds ?? []),
  ]);
}

export function dismissStoryStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = queue.storyStaging.find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return {
    ...removeStoryStagingByReviewId(queue, sourceReviewId),
    dismissedStoryStaging: dedupeStoryStaging([
      ...(queue.dismissedStoryStaging ?? []),
      item,
    ]),
    dismissedStoryReviewIds: addProcessedReviewId(
      queue.dismissedStoryReviewIds,
      sourceReviewId
    ),
  };
}

export function restoreStoryStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.dismissedStoryStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return mergeRolloutQueue(
    {
      ...queue,
      dismissedStoryStaging: (queue.dismissedStoryStaging ?? []).filter(
        (staging) => staging.sourceReviewId !== sourceReviewId
      ),
      dismissedStoryReviewIds: (queue.dismissedStoryReviewIds ?? []).filter(
        (id) => id !== sourceReviewId
      ),
    },
    { storyUnits: [item] }
  );
}

export function dismissSceneStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = queue.readingRouteStaging.find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return {
    ...removeSceneStagingByReviewId(queue, sourceReviewId),
    dismissedReadingRouteStaging: dedupeSceneStaging([
      ...(queue.dismissedReadingRouteStaging ?? []),
      item,
    ]),
    dismissedReadingRouteReviewIds: addProcessedReviewId(
      queue.dismissedReadingRouteReviewIds,
      sourceReviewId
    ),
  };
}

export function restoreSceneStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.dismissedReadingRouteStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return mergeRolloutQueue(
    {
      ...queue,
      dismissedReadingRouteStaging: (queue.dismissedReadingRouteStaging ?? []).filter(
        (staging) => staging.sourceReviewId !== sourceReviewId
      ),
      dismissedReadingRouteReviewIds: (queue.dismissedReadingRouteReviewIds ?? []).filter(
        (id) => id !== sourceReviewId
      ),
    },
    { sceneCandidates: [item] }
  );
}

export function recordProjectedScene(
  queue: RolloutQueueSnapshot,
  record: ProjectedReadingRouteRecord
): RolloutQueueSnapshot {
  const projectedReadingRoutes = [
    ...(queue.projectedReadingRoutes ?? []).filter(
      (item) => item.sourceReviewId !== record.sourceReviewId
    ),
    record,
  ];
  return {
    ...queue,
    projectedReadingRoutes,
    updatedAt: new Date().toISOString(),
  };
}

export function removeProjectedScene(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...queue,
    projectedReadingRoutes: (queue.projectedReadingRoutes ?? []).filter(
      (item) => item.sourceReviewId !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function findProjectedScene(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): ProjectedReadingRouteRecord | undefined {
  return (queue.projectedReadingRoutes ?? []).find(
    (item) => item.sourceReviewId === sourceReviewId
  );
}

export function findProjectedSceneByTsid(
  queue: RolloutQueueSnapshot,
  sceneTsid: string
): ProjectedReadingRouteRecord | undefined {
  return (queue.projectedReadingRoutes ?? []).find(
    (item) => item.sceneTsid === sceneTsid
  );
}

export function shouldImportStoryStaging(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): boolean {
  return !blockedStoryReviewIds(queue).has(sourceReviewId);
}

export function shouldImportSceneStaging(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): boolean {
  return !blockedSceneReviewIds(queue).has(sourceReviewId);
}

export function filterPendingStaging(queue: RolloutQueueSnapshot): RolloutQueueSnapshot {
  const processedStory = blockedStoryReviewIds(queue);
  const processedScene = blockedSceneReviewIds(queue);

  return {
    ...queue,
    storyStaging: queue.storyStaging.filter(
      (item) => !processedStory.has(item.sourceReviewId)
    ),
    readingRouteStaging: queue.readingRouteStaging.filter(
      (item) => !processedScene.has(item.sourceReviewId)
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function unmarkStoryReviewIdProcessed(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...queue,
    processedStoryReviewIds: (queue.processedStoryReviewIds ?? []).filter(
      (id) => id !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function reconcileStoryStagingWithPersistedUnits(
  queue: RolloutQueueSnapshot,
  persistedUnits: ApprovedStoryUnit[]
): RolloutQueueSnapshot {
  if (persistedUnits.length === 0) {
    return filterPendingStaging(queue);
  }

  let next = queue;
  for (const unit of persistedUnits) {
    next = markStoryReviewIdProcessed(next, unit.sourceReviewId);
  }
  return next;
}
