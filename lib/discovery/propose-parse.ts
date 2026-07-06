/**
 * SPEC-D3-003 — LLM output parsing for Discovery Candidates
 */

import { extractJson } from "@/lib/ai/llm-response-utils";
import type { DiscoveryCandidateType } from "@/lib/discovery/propose-types";

/** Unwrap double-encoded JSON strings some models return. */
export function unwrapLlmJsonContent(raw: string): string {
  let content = raw.trim();
  if (content.startsWith('"') && content.endsWith('"')) {
    try {
      const inner = JSON.parse(content);
      if (typeof inner === "string") {
        content = inner.trim();
      }
    } catch {
      // keep original
    }
  }
  return content;
}

function isCandidateLikeObject(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    "displayName" in obj ||
    "fields" in obj ||
    "name" in obj ||
    "title" in obj ||
    "summary" in obj ||
    "boundaryHint" in obj ||
    "story_title" in obj ||
    "story_summary" in obj ||
    "storyTitle" in obj ||
    "storySummary" in obj ||
    "unit_title" in obj ||
    "unit_summary" in obj ||
    "chapter_number" in obj ||
    "place_name" in obj ||
    "placeName" in obj ||
    "place" in obj ||
    "location" in obj ||
    "region" in obj
  );
}

function isRawCandidateArray(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (entry) => typeof entry === "string" || isCandidateLikeObject(entry)
    )
  );
}

const TYPE_KEY_VARIANTS: Record<DiscoveryCandidateType, string[]> = {
  character: [
    "character",
    "characters",
    "character_candidates",
    "characterCandidates",
    "people",
    "persons",
  ],
  location: [
    "location",
    "locations",
    "location_candidates",
    "locationCandidates",
    "places",
    "place",
    "places_of_interest",
    "location_list",
    "settings",
    "setting",
  ],
  story: [
    "story",
    "stories",
    "story_candidates",
    "storyCandidates",
    "story_units",
    "storyUnits",
    "story_unit",
    "storyUnit",
    "editorial_units",
    "editorialUnits",
    "narrative_units",
    "narrativeUnits",
  ],
  scene: [
    "scene",
    "scenes",
    "scene_candidates",
    "sceneCandidates",
    "scene_proposals",
  ],
};

function normalizeCandidateItems(
  items: unknown[],
  candidateType: DiscoveryCandidateType
): unknown[] {
  return items.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      const label = item.trim();
      switch (candidateType) {
        case "character":
          return [
            { displayName: label, summary: label, fields: { name: label } },
          ];
        case "location":
          return [
            { displayName: label, summary: label, fields: { name: label } },
          ];
        case "story":
          return [
            {
              displayName: label,
              summary: label,
              fields: { title: label, summary: label },
            },
          ];
        case "scene":
          return [
            {
              displayName: label,
              summary: label,
              fields: { chapter_number: 1, title: label, summary: label },
            },
          ];
      }
    }
    return [item];
  });
}

function collectFromObject(
  obj: Record<string, unknown>,
  candidateType?: DiscoveryCandidateType
): unknown[] | null {
  if (Array.isArray(obj.candidates) && obj.candidates.length === 0) {
    return [];
  }

  const arrayKeys = [
    "candidates",
    "candidate",
    "items",
    "results",
    "data",
    "output",
    "proposals",
  ];

  for (const key of arrayKeys) {
    const value = obj[key];
    if (Array.isArray(value) && value.length === 0) {
      return [];
    }
    if (candidateType && isRawCandidateArray(value)) {
      return normalizeCandidateItems(value, candidateType);
    }
    if (isCandidateLikeObject(value)) {
      return [value];
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = collectFromObject(
        value as Record<string, unknown>,
        candidateType
      );
      if (nested !== null) {
        return nested;
      }
    }
  }

  if (candidateType) {
    for (const key of TYPE_KEY_VARIANTS[candidateType]) {
      const value = obj[key];
      if (Array.isArray(value) && value.length === 0) {
        return [];
      }
      if (isRawCandidateArray(value)) {
        return normalizeCandidateItems(value, candidateType);
      }
      if (isCandidateLikeObject(value)) {
        return [value];
      }
    }
  }

  if (isCandidateLikeObject(obj)) {
    return [obj];
  }

  if (candidateType) {
    for (const value of Object.values(obj)) {
      if (isRawCandidateArray(value)) {
        return normalizeCandidateItems(value, candidateType);
      }
    }
  }

  return null;
}

function findNestedCandidateArray(
  value: unknown,
  candidateType?: DiscoveryCandidateType,
  depth = 0
): unknown[] | null {
  if (depth > 4 || candidateType === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }
    if (isRawCandidateArray(value)) {
      return normalizeCandidateItems(value, candidateType);
    }
    const fromElements: unknown[] = [];
    for (const element of value) {
      const found = findNestedCandidateArray(element, candidateType, depth + 1);
      if (found !== null && found.length > 0) {
        fromElements.push(...found);
      }
    }
    if (fromElements.length > 0) {
      return fromElements;
    }
    return null;
  }

  if (isCandidateLikeObject(value)) {
    return [value];
  }

  if (value && typeof value === "object") {
    const fromObj = collectFromObject(
      value as Record<string, unknown>,
      candidateType
    );
    if (fromObj !== null) {
      return fromObj;
    }
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const found = findNestedCandidateArray(nested, candidateType, depth + 1);
      if (found !== null) {
        return found;
      }
    }
  }

  return null;
}

export function parseCandidateArray(
  raw: string,
  candidateType: DiscoveryCandidateType
): unknown[] {
  const content = unwrapLlmJsonContent(raw);
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const unfenced = fenceMatch?.[1]?.trim() ?? content;

  const attempts: unknown[] = [];
  try {
    attempts.push(JSON.parse(unfenced));
  } catch {
    // continue
  }

  const arrStart = unfenced.indexOf("[");
  const arrEnd = unfenced.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      attempts.push(JSON.parse(unfenced.slice(arrStart, arrEnd + 1)));
    } catch {
      // continue
    }
  }

  try {
    attempts.push(JSON.parse(extractJson(unfenced)));
  } catch {
    // continue
  }

  for (const attempt of attempts) {
    const found = findNestedCandidateArray(attempt, candidateType);
    if (found !== null) {
      return found;
    }
  }

  throw new Error("LLM output is not a JSON array of candidates");
}

/** Test alias */
export const parseCandidateArrayForTest = parseCandidateArray;
