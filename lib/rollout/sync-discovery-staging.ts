/**
 * SPEC-ROL-001 — sync Discovery accepted staging into Rollout queue (client)
 */

import type {
  AcceptedCharacterStaging,
  AcceptedLocationStaging,
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import { readerFacingCharacterDescription } from "@/lib/prompts/avatar";
import {
  extractStagingFromDiscoverySnapshots,
  findDiscoverySnapshotsForWork,
} from "@/lib/rollout/staging-import";
import {
  filterPendingStaging,
  loadRolloutQueue,
  mergeRolloutQueue,
  removeCharacterStagingByReviewId,
  removeLocationStagingByReviewId,
  removeSceneStagingByReviewId,
  removeStoryStagingByReviewId,
  saveRolloutQueue,
  shouldImportCharacterStaging,
  shouldImportLocationStaging,
  shouldImportSceneStaging,
  shouldImportStoryStaging,
} from "@/lib/rollout/rollout-queue-storage";
import type { RolloutQueueSnapshot } from "@/lib/rollout/types";

/**
 * Replace an existing staging item in place so narrative/frame order is
 * preserved. Filter-then-append would move the edited item to the end
 * (e.g. changing a frame's cast shuffled 画面 order vs confirm-time order).
 */
function replaceBySourceReviewId<T extends { sourceReviewId: string }>(
  items: T[],
  next: T
): T[] {
  const index = items.findIndex(
    (item) => item.sourceReviewId === next.sourceReviewId
  );
  if (index === -1) {
    return [...items, next];
  }
  const copy = items.slice();
  copy[index] = next;
  return copy;
}

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
    locationStaging: imported.locationStaging.filter((item) =>
      shouldImportLocationStaging(current, item.sourceReviewId)
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
    characterStaging: [
      {
        ...staging,
        description: readerFacingCharacterDescription(
          staging.description ?? ""
        ),
      },
    ],
  });
  saveRolloutQueue(workId, operatorId, merged);
}

export function appendLocationStagingToRolloutQueue(
  workId: string,
  operatorId: string,
  staging: AcceptedLocationStaging
): void {
  if (!workId || !operatorId) {
    return;
  }
  const merged = mergeRolloutQueue(loadRolloutQueue(workId, operatorId), {
    locationStaging: [staging],
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
    storyStaging: replaceBySourceReviewId(current.storyStaging, staging),
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
    readingRouteStaging: replaceBySourceReviewId(
      current.readingRouteStaging,
      staging
    ),
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
  const sanitized: AcceptedCharacterStaging = {
    ...staging,
    description: readerFacingCharacterDescription(staging.description ?? ""),
  };
  const current = loadRolloutQueue(workId, operatorId);
  const next = {
    ...current,
    characterStaging: replaceBySourceReviewId(
      current.characterStaging ?? [],
      sanitized
    ),
    updatedAt: new Date().toISOString(),
  };
  saveRolloutQueue(workId, operatorId, next);
}

export function updateLocationStagingInRolloutQueue(
  workId: string,
  operatorId: string,
  staging: AcceptedLocationStaging
): void {
  if (!workId || !operatorId) {
    return;
  }
  const current = loadRolloutQueue(workId, operatorId);
  const next = {
    ...current,
    locationStaging: replaceBySourceReviewId(
      current.locationStaging ?? [],
      staging
    ),
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

export function removeLocationStagingFromRolloutQueue(
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
    removeLocationStagingByReviewId(current, sourceReviewId)
  );
}
