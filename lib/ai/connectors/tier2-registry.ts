/**
 * Global Tier-2 connector registry (Amendment A2 — not in source_bindings).
 */

export const TIER2_CONNECTOR_IDS = ["wikipedia-en"] as const;

export type Tier2ConnectorId = (typeof TIER2_CONNECTOR_IDS)[number];

export function isTier2ConnectorId(id: string): id is Tier2ConnectorId {
  return (TIER2_CONNECTOR_IDS as readonly string[]).includes(id);
}
