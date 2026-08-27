/**
 * SPEC-ROL-001 — client Rollout queue (sessionStorage, v1)
 */

import type {
  AcceptedCharacterStaging,
  AcceptedLocationStaging,
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import { readerFacingCharacterDescription } from "@/lib/prompts/avatar";
import type {
  ApprovedStoryUnit,
  ProjectedReadingRouteRecord,
  RolloutQueueSnapshot,
} from "@/lib/rollout/types";
import {
  bindSceneStagingCastPlaceToArchive,
  seedSceneStagingCastPlaceFromNames,
  type SceneStagingArchiveCatalog,
} from "@/lib/rollout/scene-staging-context-edit";

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
    characterStaging: [],
    locationStaging: [],
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
      characterStaging: (parsed.characterStaging ?? []).map((item) => ({
        ...item,
        description: readerFacingCharacterDescription(item.description ?? ""),
      })),
      locationStaging: parsed.locationStaging ?? [],
      processedStoryReviewIds: parsed.processedStoryReviewIds ?? [],
      processedReadingRouteReviewIds: parsed.processedReadingRouteReviewIds ?? parsed.processedSceneReviewIds ?? [],
      processedCharacterReviewIds: parsed.processedCharacterReviewIds ?? [],
      processedLocationReviewIds: parsed.processedLocationReviewIds ?? [],
      dismissedStoryStaging: parsed.dismissedStoryStaging ?? [],
      dismissedReadingRouteStaging: parsed.dismissedReadingRouteStaging ?? parsed.dismissedSceneStaging ?? [],
      dismissedCharacterStaging: parsed.dismissedCharacterStaging ?? [],
      dismissedLocationStaging: parsed.dismissedLocationStaging ?? [],
      dismissedStoryReviewIds: parsed.dismissedStoryReviewIds ?? [],
      dismissedReadingRouteReviewIds: parsed.dismissedReadingRouteReviewIds ?? parsed.dismissedSceneReviewIds ?? [],
      dismissedCharacterReviewIds: parsed.dismissedCharacterReviewIds ?? [],
      dismissedLocationReviewIds: parsed.dismissedLocationReviewIds ?? [],
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

function dedupeCharacterStaging(
  items: AcceptedCharacterStaging[]
): AcceptedCharacterStaging[] {
  const seen = new Set<string>();
  const out: AcceptedCharacterStaging[] = [];
  for (const item of items) {
    const key = `${item.sourceReviewId}:${item.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      ...item,
      description: readerFacingCharacterDescription(item.description ?? ""),
    });
  }
  return out;
}

function dedupeLocationStaging(
  items: AcceptedLocationStaging[]
): AcceptedLocationStaging[] {
  const seen = new Set<string>();
  const out: AcceptedLocationStaging[] = [];
  for (const item of items) {
    const key = `${item.sourceReviewId}:${item.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

function uniqueEntityNames(items: Array<{ name: string }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function seedScenesFromQueuedEntities(
  queue: RolloutQueueSnapshot
): RolloutQueueSnapshot {
  const names = {
    characters: uniqueEntityNames(queue.characterStaging ?? []),
    locations: uniqueEntityNames(queue.locationStaging ?? []),
  };
  if (names.characters.length === 0 && names.locations.length === 0) {
    return queue;
  }
  return {
    ...queue,
    readingRouteStaging: queue.readingRouteStaging.map((staging) =>
      seedSceneStagingCastPlaceFromNames(staging, names)
    ),
  };
}

export function rematchQueueSceneStagingToArchive(
  queue: RolloutQueueSnapshot,
  archive: SceneStagingArchiveCatalog
): RolloutQueueSnapshot {
  return {
    ...queue,
    readingRouteStaging: queue.readingRouteStaging.map((staging) =>
      bindSceneStagingCastPlaceToArchive(staging, archive)
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function mergeRolloutQueue(
  current: RolloutQueueSnapshot,
  incoming: {
    storyUnits?: AcceptedStoryUnitStaging[];
    sceneCandidates?: AcceptedSceneCandidateStaging[];
    characterStaging?: AcceptedCharacterStaging[];
    locationStaging?: AcceptedLocationStaging[];
  }
): RolloutQueueSnapshot {
  return seedScenesFromQueuedEntities({
    workId: current.workId,
    storyStaging: dedupeStoryStaging([
      ...current.storyStaging,
      ...(incoming.storyUnits ?? []),
    ]),
    readingRouteStaging: dedupeSceneStaging([
      ...current.readingRouteStaging,
      ...(incoming.sceneCandidates ?? []),
    ]),
    characterStaging: dedupeCharacterStaging([
      ...(current.characterStaging ?? []),
      ...(incoming.characterStaging ?? []),
    ]),
    locationStaging: dedupeLocationStaging([
      ...(current.locationStaging ?? []),
      ...(incoming.locationStaging ?? []),
    ]),
    processedStoryReviewIds: current.processedStoryReviewIds ?? [],
    processedReadingRouteReviewIds: current.processedReadingRouteReviewIds ?? [],
    processedCharacterReviewIds: current.processedCharacterReviewIds ?? [],
    processedLocationReviewIds: current.processedLocationReviewIds ?? [],
    dismissedStoryStaging: current.dismissedStoryStaging ?? [],
    dismissedReadingRouteStaging: current.dismissedReadingRouteStaging ?? [],
    dismissedCharacterStaging: current.dismissedCharacterStaging ?? [],
    dismissedLocationStaging: current.dismissedLocationStaging ?? [],
    dismissedStoryReviewIds: current.dismissedStoryReviewIds ?? [],
    dismissedReadingRouteReviewIds: current.dismissedReadingRouteReviewIds ?? [],
    dismissedCharacterReviewIds: current.dismissedCharacterReviewIds ?? [],
    dismissedLocationReviewIds: current.dismissedLocationReviewIds ?? [],
    projectedReadingRoutes: current.projectedReadingRoutes ?? [],
    updatedAt: new Date().toISOString(),
  });
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

export function removeCharacterStagingByReviewId(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...queue,
    characterStaging: (queue.characterStaging ?? []).filter(
      (s) => s.sourceReviewId !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function removeLocationStagingByReviewId(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...queue,
    locationStaging: (queue.locationStaging ?? []).filter(
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

export function markCharacterReviewIdProcessed(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...removeCharacterStagingByReviewId(queue, sourceReviewId),
    processedCharacterReviewIds: addProcessedReviewId(
      queue.processedCharacterReviewIds,
      sourceReviewId
    ),
  };
}

export function markLocationReviewIdProcessed(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  return {
    ...removeLocationStagingByReviewId(queue, sourceReviewId),
    processedLocationReviewIds: addProcessedReviewId(
      queue.processedLocationReviewIds,
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

function blockedCharacterReviewIds(queue: RolloutQueueSnapshot): Set<string> {
  return new Set([
    ...(queue.processedCharacterReviewIds ?? []),
    ...(queue.dismissedCharacterReviewIds ?? []),
  ]);
}

function blockedLocationReviewIds(queue: RolloutQueueSnapshot): Set<string> {
  return new Set([
    ...(queue.processedLocationReviewIds ?? []),
    ...(queue.dismissedLocationReviewIds ?? []),
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

export function dismissCharacterStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.characterStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return {
    ...removeCharacterStagingByReviewId(queue, sourceReviewId),
    dismissedCharacterStaging: dedupeCharacterStaging([
      ...(queue.dismissedCharacterStaging ?? []),
      item,
    ]),
    dismissedCharacterReviewIds: addProcessedReviewId(
      queue.dismissedCharacterReviewIds,
      sourceReviewId
    ),
  };
}

export function restoreCharacterStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.dismissedCharacterStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return mergeRolloutQueue(
    {
      ...queue,
      dismissedCharacterStaging: (queue.dismissedCharacterStaging ?? []).filter(
        (staging) => staging.sourceReviewId !== sourceReviewId
      ),
      dismissedCharacterReviewIds: (queue.dismissedCharacterReviewIds ?? []).filter(
        (id) => id !== sourceReviewId
      ),
    },
    { characterStaging: [item] }
  );
}

export function dismissLocationStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.locationStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return {
    ...removeLocationStagingByReviewId(queue, sourceReviewId),
    dismissedLocationStaging: dedupeLocationStaging([
      ...(queue.dismissedLocationStaging ?? []),
      item,
    ]),
    dismissedLocationReviewIds: addProcessedReviewId(
      queue.dismissedLocationReviewIds,
      sourceReviewId
    ),
  };
}

export function restoreLocationStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.dismissedLocationStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return mergeRolloutQueue(
    {
      ...queue,
      dismissedLocationStaging: (queue.dismissedLocationStaging ?? []).filter(
        (staging) => staging.sourceReviewId !== sourceReviewId
      ),
      dismissedLocationReviewIds: (queue.dismissedLocationReviewIds ?? []).filter(
        (id) => id !== sourceReviewId
      ),
    },
    { locationStaging: [item] }
  );
}

export function deleteDismissedStoryStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.dismissedStoryStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return {
    ...queue,
    dismissedStoryStaging: (queue.dismissedStoryStaging ?? []).filter(
      (staging) => staging.sourceReviewId !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteDismissedSceneStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.dismissedReadingRouteStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return {
    ...queue,
    dismissedReadingRouteStaging: (queue.dismissedReadingRouteStaging ?? []).filter(
      (staging) => staging.sourceReviewId !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteDismissedCharacterStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.dismissedCharacterStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return {
    ...queue,
    dismissedCharacterStaging: (queue.dismissedCharacterStaging ?? []).filter(
      (staging) => staging.sourceReviewId !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function deleteDismissedLocationStagingItem(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): RolloutQueueSnapshot {
  const item = (queue.dismissedLocationStaging ?? []).find(
    (staging) => staging.sourceReviewId === sourceReviewId
  );
  if (!item) {
    return queue;
  }

  return {
    ...queue,
    dismissedLocationStaging: (queue.dismissedLocationStaging ?? []).filter(
      (staging) => staging.sourceReviewId !== sourceReviewId
    ),
    updatedAt: new Date().toISOString(),
  };
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

export function shouldImportCharacterStaging(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): boolean {
  return !blockedCharacterReviewIds(queue).has(sourceReviewId);
}

export function shouldImportLocationStaging(
  queue: RolloutQueueSnapshot,
  sourceReviewId: string
): boolean {
  return !blockedLocationReviewIds(queue).has(sourceReviewId);
}

export function filterPendingStaging(queue: RolloutQueueSnapshot): RolloutQueueSnapshot {
  const processedStory = blockedStoryReviewIds(queue);
  const processedScene = blockedSceneReviewIds(queue);
  const processedCharacter = blockedCharacterReviewIds(queue);
  const processedLocation = blockedLocationReviewIds(queue);

  return {
    ...queue,
    storyStaging: queue.storyStaging.filter(
      (item) => !processedStory.has(item.sourceReviewId)
    ),
    readingRouteStaging: queue.readingRouteStaging.filter(
      (item) => !processedScene.has(item.sourceReviewId)
    ),
    characterStaging: (queue.characterStaging ?? []).filter(
      (item) => !processedCharacter.has(item.sourceReviewId)
    ),
    locationStaging: (queue.locationStaging ?? []).filter(
      (item) => !processedLocation.has(item.sourceReviewId)
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
