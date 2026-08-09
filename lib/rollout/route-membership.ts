/**
 * IMPLEMENT-SCC-001-L3-A — Route membership fields are non-writable debt.
 *
 * character_ids / location_id remain in schema until L3-C; Admin/Discovery
 * MUST NOT write them on create/update.
 */

/** Empty Route membership for inserts (DB location_id NOT NULL → ""). */
export function emptyRouteMembershipDb(): {
  location_id: string;
  character_ids: string[];
} {
  return { location_id: "", character_ids: [] };
}

/** App-level empty membership on ReadingRoute payloads. */
export function emptyRouteMembershipApp(): {
  locationId: null;
  characterIds: string[];
} {
  return { locationId: null, characterIds: [] };
}
