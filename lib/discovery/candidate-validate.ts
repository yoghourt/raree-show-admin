/**
 * SPEC-D3-003 §4.3–§4.4 — Candidate payload validation and per-type caps
 */

import { randomUUID } from "crypto";

import { MAX_CANDIDATES_PER_TYPE } from "@/lib/discovery/constants";
import { isValidSceneChapterNumber } from "@/lib/discovery/scene-chapter-number";
import type {
  DiscoveryCandidate,
  DiscoveryCandidateType,
} from "@/lib/discovery/propose-types";
import {
  foldCharacterArchivesIntoExpression,
  parseCharacterArchive,
  type RoleArchiveRef,
} from "@/lib/discovery/character-archive";
import {
  adaptSceneExpressionForLocalCapability,
  assessSceneFaceSafety,
  findCastConsistencyErrors,
  findForbiddenPhysicsCues,
  findRestrictedFullFaceSceneCues,
  remapGenericRolesToRoleNames,
} from "@/lib/discovery/expression-capability-rules";
import {
  parseRendererExpression,
  parseVisualIntent,
} from "@/lib/discovery/visual-contract";

const ASSET_FIELD_NAMES = new Set([
  "portraitUrl",
  "map_focus_x",
  "map_focus_y",
  "story_images_v2",
  "tags",
  "locationId",
  "characterIds",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function rejectAssetFields(fields: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(fields)) {
    if (ASSET_FIELD_NAMES.has(key)) {
      errors.push(`Asset field "${key}" is not allowed in propose output`);
    }
  }
  return errors;
}

function normalizeFieldsRecord(
  candidateType: DiscoveryCandidateType,
  fields: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...fields };

  if (candidateType === "character") {
    if (!isNonEmptyString(out.name)) {
      if (isNonEmptyString(out.character_name)) out.name = out.character_name;
      else if (isNonEmptyString(out.characterName)) out.name = out.characterName;
    }
  }

  if (candidateType === "location") {
    if (!isNonEmptyString(out.name)) {
      if (isNonEmptyString(out.place_name)) out.name = out.place_name;
      else if (isNonEmptyString(out.placeName)) out.name = out.placeName;
      else if (isNonEmptyString(out.place)) out.name = out.place;
      else if (isNonEmptyString(out.location)) out.name = out.location;
    }
  }

  if (candidateType === "story") {
    if (!isNonEmptyString(out.title)) {
      if (isNonEmptyString(out.story_title)) out.title = out.story_title;
      else if (isNonEmptyString(out.storyTitle)) out.title = out.storyTitle;
      else if (isNonEmptyString(out.unit_title)) out.title = out.unit_title;
      else if (isNonEmptyString(out.name)) out.title = out.name;
      else if (isNonEmptyString(out.displayName)) out.title = out.displayName;
    }
    if (!isNonEmptyString(out.summary)) {
      if (isNonEmptyString(out.story_summary)) out.summary = out.story_summary;
      else if (isNonEmptyString(out.storySummary)) out.summary = out.storySummary;
      else if (isNonEmptyString(out.unit_summary)) out.summary = out.unit_summary;
      else if (isNonEmptyString(out.description)) out.summary = out.description;
    }
  }

  if (candidateType === "scene") {
    if (!isNonEmptyString(out.title) && isNonEmptyString(out.scene_title)) {
      out.title = out.scene_title;
    }
    if (
      (out.chapter_number === undefined || out.chapter_number === null) &&
      out.chapter !== undefined
    ) {
      out.chapter_number = out.chapter;
    }
    if (
      !isNonEmptyString(out.parentStoryCandidateId) &&
      isNonEmptyString(out.parent_story_candidate_id)
    ) {
      out.parentStoryCandidateId = out.parent_story_candidate_id;
    }
  }

  return out;
}

function validateCharacterFields(
  fields: Record<string, unknown>
): { ok: true; fields: DiscoveryCandidate["fields"] } | { ok: false; errors: string[] } {
  const assetErrors = rejectAssetFields(fields);
  if (assetErrors.length) {
    return { ok: false, errors: assetErrors };
  }
  if (!isNonEmptyString(fields.name)) {
    return { ok: false, errors: ["Character fields require non-empty name"] };
  }
  const archiveResult = parseCharacterArchive(fields.characterArchive);
  if (!archiveResult.ok) {
    return { ok: false, errors: archiveResult.errors };
  }
  return {
    ok: true,
    fields: {
      name: fields.name.trim(),
      ...(isNonEmptyString(fields.house) ? { house: fields.house.trim() } : {}),
      ...(isNonEmptyString(fields.description)
        ? { description: fields.description.trim() }
        : {}),
      ...(isNonEmptyString(fields.signatureQuote)
        ? { signatureQuote: fields.signatureQuote.trim() }
        : {}),
      ...(archiveResult.value
        ? { characterArchive: archiveResult.value }
        : {}),
    },
  };
}

function validateLocationFields(
  fields: Record<string, unknown>
): { ok: true; fields: DiscoveryCandidate["fields"] } | { ok: false; errors: string[] } {
  const assetErrors = rejectAssetFields(fields);
  if (assetErrors.length) {
    return { ok: false, errors: assetErrors };
  }
  if (!isNonEmptyString(fields.name)) {
    return { ok: false, errors: ["Location fields require non-empty name"] };
  }
  return {
    ok: true,
    fields: {
      name: fields.name.trim(),
      ...(isNonEmptyString(fields.region) ? { region: fields.region.trim() } : {}),
      ...(isNonEmptyString(fields.description)
        ? { description: fields.description.trim() }
        : {}),
    },
  };
}

function validateStoryFields(
  fields: Record<string, unknown>
): { ok: true; fields: DiscoveryCandidate["fields"] } | { ok: false; errors: string[] } {
  const assetErrors = rejectAssetFields(fields);
  if (assetErrors.length) {
    return { ok: false, errors: assetErrors };
  }
  if (!isNonEmptyString(fields.title)) {
    return { ok: false, errors: ["Story fields require non-empty title"] };
  }
  if (!isNonEmptyString(fields.summary)) {
    return { ok: false, errors: ["Story fields require non-empty summary"] };
  }
  return {
    ok: true,
    fields: {
      title: fields.title.trim(),
      summary: fields.summary.trim(),
      ...(isNonEmptyString(fields.boundaryHint)
        ? { boundaryHint: fields.boundaryHint.trim() }
        : {}),
    },
  };
}

function validateSceneFields(
  fields: Record<string, unknown>
): { ok: true; fields: DiscoveryCandidate["fields"] } | { ok: false; errors: string[] } {
  const assetErrors = rejectAssetFields(fields);
  if (assetErrors.length) {
    return { ok: false, errors: assetErrors };
  }
  if (!isNonEmptyString(fields.parentStoryCandidateId)) {
    return {
      ok: false,
      errors: ["Scene fields require non-empty parentStoryCandidateId"],
    };
  }
  const chapterNumber = fields.chapter_number;
  if (
    !isValidSceneChapterNumber(
      chapterNumber as string | number | null | undefined
    )
  ) {
    return {
      ok: false,
      errors: [
        "Scene fields require chapter_number as integer ≥ 1 (not POV title text)",
      ],
    };
  }
  if (!isNonEmptyString(fields.title)) {
    return { ok: false, errors: ["Scene fields require non-empty title"] };
  }

  const expressionResult = parseRendererExpression(fields.rendererExpression);
  if (!expressionResult.ok) {
    return { ok: false, errors: expressionResult.errors };
  }

  const authoredExpression = expressionResult.value;

  // Hard-gates on authored Expression (before adapt) so Rules 8–12 cannot
  // rewrite away physics / cast / full-face violations.
  const physicsHits = findForbiddenPhysicsCues(authoredExpression);
  if (physicsHits.length) {
    return {
      ok: false,
      errors: [
        `rendererExpression forbids physics cues (A4): ${physicsHits.join(", ")} — use static visible geometry`,
      ],
    };
  }

  // Rule 5: action/composition actor count ↔ characters[] consistency.
  const castErrors = findCastConsistencyErrors(authoredExpression);
  if (castErrors.length) {
    return {
      ok: false,
      errors: castErrors.map(
        (e) => `rendererExpression cast inconsistency: ${e}`
      ),
    };
  }

  // Rule 6: propose hard-gate unrestricted full-face scene Expression.
  const fullFaceCues = findRestrictedFullFaceSceneCues(authoredExpression);
  if (fullFaceCues.length) {
    return {
      ok: false,
      errors: [
        `rendererExpression forbids unrestricted full-face scene cues (Rule 6): ${fullFaceCues.join(", ")} — use hidden/back_view/distant/partial; full requires Human Accept override at generation`,
      ],
    };
  }

  // Authorship adapt (Rules 8–12) for Face Safety + Local landmarks/props/cast.
  const adaptedExpression = adaptSceneExpressionForLocalCapability(
    authoredExpression
  );

  const faceSafety = assessSceneFaceSafety(adaptedExpression);
  if (faceSafety.safety_status === "restricted") {
    return {
      ok: false,
      errors: [
        `rendererExpression face safety restricted (${faceSafety.reason}) — prefer helmets/hoods/wide shots; full face needs explicit override + Human Accept`,
      ],
    };
  }

  const intentResult = parseVisualIntent(fields.visualIntent);
  if (!intentResult.ok) {
    return { ok: false, errors: intentResult.errors };
  }

  const parsedChapter = Number(String(chapterNumber).trim());
  return {
    ok: true,
    fields: {
      parentStoryCandidateId: fields.parentStoryCandidateId.trim(),
      chapter_number:
        typeof chapterNumber === "number"
          ? Math.trunc(chapterNumber)
          : parsedChapter,
      title: fields.title.trim(),
      ...(fields.chapter_title === null || isNonEmptyString(fields.chapter_title)
        ? { chapter_title: fields.chapter_title ?? null }
        : {}),
      ...(isNonEmptyString(fields.summary) ? { summary: fields.summary.trim() } : {}),
      ...(intentResult.value ? { visualIntent: intentResult.value } : {}),
      rendererExpression: adaptedExpression,
    },
  };
}

/** Collect Role archives from character candidates for Expression fold. */
export function roleArchivesFromCharacterCandidates(
  candidates: DiscoveryCandidate[]
): RoleArchiveRef[] {
  const roles: RoleArchiveRef[] = [];
  for (const c of candidates) {
    if (c.candidateType !== "character") continue;
    const fields = c.fields as {
      name?: string;
      characterArchive?: unknown;
    };
    const name = fields.name?.trim() || c.displayName.trim();
    const parsed = parseCharacterArchive(fields.characterArchive);
    if (!parsed.ok || !parsed.value) continue;
    roles.push({ name, archive: parsed.value });
  }
  return roles;
}

/**
 * SPEC-CHAR-001: after scene parse, fold budgeted Role archive cues into Expression.
 * Deterministic Discovery post-step — not Renderer intelligence.
 */
export function applyCharacterArchivesToSceneCandidate(
  candidate: DiscoveryCandidate,
  characterCandidates: DiscoveryCandidate[]
): DiscoveryCandidate {
  if (candidate.candidateType !== "scene") return candidate;
  const roleNames = characterCandidates
    .filter((c) => c.candidateType === "character")
    .map((c) => {
      const fields = c.fields as { name?: string };
      return fields.name?.trim() || c.displayName.trim();
    })
    .filter(Boolean);
  const roles = roleArchivesFromCharacterCandidates(characterCandidates);
  const fields = candidate.fields as {
    rendererExpression: Parameters<
      typeof foldCharacterArchivesIntoExpression
    >[0];
  };
  // Remap woman/man → Role names (by order) when LLM ignored Rule 7.
  let expression = remapGenericRolesToRoleNames(
    fields.rendererExpression,
    roleNames
  );
  if (roles.length > 0) {
    expression = foldCharacterArchivesIntoExpression(expression, roles);
  }
  return {
    ...candidate,
    fields: {
      ...candidate.fields,
      rendererExpression: expression,
    },
  };
}

function validateFieldsForType(
  candidateType: DiscoveryCandidateType,
  fields: unknown
): { ok: true; fields: DiscoveryCandidate["fields"] } | { ok: false; errors: string[] } {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return { ok: false, errors: ["fields must be an object"] };
  }
  const record = fields as Record<string, unknown>;
  switch (candidateType) {
    case "character":
      return validateCharacterFields(normalizeFieldsRecord("character", record));
    case "location":
      return validateLocationFields(normalizeFieldsRecord("location", record));
    case "story":
      return validateStoryFields(normalizeFieldsRecord("story", record));
    case "scene":
      return validateSceneFields(normalizeFieldsRecord("scene", record));
  }
}

/** Drop scenes whose parentStoryCandidateId is not in the proposed story set. */
export function filterScenesWithValidParents(
  candidates: DiscoveryCandidate[]
): DiscoveryCandidate[] {
  const storyIds = new Set(
    candidates
      .filter((c) => c.candidateType === "story")
      .map((c) => c.candidateId)
  );
  return candidates.filter((c) => {
    if (c.candidateType !== "scene") return true;
    const parentId =
      "parentStoryCandidateId" in c.fields
        ? c.fields.parentStoryCandidateId
        : "";
    return Boolean(parentId && storyIds.has(parentId));
  });
}

export function normalizeRawCandidate(
  raw: unknown,
  candidateType: DiscoveryCandidateType,
  workId: string
): { ok: true; candidate: DiscoveryCandidate } | { ok: false; errors: string[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["Candidate must be an object"] };
  }

  const obj = raw as Record<string, unknown>;
  const rawFields = (obj.fields ?? obj) as Record<string, unknown>;
  const fieldsResult = validateFieldsForType(
    candidateType,
    normalizeFieldsRecord(candidateType, rawFields)
  );
  if (!fieldsResult.ok) {
    return fieldsResult;
  }

  const typedFields = fieldsResult.fields as unknown as Record<string, unknown>;
  const displayName =
    (isNonEmptyString(obj.displayName) && obj.displayName.trim()) ||
    (isNonEmptyString(typedFields.name) && String(typedFields.name).trim()) ||
    (isNonEmptyString(typedFields.title) && String(typedFields.title).trim()) ||
    "";

  if (!displayName) {
    return { ok: false, errors: ["Candidate requires displayName or name/title in fields"] };
  }

  const summary = isNonEmptyString(obj.summary)
    ? obj.summary.trim()
    : isNonEmptyString(typedFields.summary)
      ? String(typedFields.summary).trim()
      : isNonEmptyString(typedFields.description)
        ? String(typedFields.description).trim()
        : displayName;

  const confidenceRaw = obj.confidence;
  let confidence: DiscoveryCandidate["confidence"] | undefined;
  if (
    confidenceRaw === "green" ||
    confidenceRaw === "yellow" ||
    confidenceRaw === "red"
  ) {
    confidence = confidenceRaw;
  }

  return {
    ok: true,
    candidate: {
      candidateId:
        isNonEmptyString(obj.candidateId) ? obj.candidateId.trim() : randomUUID(),
      candidateType,
      workId,
      displayName,
      summary,
      ...(confidence ? { confidence } : {}),
      fields: fieldsResult.fields,
    },
  };
}

export function getCandidateLabelKey(candidate: DiscoveryCandidate): string {
  const { fields, displayName } = candidate;
  const label =
    ("name" in fields && typeof fields.name === "string" ? fields.name : "") ||
    ("title" in fields && typeof fields.title === "string" ? fields.title : "") ||
    displayName;
  return label.trim().toLowerCase();
}

/** Type-scoped key for review-session duplicate checks. */
export function getCandidateDedupeKey(candidate: DiscoveryCandidate): string {
  return `${candidate.candidateType}:${getCandidateLabelKey(candidate)}`;
}

export function dedupeCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const seen = new Set<string>();
  const deduped: DiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const label = getCandidateLabelKey(candidate);
    if (!label) {
      continue;
    }
    const key = getCandidateDedupeKey(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

export function capCandidatesByType(
  candidates: DiscoveryCandidate[],
  maxPerType = MAX_CANDIDATES_PER_TYPE
): DiscoveryCandidate[] {
  const counts = new Map<DiscoveryCandidateType, number>();
  const capped: DiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const count = counts.get(candidate.candidateType) ?? 0;
    if (count >= maxPerType) {
      continue;
    }
    counts.set(candidate.candidateType, count + 1);
    capped.push(candidate);
  }

  return capped;
}
