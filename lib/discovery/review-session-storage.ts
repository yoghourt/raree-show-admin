/**
 * SPEC-D3-002 — persist Review progress across navigation (client sessionStorage)
 */

import type { DiscoveryCandidate, ProposeError } from "@/lib/discovery/propose-types";
import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
  DiscoveryReviewItem,
} from "@/lib/discovery/review-types";
import type { DiscoverySession } from "@/lib/discovery/types";

const PREFIX = "discovery_review_snapshot:";

export interface DiscoveryReviewSnapshot {
  sessionId: string;
  workId: string;
  operatorId: string;
  session: DiscoverySession;
  candidates: DiscoveryCandidate[];
  reviewItems: DiscoveryReviewItem[];
  acceptedStoryUnits: AcceptedStoryUnitStaging[];
  acceptedSceneCandidates: AcceptedSceneCandidateStaging[];
  proposeError?: ProposeError | null;
  savedAt: string;
}

function storageKey(
  workId: string,
  operatorId: string,
  sessionId: string
): string {
  return `${PREFIX}${workId}:${operatorId}:${sessionId}`;
}

export function saveDiscoveryReviewSnapshot(
  snapshot: DiscoveryReviewSnapshot
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(
    storageKey(snapshot.workId, snapshot.operatorId, snapshot.sessionId),
    JSON.stringify(snapshot)
  );
}

export function loadDiscoveryReviewSnapshot(
  workId: string,
  operatorId: string,
  sessionId: string
): DiscoveryReviewSnapshot | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  const raw = sessionStorage.getItem(storageKey(workId, operatorId, sessionId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as DiscoveryReviewSnapshot;
    if (
      parsed?.sessionId !== sessionId ||
      parsed.workId !== workId ||
      parsed.operatorId !== operatorId
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDiscoveryReviewSnapshot(
  workId: string,
  operatorId: string,
  sessionId: string
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.removeItem(storageKey(workId, operatorId, sessionId));
}
