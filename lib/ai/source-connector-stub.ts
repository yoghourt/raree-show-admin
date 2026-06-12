/**
 * @deprecated Replaced by SPEC-D2-003 connector orchestrator (lib/ai/connector-orchestrator.ts).
 * Retained only for backward-compatible type imports; suggest-service no longer calls this.
 */

import type { SourceConnectorInput, SourceConnectorOutput } from "@/lib/ai/copilot-types";

/** @deprecated Use queryEvidenceBundle instead */
export function querySourceConnector(
  _input: SourceConnectorInput
): SourceConnectorOutput {
  return { matched: false, tier: 3, results: [] };
}
