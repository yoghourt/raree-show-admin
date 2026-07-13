/**
 * SPEC-D3-002 — persist Review progress across navigation (client sessionStorage)
 *
 * Snapshot tolerance: legacy `readingRoute` type and missing parent Story fields
 * are normalized; operators may need to re-accept Scenes without valid parents.
 */

import type {
  DiscoveryCandidate,
  DiscoveryCandidateType,
  ProposeError,
  SceneCandidateFields,
} from "@/lib/discovery/propose-types";
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

function migrateCandidateType(
  type: string
): DiscoveryCandidateType {
  if (type === "readingRoute") return "scene";
  return type as DiscoveryCandidateType;
}

function normalizeCandidate(raw: DiscoveryCandidate): DiscoveryCandidate {
  const candidateType = migrateCandidateType(
    raw.candidateType as string
  );
  if (candidateType !== "scene") {
    return { ...raw, candidateType };
  }
  const fields = { ...(raw.fields as SceneCandidateFields) };
  if (
    typeof fields.parentStoryCandidateId !== "string" ||
    !fields.parentStoryCandidateId.trim()
  ) {
    // Empty parent → invalid for accept; operator must re-propose / re-link
    fields.parentStoryCandidateId = fields.parentStoryCandidateId ?? "";
  }
  return {
    ...raw,
    candidateType: "scene",
    fields,
  };
}

function normalizeStoryStaging(
  unit: AcceptedStoryUnitStaging,
  reviewItems: DiscoveryReviewItem[]
): AcceptedStoryUnitStaging {
  if (unit.sourceCandidateId) {
    return unit;
  }
  const item = reviewItems.find(
    (r) =>
      r.reviewId === unit.sourceReviewId &&
      r.candidate.candidateType === "story"
  );
  return {
    ...unit,
    sourceCandidateId: item?.candidate.candidateId ?? unit.sourceReviewId,
  };
}

function normalizeSceneStaging(
  scene: AcceptedSceneCandidateStaging
): AcceptedSceneCandidateStaging | null {
  // Legacy staging without parent Story refs is not actionable under Sprint #2
  const parentId =
    typeof scene.parentStorySourceReviewId === "string"
      ? scene.parentStorySourceReviewId.trim()
      : "";
  if (!parentId) {
    return null;
  }
  return {
    ...scene,
    parentStorySourceReviewId: parentId,
    parentStoryTitle:
      typeof scene.parentStoryTitle === "string" && scene.parentStoryTitle.trim()
        ? scene.parentStoryTitle
        : "(unknown parent Story)",
  };
}

function normalizeSnapshot(
  parsed: DiscoveryReviewSnapshot
): DiscoveryReviewSnapshot {
  const candidates = (parsed.candidates ?? []).map(normalizeCandidate);
  const reviewItems = (parsed.reviewItems ?? []).map((item) => ({
    ...item,
    candidate: normalizeCandidate(item.candidate),
  }));
  const acceptedStoryUnits = (parsed.acceptedStoryUnits ?? []).map((unit) =>
    normalizeStoryStaging(unit, reviewItems)
  );
  const acceptedSceneCandidates = (parsed.acceptedSceneCandidates ?? [])
    .map(normalizeSceneStaging)
    .filter((s): s is AcceptedSceneCandidateStaging => s !== null);

  const proposeError = parsed.proposeError
    ? {
        ...parsed.proposeError,
        errors: parsed.proposeError.errors?.map((e) => ({
          ...e,
          candidateType: migrateCandidateType(e.candidateType as string),
        })),
      }
    : parsed.proposeError;

  return {
    ...parsed,
    candidates,
    reviewItems,
    acceptedStoryUnits,
    acceptedSceneCandidates,
    proposeError,
  };
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
    return normalizeSnapshot(parsed);
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
