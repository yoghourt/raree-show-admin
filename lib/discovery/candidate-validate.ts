/**
 * SPEC-D3-003 §4.3–§4.4 — Candidate payload validation and per-type caps
 */

import { randomUUID } from "crypto";

import { MAX_CANDIDATES_PER_TYPE } from "@/lib/discovery/constants";
import type {
  DiscoveryCandidate,
  DiscoveryCandidateType,
} from "@/lib/discovery/propose-types";

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
    if (!isNonEmptyString(out.title) && isNonEmptyString(out.story_title)) {
      out.title = out.story_title;
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
  const chapterNumber = fields.chapter_number;
  if (
    chapterNumber === undefined ||
    chapterNumber === null ||
    (typeof chapterNumber === "string" && chapterNumber.trim() === "")
  ) {
    return { ok: false, errors: ["Scene fields require chapter_number"] };
  }
  if (!isNonEmptyString(fields.title)) {
    return { ok: false, errors: ["Scene fields require non-empty title"] };
  }
  return {
    ok: true,
    fields: {
      chapter_number:
        typeof chapterNumber === "number" ? chapterNumber : String(chapterNumber).trim(),
      title: fields.title.trim(),
      ...(fields.chapter_title === null || isNonEmptyString(fields.chapter_title)
        ? { chapter_title: fields.chapter_title ?? null }
        : {}),
      ...(isNonEmptyString(fields.summary) ? { summary: fields.summary.trim() } : {}),
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

export function dedupeCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
  const seen = new Set<string>();
  const deduped: DiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    const fields = candidate.fields as Record<string, unknown>;
    const key = (
      (typeof fields.name === "string" ? fields.name : "") ||
      (typeof fields.title === "string" ? fields.title : "") ||
      candidate.displayName
    )
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) {
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
