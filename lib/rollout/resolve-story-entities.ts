/**
 * Resolve story-related characters/locations before Reading Route persist.
 *
 * IMPLEMENT-SCC-001-L2-A / ADR-012:
 * Route character_ids / location_id are non-authoritative migration debt.
 * Only honor explicit staging.characterIds / staging.locationId.
 * Do NOT expand relatedCharacterRefs / relatedLocationRefs onto Route
 * (that was Work-batch attach pollution).
 */

import * as charactersApi from "@/lib/characters";
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

  const characterIds = (staging.characterIds ?? []).filter((id) =>
    characters.some((c) => c.tsid === id)
  );

  let locationId: string | null = staging.locationId?.trim() || null;
  if (locationId && !locations.some((l) => l.tsid === locationId)) {
    locationId = null;
  }

  return {
    ...staging,
    // Refs are not Route ownership inputs under L2-A.
    relatedCharacterRefs: [],
    relatedLocationRefs: [],
    characterIds,
    locationId,
  };
}
