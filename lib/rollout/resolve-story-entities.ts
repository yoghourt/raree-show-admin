/**
 * Resolve story-related characters/locations before Reading Route persist.
 *
 * IMPLEMENT-SCC-001-L3-C / ADR-012:
 * Route membership columns dropped. Clear staging membership fields so
 * they cannot be treated as ownership inputs. Refs are not Route ownership.
 */

import type { AcceptedStoryUnitStaging } from "@/lib/discovery/review-types";

export async function resolveStoryRelatedEntities(
  _workId: string,
  staging: AcceptedStoryUnitStaging
): Promise<AcceptedStoryUnitStaging> {
  return {
    ...staging,
    relatedCharacterRefs: [],
    relatedLocationRefs: [],
    characterIds: [],
    locationId: null,
  };
}
