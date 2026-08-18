/**
 * SPEC-ROL-001 — import staging from Discovery review snapshots (client)
 */

import type {
  AcceptedCharacterStaging,
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import { characterStagingFromAcceptedReviewItems } from "@/lib/discovery/review-state";
import type { DiscoveryReviewSnapshot } from "@/lib/discovery/review-session-storage";

const DISCOVERY_PREFIX = "discovery_review_snapshot:";

export function findDiscoverySnapshotsForWork(
  workId: string,
  operatorId: string
): DiscoveryReviewSnapshot[] {
  if (typeof sessionStorage === "undefined") {
    return [];
  }

  const out: DiscoveryReviewSnapshot[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(DISCOVERY_PREFIX)) {
      continue;
    }
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as DiscoveryReviewSnapshot;
      if (
        parsed.workId === workId &&
        parsed.operatorId === operatorId
      ) {
        out.push(parsed);
      }
    } catch {
      // skip invalid
    }
  }

  out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return out;
}

export function extractStagingFromDiscoverySnapshots(
  snapshots: DiscoveryReviewSnapshot[]
): {
  storyUnits: AcceptedStoryUnitStaging[];
  sceneCandidates: AcceptedSceneCandidateStaging[];
  characterStaging: AcceptedCharacterStaging[];
} {
  const storyUnits: AcceptedStoryUnitStaging[] = [];
  const sceneCandidates: AcceptedSceneCandidateStaging[] = [];
  const characterStaging: AcceptedCharacterStaging[] = [];

  for (const snap of snapshots) {
    storyUnits.push(...(snap.acceptedStoryUnits ?? []));
    sceneCandidates.push(...(snap.acceptedSceneCandidates ?? []));
    const explicitCharacters = snap.acceptedCharacters ?? [];
    characterStaging.push(
      ...(explicitCharacters.length > 0
        ? explicitCharacters
        : characterStagingFromAcceptedReviewItems(snap.reviewItems ?? []))
    );
  }

  return { storyUnits, sceneCandidates, characterStaging };
}

export function importStagingFromLatestDiscoverySnapshot(
  workId: string,
  operatorId: string
): {
  storyUnits: AcceptedStoryUnitStaging[];
  sceneCandidates: AcceptedSceneCandidateStaging[];
  characterStaging: AcceptedCharacterStaging[];
} | null {
  const snapshots = findDiscoverySnapshotsForWork(workId, operatorId);
  if (snapshots.length === 0) {
    return null;
  }
  return extractStagingFromDiscoverySnapshots([snapshots[0]]);
}
