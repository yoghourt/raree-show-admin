/**
 * Resolve story-related characters/locations before Reading Route persist.
 * Prefers operator selections on staging; creates missing related refs.
 */

import * as charactersApi from "@/lib/characters";
import { findExistingByName } from "@/lib/discovery/entity-catalog-match";
import type { AcceptedStoryUnitStaging } from "@/lib/discovery/review-types";
import * as locationsApi from "@/lib/locations";

export async function resolveStoryRelatedEntities(
  workId: string,
  staging: AcceptedStoryUnitStaging
): Promise<AcceptedStoryUnitStaging> {
  const [characters, locations] = await Promise.all([
    charactersApi.getAll(workId),
    locationsApi.getAll(workId),
  ]);

  const selectedCharacterIds = new Set(staging.characterIds ?? []);
  const characterIds: string[] = [];

  // Keep operator-selected existing characters (still in catalog).
  for (const id of selectedCharacterIds) {
    if (characters.some((c) => c.tsid === id)) {
      characterIds.push(id);
    }
  }

  const relatedCharacterRefs = [...(staging.relatedCharacterRefs ?? [])];
  for (let i = 0; i < relatedCharacterRefs.length; i++) {
    const ref = relatedCharacterRefs[i]!;
    const existing =
      (ref.matchedTsid
        ? characters.find((c) => c.tsid === ref.matchedTsid)
        : undefined) ?? findExistingByName(ref.name, characters);

    if (existing) {
      relatedCharacterRefs[i] = { ...ref, matchedTsid: existing.tsid };
      // Only auto-include if operator left characterIds empty (legacy) or selected it.
      if (
        selectedCharacterIds.size === 0 ||
        selectedCharacterIds.has(existing.tsid)
      ) {
        if (!characterIds.includes(existing.tsid)) {
          characterIds.push(existing.tsid);
        }
      }
      continue;
    }

    // New entity: create when operator has no explicit selection list,
    // or when this name was never matched (must be created to write).
    const created = await charactersApi.create(workId, {
      name: ref.name,
      house: ref.house ?? "",
      description: ref.description ?? "",
      signatureQuote: ref.signatureQuote ?? null,
      portraitUrl: "",
    });
    characters.push(created);
    relatedCharacterRefs[i] = { ...ref, matchedTsid: created.tsid };
    if (!characterIds.includes(created.tsid)) {
      characterIds.push(created.tsid);
    }
  }

  const relatedLocationRefs = [...(staging.relatedLocationRefs ?? [])];
  let locationId: string | null = staging.locationId?.trim() || null;

  if (locationId && !locations.some((l) => l.tsid === locationId)) {
    locationId = null;
  }

  for (let i = 0; i < relatedLocationRefs.length; i++) {
    const ref = relatedLocationRefs[i]!;
    const existing =
      (ref.matchedTsid
        ? locations.find((l) => l.tsid === ref.matchedTsid)
        : undefined) ?? findExistingByName(ref.name, locations);

    if (existing) {
      relatedLocationRefs[i] = { ...ref, matchedTsid: existing.tsid };
      if (!locationId) locationId = existing.tsid;
      continue;
    }

    const created = await locationsApi.create(workId, {
      name: ref.name,
      region: ref.region ?? "",
      description: ref.description ?? "",
      map_focus_x: null,
      map_focus_y: null,
    });
    locations.push(created);
    relatedLocationRefs[i] = { ...ref, matchedTsid: created.tsid };
    if (!locationId) locationId = created.tsid;
  }

  return {
    ...staging,
    relatedCharacterRefs,
    relatedLocationRefs,
    characterIds,
    locationId,
  };
}
