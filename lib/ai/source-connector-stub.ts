/**
 * Source Connector v1 — Stub Implementation
 *
 * Per Architect Decision (2026-06-11) and SPEC-D2-002 §4.4:
 *
 *   "In Runtime Truth v1, the Source Connector is implemented as a stub that
 *    always returns { matched: false, tier: 3, results: [] }."
 *
 * All canonical fields therefore fall through to SC-03 Original Work fallback
 * and are returned as classification: "narrative", confidence: "yellow".
 *
 * Real Source Connector implementations (Open Library, Wikipedia, etc.) are
 * deferred to the Source Connector Spec.
 */

import type { SourceConnectorInput, SourceConnectorOutput } from "@/lib/ai/copilot-types";

/**
 * Stub source connector.
 *
 * Always returns { matched: false, tier: 3, results: [] }.
 * The _input parameter is intentionally unused — real implementations will use it.
 */
export function querySourceConnector(
  _input: SourceConnectorInput
): SourceConnectorOutput {
  return { matched: false, tier: 3, results: [] };
}
