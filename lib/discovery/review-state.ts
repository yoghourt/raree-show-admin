/**
 * SPEC-D3-002 §4 — Human Review state machine (pure functions)
 */

import { getCandidateDedupeKey } from "@/lib/discovery/candidate-validate";
import type {
  DiscoveryCandidate,
  CharacterCandidateFields,
  LocationCandidateFields,
  SceneCandidateFields,
  StoryCandidateFields,
} from "@/lib/discovery/propose-types";
import type {
  AcceptReviewError,
  AcceptReviewResult,
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
  DiscoveryAcceptPrefill,
  DiscoveryReviewItem,
  ReviewItemStatus,
} from "@/lib/discovery/review-types";
import { buildEntityCreateHandoffPath } from "@/lib/discovery/accept-prefill";
import { isValidSceneChapterNumber } from "@/lib/discovery/scene-chapter-number";

export function createReviewId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createReviewItems(
  candidates: DiscoveryCandidate[]
): DiscoveryReviewItem[] {
  return candidates.map((candidate) => ({
    reviewId: createReviewId(),
    candidate,
    status: "pending" as const,
  }));
}

export function getActiveReviewItems(
  items: DiscoveryReviewItem[]
): DiscoveryReviewItem[] {
  return items.filter((item) => item.status !== "discarded");
}

export function findReviewItem(
  items: DiscoveryReviewItem[],
  reviewId: string
): DiscoveryReviewItem | undefined {
  return items.find((item) => item.reviewId === reviewId);
}

function usesStoredEdits(item: DiscoveryReviewItem): boolean {
  if (item.status === "edited_pending_accept") {
    return true;
  }
  if (item.status !== "accepted") {
    return false;
  }
  return (
    item.editedFields !== undefined ||
    item.editedDisplayName !== undefined ||
    item.editedSummary !== undefined
  );
}

export function canEditReviewItem(status: ReviewItemStatus): boolean {
  return (
    status === "pending" ||
    status === "edited_pending_accept" ||
    status === "accepted"
  );
}

export function getEffectiveCandidate(item: DiscoveryReviewItem): DiscoveryCandidate {
  if (usesStoredEdits(item)) {
    return {
      ...item.candidate,
      displayName: item.editedDisplayName ?? item.candidate.displayName,
      summary: item.editedSummary ?? item.candidate.summary,
      fields: item.editedFields ?? item.candidate.fields,
    };
  }
  return item.candidate;
}

export function getSiblingCandidatesForRegen(
  items: DiscoveryReviewItem[],
  excludeReviewId: string
): DiscoveryCandidate[] {
  return items
    .filter(
      (item) => item.reviewId !== excludeReviewId && item.status !== "discarded"
    )
    .map(getEffectiveCandidate);
}

export function findReviewDuplicateCandidate(
  candidate: DiscoveryCandidate,
  items: DiscoveryReviewItem[],
  excludeReviewId: string
): DiscoveryReviewItem | null {
  const key = getCandidateDedupeKey(candidate);
  for (const item of items) {
    if (item.reviewId === excludeReviewId || item.status === "discarded") {
      continue;
    }
    if (getCandidateDedupeKey(getEffectiveCandidate(item)) === key) {
      return item;
    }
  }
  return null;
}

export function canReviewAction(status: ReviewItemStatus): boolean {
  return status === "pending" || status === "edited_pending_accept";
}

export function getEffectiveDisplayName(item: DiscoveryReviewItem): string {
  if (usesStoredEdits(item) && typeof item.editedDisplayName === "string") {
    return item.editedDisplayName.trim();
  }
  return item.candidate.displayName;
}

export function getEffectiveSummary(item: DiscoveryReviewItem): string {
  if (usesStoredEdits(item) && typeof item.editedSummary === "string") {
    return item.editedSummary.trim();
  }
  return item.candidate.summary;
}

export function getEffectiveFields(
  item: DiscoveryReviewItem
): DiscoveryCandidate["fields"] {
  if (usesStoredEdits(item) && item.editedFields) {
    return item.editedFields;
  }
  return item.candidate.fields;
}

export function discardReviewItem(
  items: DiscoveryReviewItem[],
  reviewId: string
): DiscoveryReviewItem[] {
  return items.map((item) =>
    item.reviewId === reviewId && canReviewAction(item.status)
      ? {
          ...item,
          status: "discarded",
          reviewedAt: new Date().toISOString(),
        }
      : item
  );
}

export interface ReviewEditPayload {
  editedFields: DiscoveryCandidate["fields"];
  editedDisplayName: string;
  editedSummary: string;
}

export function saveReviewEdit(
  items: DiscoveryReviewItem[],
  reviewId: string,
  edit: ReviewEditPayload
): DiscoveryReviewItem[] {
  return items.map((item) =>
    item.reviewId === reviewId && canEditReviewItem(item.status)
      ? {
          ...item,
          status:
            item.status === "pending"
              ? ("edited_pending_accept" as const)
              : item.status,
          editedFields: edit.editedFields,
          editedDisplayName: edit.editedDisplayName,
          editedSummary: edit.editedSummary,
        }
      : item
  );
}

export function markReviewAccepted(
  items: DiscoveryReviewItem[],
  reviewId: string
): DiscoveryReviewItem[] {
  return items.map((item) =>
    item.reviewId === reviewId && canReviewAction(item.status)
      ? {
          ...item,
          status: "accepted",
          reviewedAt: new Date().toISOString(),
        }
      : item
  );
}

export function revokeReviewAccept(
  items: DiscoveryReviewItem[],
  reviewId: string
): DiscoveryReviewItem[] {
  return items.map((item) => {
    if (item.reviewId !== reviewId || item.status !== "accepted") {
      return item;
    }
    const hadEdits =
      item.editedFields !== undefined ||
      item.editedDisplayName !== undefined ||
      item.editedSummary !== undefined;
    return {
      ...item,
      status: hadEdits ? ("edited_pending_accept" as const) : ("pending" as const),
      reviewedAt: undefined,
    };
  });
}

export function isStoryOrSceneAcceptedInStaging(
  item: DiscoveryReviewItem
): boolean {
  return (
    item.status === "accepted" &&
    (item.candidate.candidateType === "story" ||
      item.candidate.candidateType === "readingRoute")
  );
}

export function replaceReviewCandidate(
  items: DiscoveryReviewItem[],
  reviewId: string,
  candidate: DiscoveryCandidate
): DiscoveryReviewItem[] {
  return items.map((item) =>
    item.reviewId === reviewId
      ? {
          reviewId: item.reviewId,
          candidate,
          status: "pending" as const,
        }
      : item
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateCharacterAcceptFields(
  fields: DiscoveryCandidate["fields"]
): { ok: true } | { ok: false; fieldErrors: string[] } {
  if (!("name" in fields) || !isNonEmptyString(fields.name)) {
    return { ok: false, fieldErrors: ["name is required"] };
  }
  return { ok: true };
}

export function validateLocationAcceptFields(
  fields: DiscoveryCandidate["fields"]
): { ok: true } | { ok: false; fieldErrors: string[] } {
  if (!("name" in fields) || !isNonEmptyString(fields.name)) {
    return { ok: false, fieldErrors: ["name is required"] };
  }
  return { ok: true };
}

export function validateStoryAcceptFields(
  fields: DiscoveryCandidate["fields"]
): { ok: true } | { ok: false; fieldErrors: string[] } {
  const story = fields as StoryCandidateFields;
  const errors: string[] = [];
  if (!isNonEmptyString(story.title)) {
    errors.push("title is required");
  }
  if (!isNonEmptyString(story.summary)) {
    errors.push("summary is required");
  }
  if (errors.length > 0) {
    return { ok: false, fieldErrors: errors };
  }
  return { ok: true };
}

export function validateSceneAcceptFields(
  fields: DiscoveryCandidate["fields"]
): { ok: true } | { ok: false; fieldErrors: string[] } {
  const scene = fields as SceneCandidateFields;
  const errors: string[] = [];
  if (!isValidSceneChapterNumber(scene.chapter_number)) {
    errors.push(
      "chapter_number must be a numeric chapter index (integer ≥ 1); use chapter_title for POV labels like \"Bran I\""
    );
  }
  if (!isNonEmptyString(scene.title)) {
    errors.push("title is required");
  }
  if (errors.length > 0) {
    return { ok: false, fieldErrors: errors };
  }
  return { ok: true };
}

function fieldsToRecord(fields: DiscoveryCandidate["fields"]): Record<string, unknown> {
  return { ...fields } as Record<string, unknown>;
}

export function buildAcceptPrefill(
  item: DiscoveryReviewItem,
  candidateType: "character" | "location"
): DiscoveryAcceptPrefill {
  return {
    source: "discovery_review",
    reviewId: item.reviewId,
    candidateType,
    workId: item.candidate.workId,
    fields: fieldsToRecord(getEffectiveFields(item)),
    displayName: getEffectiveDisplayName(item),
    summary: getEffectiveSummary(item),
  };
}

export function buildStoryStaging(
  item: DiscoveryReviewItem
): AcceptedStoryUnitStaging {
  const fields = getEffectiveFields(item) as StoryCandidateFields;
  return {
    workId: item.candidate.workId,
    sourceReviewId: item.reviewId,
    title: fields.title.trim(),
    summary: fields.summary.trim(),
    ...(isNonEmptyString(fields.boundaryHint)
      ? { boundaryHint: fields.boundaryHint.trim() }
      : {}),
    acceptedAt: new Date().toISOString(),
  };
}

export function buildSceneStaging(
  item: DiscoveryReviewItem
): AcceptedSceneCandidateStaging {
  const fields = getEffectiveFields(item) as SceneCandidateFields;
  return {
    workId: item.candidate.workId,
    sourceReviewId: item.reviewId,
    chapter_title: fields.chapter_title ?? null,
    chapter_number: fields.chapter_number,
    title: fields.title.trim(),
    ...(isNonEmptyString(fields.summary)
      ? { summary: fields.summary.trim() }
      : {}),
    acceptedAt: new Date().toISOString(),
  };
}

export function prepareAcceptReview(
  items: DiscoveryReviewItem[],
  reviewId: string
): AcceptReviewResult | AcceptReviewError {
  const item = findReviewItem(items, reviewId);
  if (!item) {
    return { ok: false, code: "REVIEW_ITEM_NOT_FOUND", message: "Review item not found" };
  }
  if (!canReviewAction(item.status)) {
    return {
      ok: false,
      code: "REVIEW_ITEM_NOT_ACTIONABLE",
      message: "Review item cannot be accepted in its current state",
    };
  }

  const fields = getEffectiveFields(item);
  const workId = item.candidate.workId;

  switch (item.candidate.candidateType) {
    case "character": {
      const validation = validateCharacterAcceptFields(fields);
      if (!validation.ok) {
        return {
          ok: false,
          code: "ACCEPT_VALIDATION_FAILED",
          message: "Character Candidate validation failed",
          fieldErrors: validation.fieldErrors,
        };
      }
      return {
        ok: true,
        kind: "entity_prefill",
        path: buildEntityCreateHandoffPath(workId, item.reviewId, "character"),
        prefill: buildAcceptPrefill(item, "character"),
      };
    }
    case "location": {
      const validation = validateLocationAcceptFields(fields);
      if (!validation.ok) {
        return {
          ok: false,
          code: "ACCEPT_VALIDATION_FAILED",
          message: "Location Candidate validation failed",
          fieldErrors: validation.fieldErrors,
        };
      }
      return {
        ok: true,
        kind: "entity_prefill",
        path: buildEntityCreateHandoffPath(workId, item.reviewId, "location"),
        prefill: buildAcceptPrefill(item, "location"),
      };
    }
    case "story": {
      const validation = validateStoryAcceptFields(fields);
      if (!validation.ok) {
        return {
          ok: false,
          code: "ACCEPT_VALIDATION_FAILED",
          message: "Story Candidate validation failed",
          fieldErrors: validation.fieldErrors,
        };
      }
      return {
        ok: true,
        kind: "story_staging",
        staging: buildStoryStaging(item),
      };
    }
    case "readingRoute": {
      const validation = validateSceneAcceptFields(fields);
      if (!validation.ok) {
        return {
          ok: false,
          code: "ACCEPT_VALIDATION_FAILED",
          message: "Scene Candidate validation failed",
          fieldErrors: validation.fieldErrors,
        };
      }
      return {
        ok: true,
        kind: "scene_staging",
        staging: buildSceneStaging(item),
      };
    }
  }
}

export function characterPrefillToFormValues(
  prefill: DiscoveryAcceptPrefill
): {
  name: string;
  house: string;
  description: string;
  signatureQuote: string | null;
} {
  const fields = prefill.fields as Partial<CharacterCandidateFields>;
  const displayName = prefill.displayName.trim();
  return {
    name:
      displayName ||
      (typeof fields.name === "string" ? fields.name.trim() : ""),
    house: typeof fields.house === "string" ? fields.house.trim() : "",
    description:
      typeof fields.description === "string" ? fields.description.trim() : "",
    signatureQuote:
      typeof fields.signatureQuote === "string"
        ? fields.signatureQuote.trim() || null
        : null,
  };
}

export function locationPrefillToFormValues(
  prefill: DiscoveryAcceptPrefill
): {
  name: string;
  region: string;
  description: string;
} {
  const fields = prefill.fields as Partial<LocationCandidateFields>;
  const displayName = prefill.displayName.trim();
  return {
    name:
      displayName ||
      (typeof fields.name === "string" ? fields.name.trim() : ""),
    region: typeof fields.region === "string" ? fields.region.trim() : "",
    description:
      typeof fields.description === "string" ? fields.description.trim() : "",
  };
}

export function hasPendingReviewItems(items: DiscoveryReviewItem[]): boolean {
  return items.some((item) => canReviewAction(item.status));
}
