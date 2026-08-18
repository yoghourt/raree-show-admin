/**
 * SPEC-ROL-001 — sync Discovery accepted staging into Rollout queue (client)
 */

import type {
  AcceptedCharacterStaging,
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import {
  extractStagingFromDiscoverySnapshots,
  findDiscoverySnapshotsForWork,
} from "@/lib/rollout/staging-import";
import {
  filterPendingStaging,
  loadRolloutQueue,
  mergeRolloutQueue,
  removeCharacterStagingByReviewId,
  removeSceneStagingByReviewId,
  removeStoryStagingByReviewId,
  saveRolloutQueue,
  shouldImportCharacterStaging,
  shouldImportSceneStaging,
  shouldImportStoryStaging,
} from "@/lib/rollout/rollout-queue-storage";
import type { RolloutQueueSnapshot } from "@/lib/rollout/types";

export function syncRolloutQueueFromDiscovery(
  workId: string,
  operatorId: string
): RolloutQueueSnapshot {
  if (!workId || !operatorId) {
    return loadRolloutQueue(workId, operatorId);
  }

  const current = filterPendingStaging(loadRolloutQueue(workId, operatorId));
  const snapshots = findDiscoverySnapshotsForWork(workId, operatorId);
  const imported = extractStagingFromDiscoverySnapshots(snapshots);

  const filteredImport = {
    storyUnits: imported.storyUnits.filter((item) =>
      shouldImportStoryStaging(current, item.sourceReviewId)
    ),
    sceneCandidates: imported.sceneCandidates.filter((item) =>
      shouldImportSceneStaging(current, item.sourceReviewId)
    ),
    characterStaging: imported.characterStaging.filter((item) =>
      shouldImportCharacterStaging(current, item.sourceReviewId)
    ),
  };

  const merged = filterPendingStaging(
    mergeRolloutQueue(current, filteredImport)
  );
  saveRolloutQueue(workId, operatorId, merged);
  return merged;
}

export function appendStoryStagingToRolloutQueue(
  workId: string,
  operatorId: string,
  staging: AcceptedStoryUnitStaging
): void {
  if (!workId || !operatorId) {
    return;
  }
  const merged = mergeRolloutQueue(loadRolloutQueue(workId, operatorId), {
    storyUnits: [staging],
  });
  saveRolloutQueue(workId, operatorId, merged);
}

export function appendSceneStagingToRolloutQueue(
  workId: string,
  operatorId: string,
  staging: AcceptedSceneCandidateStaging
): void {
  if (!workId || !operatorId) {
    return;
  }
  const merged = mergeRolloutQueue(loadRolloutQueue(workId, operatorId), {
    sceneCandidates: [staging],
  });
  saveRolloutQueue(workId, operatorId, merged);
}

export function appendCharacterStagingToRolloutQueue(
  workId: string,
  operatorId: string,
  staging: AcceptedCharacterStaging
): void {
  if (!workId || !operatorId) {
    return;
  }
  const merged = mergeRolloutQueue(loadRolloutQueue(workId, operatorId), {
    characterStaging: [staging],
  });
  saveRolloutQueue(workId, operatorId, merged);
}

export function updateStoryStagingInRolloutQueue(
  workId: string,
  operatorId: string,
  staging: AcceptedStoryUnitStaging
): void {
  if (!workId || !operatorId) {
    return;
  }
  const current = loadRolloutQueue(workId, operatorId);
  const next = {
    ...current,
    storyStaging: [
      ...current.storyStaging.filter(
        (item) => item.sourceReviewId !== staging.sourceReviewId
      ),
      staging,
    ],
    updatedAt: new Date().toISOString(),
  };
  saveRolloutQueue(workId, operatorId, next);
}

export function updateSceneStagingInRolloutQueue(
  workId: string,
  operatorId: string,
  staging: AcceptedSceneCandidateStaging
): void {
  if (!workId || !operatorId) {
    return;
  }
  const current = loadRolloutQueue(workId, operatorId);
  const next = {
    ...current,
    readingRouteStaging: [
      ...current.readingRouteStaging.filter(
        (item) => item.sourceReviewId !== staging.sourceReviewId
      ),
      staging,
    ],
    updatedAt: new Date().toISOString(),
  };
  saveRolloutQueue(workId, operatorId, next);
}

export function updateCharacterStagingInRolloutQueue(
  workId: string,
  operatorId: string,
  staging: AcceptedCharacterStaging
): void {
  if (!workId || !operatorId) {
    return;
  }
  const current = loadRolloutQueue(workId, operatorId);
  const next = {
    ...current,
    characterStaging: [
      ...(current.characterStaging ?? []).filter(
        (item) => item.sourceReviewId !== staging.sourceReviewId
      ),
      staging,
    ],
    updatedAt: new Date().toISOString(),
  };
  saveRolloutQueue(workId, operatorId, next);
}

export function removeStoryStagingFromRolloutQueue(
  workId: string,
  operatorId: string,
  sourceReviewId: string
): void {
  if (!workId || !operatorId) {
    return;
  }
  const current = loadRolloutQueue(workId, operatorId);
  saveRolloutQueue(
    workId,
    operatorId,
    removeStoryStagingByReviewId(current, sourceReviewId)
  );
}

export function removeSceneStagingFromRolloutQueue(
  workId: string,
  operatorId: string,
  sourceReviewId: string
): void {
  if (!workId || !operatorId) {
    return;
  }
  const current = loadRolloutQueue(workId, operatorId);
  saveRolloutQueue(
    workId,
    operatorId,
    removeSceneStagingByReviewId(current, sourceReviewId)
  );
}

export function removeCharacterStagingFromRolloutQueue(
  workId: string,
  operatorId: string,
  sourceReviewId: string
): void {
  if (!workId || !operatorId) {
    return;
  }
  const current = loadRolloutQueue(workId, operatorId);
  saveRolloutQueue(
    workId,
    operatorId,
    removeCharacterStagingByReviewId(current, sourceReviewId)
  );
}
