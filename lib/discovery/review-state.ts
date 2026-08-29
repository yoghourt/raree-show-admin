/**
 * SPEC-D3-002 §4 — Human Review state machine (pure functions)
 */

import { getCandidateDedupeKey } from "@/lib/discovery/candidate-validate";
import {
  formatArchiveForPortrait,
  parseCharacterArchive,
} from "@/lib/discovery/character-archive";
import { readerFacingCharacterDescription } from "@/lib/prompts/avatar";
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
  AcceptedCharacterStaging,
  AcceptedLocationStaging,
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
  DiscoveryAcceptPrefill,
  DiscoveryReviewItem,
  ReviewItemStatus,
  StoryRelatedCharacterRef,
  StoryRelatedLocationRef,
} from "@/lib/discovery/review-types";
import { findExistingByName } from "@/lib/discovery/entity-catalog-match";
import { seedSceneStagingCastPlaceFromNames } from "@/lib/rollout/scene-staging-context-edit";
import { buildEntityCreateHandoffPath } from "@/lib/discovery/accept-prefill";
import { isValidSceneChapterNumber } from "@/lib/discovery/scene-chapter-number";
import {
  parseRendererExpression,
  type RendererExpression,
  type VisualIntent,
} from "@/lib/discovery/visual-contract";
import {
  framesForStoryCandidate,
  informationEquivalenceAcceptBlock,
  INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED,
  runInformationEquivalenceForAccept,
} from "@/lib/discovery/information-equivalence";
import {
  inspectAuthority,
  resolveStoryClaimedUnits,
  type RequiredUnitAuthorityContext,
} from "@/lib/discovery/required-unit-authority";
import {
  candidatesToGranularityInput,
  granularityContextRequired,
  granularityAcceptBlock,
  granularityBlocksCandidateType,
  runGranularityGate,
  type GranularityAcceptContext,
} from "@/lib/discovery/granularity-gate";

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
      item.candidate.candidateType === "scene" ||
      item.candidate.candidateType === "character" ||
      item.candidate.candidateType === "location")
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

/**
 * Replace one Scene review item with N single-beat Scene drafts (Human Split).
 * Inserts new pending items at the original index; discards the source item.
 * Prefer LLM-authored Expression per beat; falls back to stub when omitted.
 */
export function replaceSceneWithSplitBeats(
  items: DiscoveryReviewItem[],
  sourceReviewId: string,
  beats: Array<{
    title: string;
    summary: string;
    rendererExpression?: RendererExpression;
    visualIntent?: VisualIntent | null;
  }>
): DiscoveryReviewItem[] {
  const source = findReviewItem(items, sourceReviewId);
  if (!source || source.candidate.candidateType !== "scene") {
    return items;
  }
  const cleaned = beats
    .map((b) => ({
      title: b.title.trim(),
      summary: b.summary.trim(),
      rendererExpression: b.rendererExpression,
      visualIntent: b.visualIntent,
    }))
    .filter((b) => b.title || b.summary);
  if (cleaned.length < 2) {
    return items;
  }

  const sourceFields = getEffectiveFields(source) as SceneCandidateFields;
  const parentStoryCandidateId = sourceFields.parentStoryCandidateId;
  const chapter_number = sourceFields.chapter_number;
  const chapter_title = sourceFields.chapter_title;
  const workId = source.candidate.workId;

  const newItems: DiscoveryReviewItem[] = cleaned.map((beat, i) => {
    const title = beat.title || `Beat ${i + 1}`;
    const summary = beat.summary || title;
    const rendererExpression =
      beat.rendererExpression ??
      ({
        environment: "unspecified place",
        characters: [],
        action: "empty scene",
        composition: "wide view",
      } satisfies RendererExpression);
    const fields: SceneCandidateFields = {
      parentStoryCandidateId,
      chapter_number,
      ...(chapter_title != null ? { chapter_title } : {}),
      title,
      summary,
      rendererExpression,
      ...(beat.visualIntent != null
        ? { visualIntent: beat.visualIntent }
        : {}),
    };
    return {
      reviewId: createReviewId(),
      status: "edited_pending_accept" as const,
      editedDisplayName: title,
      editedSummary: summary,
      editedFields: fields,
      candidate: {
        candidateId: `split_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        workId,
        candidateType: "scene",
        displayName: title,
        summary,
        fields,
      },
    };
  });

  const idx = items.findIndex((item) => item.reviewId === sourceReviewId);
  if (idx < 0) return items;
  const next = [...items];
  next.splice(
    idx,
    1,
    ...newItems,
    {
      ...source,
      status: "discarded" as const,
    }
  );
  return next;
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
  if (!isNonEmptyString(scene.parentStoryCandidateId)) {
    errors.push("parentStoryCandidateId is required");
  }
  if (!isValidSceneChapterNumber(scene.chapter_number)) {
    errors.push(
      "chapter_number must be a numeric chapter index (integer ≥ 1); use chapter_title for POV labels like \"Bran I\""
    );
  }
  if (!isNonEmptyString(scene.title)) {
    errors.push("title is required");
  }
  const expression = parseRendererExpression(scene.rendererExpression);
  if (!expression.ok) {
    errors.push(...expression.errors);
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

export function buildLocationStaging(
  item: DiscoveryReviewItem
): AcceptedLocationStaging {
  const fields = getEffectiveFields(item) as LocationCandidateFields;
  const displayName = getEffectiveDisplayName(item).trim();
  return {
    workId: item.candidate.workId,
    sourceReviewId: item.reviewId,
    sourceCandidateId: item.candidate.candidateId,
    name:
      displayName ||
      (typeof fields.name === "string" ? fields.name.trim() : ""),
    region: typeof fields.region === "string" ? fields.region.trim() : "",
    description:
      typeof fields.description === "string" ? fields.description.trim() : "",
    acceptedAt: new Date().toISOString(),
  };
}

function characterStagingDescription(
  fields: CharacterCandidateFields
): string {
  const description =
    typeof fields.description === "string" ? fields.description.trim() : "";
  // Reader-facing Work field — never fold Character Archive / operator notes here.
  return readerFacingCharacterDescription(description);
}

function characterStagingVisualIdentity(
  fields: CharacterCandidateFields
): string {
  const parsed = parseCharacterArchive(fields.characterArchive);
  if (!parsed.ok || !parsed.value) return "";
  return formatArchiveForPortrait(parsed.value);
}

export function buildCharacterStaging(
  item: DiscoveryReviewItem
): AcceptedCharacterStaging {
  const fields = getEffectiveFields(item) as CharacterCandidateFields;
  const displayName = getEffectiveDisplayName(item).trim();
  return {
    workId: item.candidate.workId,
    sourceReviewId: item.reviewId,
    sourceCandidateId: item.candidate.candidateId,
    name:
      displayName ||
      (typeof fields.name === "string" ? fields.name.trim() : ""),
    house: typeof fields.house === "string" ? fields.house.trim() : "",
    description: characterStagingDescription(fields),
    visualIdentity: characterStagingVisualIdentity(fields),
    signatureQuote:
      typeof fields.signatureQuote === "string"
        ? fields.signatureQuote.trim() || null
        : null,
    acceptedAt: new Date().toISOString(),
  };
}

export function buildStoryStaging(
  item: DiscoveryReviewItem
): AcceptedStoryUnitStaging {
  const fields = getEffectiveFields(item) as StoryCandidateFields;
  return {
    workId: item.candidate.workId,
    sourceReviewId: item.reviewId,
    sourceCandidateId: item.candidate.candidateId,
    title: fields.title.trim(),
    summary: fields.summary.trim(),
    ...(isNonEmptyString(fields.boundaryHint)
      ? { boundaryHint: fields.boundaryHint.trim() }
      : {}),
    acceptedAt: new Date().toISOString(),
  };
}

export function buildSceneStaging(
  item: DiscoveryReviewItem,
  parentStory: AcceptedStoryUnitStaging,
  batchItems: DiscoveryReviewItem[] = []
): AcceptedSceneCandidateStaging {
  const fields = getEffectiveFields(item) as SceneCandidateFields;
  const staging: AcceptedSceneCandidateStaging = {
    workId: item.candidate.workId,
    sourceReviewId: item.reviewId,
    parentStorySourceReviewId: parentStory.sourceReviewId,
    parentStoryTitle: parentStory.title,
    chapter_title: fields.chapter_title ?? null,
    chapter_number: fields.chapter_number,
    title: fields.title.trim(),
    ...(isNonEmptyString(fields.summary)
      ? { summary: fields.summary.trim() }
      : {}),
    ...(fields.visualIntent ? { visualIntent: fields.visualIntent } : {}),
    rendererExpression: fields.rendererExpression,
    acceptedAt: new Date().toISOString(),
  };
  return seedSceneStagingCastPlaceFromNames(
    staging,
    reviewBatchEntityNames(batchItems.length > 0 ? batchItems : [item])
  );
}

export function findAcceptedParentStory(
  items: DiscoveryReviewItem[],
  acceptedStories: AcceptedStoryUnitStaging[],
  parentStoryCandidateId: string
): AcceptedStoryUnitStaging | undefined {
  const bySourceCandidate = acceptedStories.find(
    (s) =>
      s.sourceCandidateId &&
      s.sourceCandidateId === parentStoryCandidateId
  );
  if (bySourceCandidate) return bySourceCandidate;

  // Fallback: match via accepted review item's candidateId
  const parentItem = items.find(
    (item) =>
      item.status === "accepted" &&
      item.candidate.candidateType === "story" &&
      item.candidate.candidateId === parentStoryCandidateId
  );
  if (!parentItem) return undefined;
  return acceptedStories.find((s) => s.sourceReviewId === parentItem.reviewId);
}

export function evaluateGranularityForReviewItems(
  narrative: GranularityAcceptContext["narrative"],
  items: DiscoveryReviewItem[],
  labels?: GranularityAcceptContext["labels"]
) {
  return runGranularityGate(
    candidatesToGranularityInput(
      narrative,
      getActiveReviewItems(items).map(getEffectiveCandidate),
      labels
    )
  );
}

function activeStoryCandidateIds(items: DiscoveryReviewItem[]): string[] {
  return getActiveReviewItems(items)
    .filter((item) => item.candidate.candidateType === "story")
    .map((item) => item.candidate.candidateId);
}

export function evaluateInformationEquivalenceForStory(
  items: DiscoveryReviewItem[],
  storyCandidateId: string,
  claimedRequiredUnits: Parameters<
    typeof runInformationEquivalenceForAccept
  >[1]
) {
  return runInformationEquivalenceForAccept(
    framesForStoryCandidate(
      storyCandidateId,
      getActiveReviewItems(items).map(getEffectiveCandidate)
    ),
    claimedRequiredUnits
  );
}

export type InformationEquivalenceReviewView = {
  authority: ReturnType<typeof inspectAuthority>;
  status: "PASS" | "FAIL" | "CONTEXT_REQUIRED" | "NOT_RUN";
  byStoryCandidateId: Record<
    string,
    ReturnType<typeof evaluateInformationEquivalenceForStory>
  >;
};

export function evaluateInformationEquivalenceReviewView(
  items: DiscoveryReviewItem[],
  authority: RequiredUnitAuthorityContext | undefined
): InformationEquivalenceReviewView {
  const batchStoryIds = activeStoryCandidateIds(items);
  const inspection = inspectAuthority(authority, batchStoryIds);
  if (inspection.status !== "COMPLETE") {
    return {
      authority: inspection,
      status:
        inspection.status === "CONTEXT_REQUIRED"
          ? "CONTEXT_REQUIRED"
          : "NOT_RUN",
      byStoryCandidateId: {},
    };
  }

  const byStoryCandidateId: InformationEquivalenceReviewView["byStoryCandidateId"] =
    {};
  let fail = false;
  for (const storyId of batchStoryIds) {
    const resolved = resolveStoryClaimedUnits(authority, storyId, batchStoryIds);
    if (!resolved.ok) {
      return {
        authority: inspection,
        status: "NOT_RUN",
        byStoryCandidateId: {},
      };
    }
    const result = evaluateInformationEquivalenceForStory(
      items,
      storyId,
      resolved.claimedRequiredUnits
    );
    byStoryCandidateId[storyId] = result;
    if (result.status === "FAIL") fail = true;
  }
  return {
    authority: inspection,
    status: fail ? "FAIL" : "PASS",
    byStoryCandidateId,
  };
}

function informationEquivalenceBlockForItem(
  items: DiscoveryReviewItem[],
  item: DiscoveryReviewItem,
  authority: RequiredUnitAuthorityContext | undefined
): AcceptReviewError | null {
  if (!granularityBlocksCandidateType(item.candidate.candidateType)) {
    return null;
  }
  const storyCandidateId =
    item.candidate.candidateType === "story"
      ? item.candidate.candidateId
      : (getEffectiveFields(item) as SceneCandidateFields)
          .parentStoryCandidateId;
  const resolved = resolveStoryClaimedUnits(
    authority,
    storyCandidateId,
    activeStoryCandidateIds(items)
  );
  if (!resolved.ok) {
    // IMPLEMENT-RFN-001: Work Canon is not a production Accept prerequisite.
    // Missing Canon → skip IE (Human Accept + Granularity remain).
    if (resolved.code === INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED) {
      return null;
    }
    return resolved;
  }
  const result = evaluateInformationEquivalenceForStory(
    items,
    storyCandidateId,
    resolved.claimedRequiredUnits
  );
  return informationEquivalenceAcceptBlock(result);
}

/**
 * Prepare a Review item for Accept.
 * Story/Scene MUST pass Granularity Gate. Information Equivalence runs only
 * when a caller supplies Work Canon + Story Bind (not a production prerequisite).
 * Omitting narrative blocks Story/Frame Accept. Character/Location skip both.
 */
export function prepareAcceptReview(
  items: DiscoveryReviewItem[],
  reviewId: string,
  acceptedStories: AcceptedStoryUnitStaging[] = [],
  granularity?: GranularityAcceptContext,
  authority?: RequiredUnitAuthorityContext
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

  if (granularityBlocksCandidateType(item.candidate.candidateType)) {
    if (!granularity) {
      return granularityContextRequired();
    }
    const blocked = granularityAcceptBlock(
      evaluateGranularityForReviewItems(
        granularity.narrative,
        items,
        granularity.labels
      )
    );
    if (blocked) return blocked;
    const ieBlocked = informationEquivalenceBlockForItem(
      items,
      item,
      authority
    );
    if (ieBlocked) return ieBlocked;
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
        kind: "character_staging",
        staging: buildCharacterStaging(item),
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
        kind: "location_staging",
        staging: buildLocationStaging(item),
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
    case "scene": {
      const validation = validateSceneAcceptFields(fields);
      if (!validation.ok) {
        return {
          ok: false,
          code: "ACCEPT_VALIDATION_FAILED",
          message: "Scene Candidate validation failed",
          fieldErrors: validation.fieldErrors,
        };
      }
      const sceneFields = fields as SceneCandidateFields;
      const parentStory = findAcceptedParentStory(
        items,
        acceptedStories,
        sceneFields.parentStoryCandidateId
      );
      if (!parentStory) {
        return {
          ok: false,
          code: "PARENT_STORY_NOT_ACCEPTED",
          message:
            "Accept the parent Story Candidate before accepting this Scene",
        };
      }
      return {
        ok: true,
        kind: "scene_staging",
        staging: buildSceneStaging(item, parentStory, items),
      };
    }
  }
}

/** Child scene review ids whose parent story review is being revoked. */
export function getChildSceneReviewIdsForStory(
  items: DiscoveryReviewItem[],
  storyReviewId: string
): string[] {
  const storyItem = findReviewItem(items, storyReviewId);
  if (!storyItem || storyItem.candidate.candidateType !== "story") {
    return [];
  }
  const storyCandidateId = storyItem.candidate.candidateId;
  return items
    .filter((item) => {
      if (item.candidate.candidateType !== "scene") return false;
      const fields = getEffectiveFields(item) as SceneCandidateFields;
      return fields.parentStoryCandidateId === storyCandidateId;
    })
    .map((item) => item.reviewId);
}

/**
 * @deprecated IMPLEMENT-SCC-001-L2-A — Work-batch attach is NOT Story ownership.
 * Kept for diagnostics / migration callers. MUST NOT feed Story.characterIds.
 * Prefer empty Route membership; appearance/location live on Scene Context.
 */
export function buildStoryRelatedEntityRefs(
  items: DiscoveryReviewItem[],
  catalogs: {
    characters: Array<{ name: string; tsid: string }>;
    locations: Array<{ name: string; tsid: string }>;
  }
): {
  relatedCharacterRefs: StoryRelatedCharacterRef[];
  relatedLocationRefs: StoryRelatedLocationRef[];
  entityReviewIds: string[];
} {
  const relatedCharacterRefs: StoryRelatedCharacterRef[] = [];
  const relatedLocationRefs: StoryRelatedLocationRef[] = [];
  const entityReviewIds: string[] = [];

  for (const item of items) {
    if (item.status === "discarded") continue;
    const type = item.candidate.candidateType;
    if (type !== "character" && type !== "location") continue;
    if (item.status !== "accepted" && !canReviewAction(item.status)) continue;

    const name = getEffectiveDisplayName(item).trim();
    if (!name) continue;
    entityReviewIds.push(item.reviewId);

    if (type === "character") {
      const fields = getEffectiveFields(item) as CharacterCandidateFields;
      const matched = findExistingByName(name, catalogs.characters);
      relatedCharacterRefs.push({
        sourceReviewId: item.reviewId,
        name,
        ...(matched ? { matchedTsid: matched.tsid } : {}),
        ...(isNonEmptyString(fields.house) ? { house: fields.house.trim() } : {}),
        ...(isNonEmptyString(fields.description)
          ? { description: fields.description.trim() }
          : {}),
        signatureQuote:
          typeof fields.signatureQuote === "string"
            ? fields.signatureQuote.trim() || null
            : null,
      });
    } else {
      const fields = getEffectiveFields(item) as LocationCandidateFields;
      const matched = findExistingByName(name, catalogs.locations);
      relatedLocationRefs.push({
        sourceReviewId: item.reviewId,
        name,
        ...(matched ? { matchedTsid: matched.tsid } : {}),
        ...(isNonEmptyString(fields.region)
          ? { region: fields.region.trim() }
          : {}),
        ...(isNonEmptyString(fields.description)
          ? { description: fields.description.trim() }
          : {}),
      });
    }
  }

  return { relatedCharacterRefs, relatedLocationRefs, entityReviewIds };
}

/**
 * Accept a Story and cascade-accept its child Scenes only.
 *
 * IMPLEMENT-SCC-001-L2-A / ADR-012:
 * MUST NOT batch-fill Story characterIds / locationId from the Work batch.
 * Character/Location Archive candidates remain Work-scoped (separate Accept).
 * Appearance/location context ownership is Scene Context (Projection / SCC-S1).
 *
 * Story cascade Accept requires `granularity` then Information Equivalence
 * (same sequence as prepareAcceptReview). Omitting Granularity blocks
 * Story/Frame Accept. Missing Work Canon does not block Accept.
 *
 * `catalogs` retained for API compatibility; unused for Route membership.
 */
export function prepareAcceptStoryWithChildScenes(
  items: DiscoveryReviewItem[],
  storyReviewId: string,
  acceptedStories: AcceptedStoryUnitStaging[] = [],
  _catalogs: {
    characters: Array<{ name: string; tsid: string }>;
    locations: Array<{ name: string; tsid: string }>;
  } = { characters: [], locations: [] },
  granularity?: GranularityAcceptContext,
  authority?: RequiredUnitAuthorityContext
):
  | {
      ok: true;
      storyStaging: AcceptedStoryUnitStaging;
      sceneStagings: AcceptedSceneCandidateStaging[];
      acceptedReviewIds: string[];
      sceneErrors: AcceptReviewError[];
    }
  | AcceptReviewError {
  const storyResult = prepareAcceptReview(
    items,
    storyReviewId,
    acceptedStories,
    granularity,
    authority
  );
  if (!storyResult.ok) {
    return storyResult;
  }
  if (storyResult.kind !== "story_staging") {
    return {
      ok: false,
      code: "EXPECTED_STORY_ACCEPT",
      message: "Expected a Story Candidate accept result",
    };
  }

  // L2-A: Route membership fields are non-authoritative debt — leave empty.
  const storyStaging: AcceptedStoryUnitStaging = {
    ...storyResult.staging,
    relatedCharacterRefs: [],
    relatedLocationRefs: [],
    characterIds: [],
    locationId: null,
  };

  let workingItems = markReviewAccepted(items, storyReviewId);
  const storiesForChildren = [...acceptedStories, storyStaging];
  const acceptedReviewIds = [storyReviewId];

  const sceneStagings: AcceptedSceneCandidateStaging[] = [];
  const sceneErrors: AcceptReviewError[] = [];

  for (const childId of getChildSceneReviewIdsForStory(items, storyReviewId)) {
    const child = findReviewItem(workingItems, childId);
    if (!child || !canReviewAction(child.status)) {
      continue;
    }
    const childResult = prepareAcceptReview(
      workingItems,
      childId,
      storiesForChildren,
      granularity,
      authority
    );
    if (!childResult.ok) {
      sceneErrors.push(childResult);
      continue;
    }
    if (childResult.kind !== "scene_staging") {
      continue;
    }
    workingItems = markReviewAccepted(workingItems, childId);
    acceptedReviewIds.push(childId);
    sceneStagings.push(childResult.staging);
  }

  return {
    ok: true,
    storyStaging,
    sceneStagings,
    acceptedReviewIds,
    sceneErrors,
  };
}

export function characterStagingFromAcceptedReviewItems(
  items: DiscoveryReviewItem[]
): AcceptedCharacterStaging[] {
  return items
    .filter(
      (item) =>
        item.status === "accepted" &&
        item.candidate.candidateType === "character"
    )
    .map(buildCharacterStaging);
}

export function locationStagingFromAcceptedReviewItems(
  items: DiscoveryReviewItem[]
): AcceptedLocationStaging[] {
  return items
    .filter(
      (item) =>
        item.status === "accepted" &&
        item.candidate.candidateType === "location"
    )
    .map(buildLocationStaging);
}

export function reviewBatchEntityNames(items: DiscoveryReviewItem[]): {
  characters: string[];
  locations: string[];
} {
  const characters: string[] = [];
  const locations: string[] = [];
  for (const item of items) {
    if (item.status === "discarded") continue;
    const type = item.candidate.candidateType;
    if (type !== "character" && type !== "location") continue;
    const name = getEffectiveDisplayName(item).trim();
    if (!name) continue;
    if (type === "character") characters.push(name);
    else locations.push(name);
  }
  return { characters, locations };
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
