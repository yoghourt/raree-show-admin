/**
 * SPEC-ROL-001 — sync Discovery accepted staging into Rollout queue (client)
 */

import type {
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
  removeSceneStagingByReviewId,
  removeStoryStagingByReviewId,
  saveRolloutQueue,
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
    sceneStaging: [
      ...current.sceneStaging.filter(
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
