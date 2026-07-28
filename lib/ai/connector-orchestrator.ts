/**
 * SPEC-D2-003 — Connector orchestrator
 */

import { randomUUID } from "crypto";

import { retrieveConnectorEvidence } from "@/lib/ai/connectors";
import { TIER2_CONNECTOR_IDS } from "@/lib/ai/connectors/tier2-registry";
import type {
  EvidenceBundle,
  WorkSourceContext,
} from "@/lib/ai/evidence-types";
import type { EntityType } from "@/lib/ai/copilot-types";

export type OrchestratorInput = {
  workId: string;
  entityType: EntityType;
  scopeFieldValue: string;
  field: string;
  sourceContext: WorkSourceContext | null;
};

function aggregateTier(items: { tier: 1 | 2 | 3 }[]): 1 | 2 | 3 {
  if (items.length === 0) return 3;
  return Math.min(...items.map((i) => i.tier)) as 1 | 2 | 3;
}

export async function queryEvidenceBundle(
  input: OrchestratorInput
): Promise<EvidenceBundle> {
  const { workId, entityType, scopeFieldValue, field, sourceContext } = input;
  const requestId = randomUUID();

  const emptyBundle = (): EvidenceBundle => ({
    requestId,
    workId,
    entityType,
    scopeFieldValue,
    field,
    matched: false,
    tier: 3,
    evidenceItems: [],
    diagnostics: [],
  });

  if (!sourceContext) {
    return emptyBundle();
  }

  const evidenceItems: EvidenceBundle["evidenceItems"] = [];
  const diagnostics: EvidenceBundle["diagnostics"] = [];

  const tier1Bindings = sourceContext.tier1Bindings.filter(
    (b) =>
      b.status === "approved" &&
      b.applicableFields.includes(field)
  );

  for (const binding of tier1Bindings) {
    const result = await retrieveConnectorEvidence({
      entityType,
      scopeFieldValue,
      profile: sourceContext.profile,
      connectorId: binding.connectorId,
      baseUrl: binding.baseUrl,
    });
    evidenceItems.push(...result.items);
    diagnostics.push(...result.diagnostics);
  }

  if (sourceContext.profile.tier2Enabled) {
    for (const connectorId of TIER2_CONNECTOR_IDS) {
      const result = await retrieveConnectorEvidence({
        entityType,
        scopeFieldValue,
        profile: sourceContext.profile,
        connectorId,
        baseUrl: "https://en.wikipedia.org",
      });
      evidenceItems.push(...result.items);
      diagnostics.push(...result.diagnostics);
    }
  }

  if (evidenceItems.length === 0) {
    return {
      ...emptyBundle(),
      diagnostics,
    };
  }

  const tier = aggregateTier(evidenceItems);

  return {
    requestId,
    workId,
    entityType,
    scopeFieldValue,
    field,
    matched: true,
    tier,
    evidenceItems,
    diagnostics,
  };
}

/**
 * SC-02 narrative grounding — retrieve entity-level evidence without
 * `applicableFields` filter (bindings are fact-route only; page evidence
 * still grounds narrative drafts).
 */
export async function queryNarrativeContextBundle(input: {
  workId: string;
  entityType: EntityType;
  scopeFieldValue: string;
  sourceContext: WorkSourceContext | null;
}): Promise<EvidenceBundle> {
  const { workId, entityType, scopeFieldValue, sourceContext } = input;
  const requestId = randomUUID();

  const emptyBundle = (): EvidenceBundle => ({
    requestId,
    workId,
    entityType,
    scopeFieldValue,
    field: "_narrative_context",
    matched: false,
    tier: 3,
    evidenceItems: [],
    diagnostics: [],
  });

  if (!sourceContext) {
    return emptyBundle();
  }

  const evidenceItems: EvidenceBundle["evidenceItems"] = [];
  const diagnostics: EvidenceBundle["diagnostics"] = [];
  const seenConnectors = new Set<string>();

  for (const binding of sourceContext.tier1Bindings) {
    if (binding.status !== "approved") continue;
    if (seenConnectors.has(binding.connectorId)) continue;
    seenConnectors.add(binding.connectorId);

    const result = await retrieveConnectorEvidence({
      entityType,
      scopeFieldValue,
      profile: sourceContext.profile,
      connectorId: binding.connectorId,
      baseUrl: binding.baseUrl,
    });
    evidenceItems.push(...result.items);
    diagnostics.push(...result.diagnostics);
  }

  if (sourceContext.profile.tier2Enabled) {
    for (const connectorId of TIER2_CONNECTOR_IDS) {
      if (seenConnectors.has(connectorId)) continue;
      seenConnectors.add(connectorId);

      const result = await retrieveConnectorEvidence({
        entityType,
        scopeFieldValue,
        profile: sourceContext.profile,
        connectorId,
        baseUrl: "https://en.wikipedia.org",
      });
      evidenceItems.push(...result.items);
      diagnostics.push(...result.diagnostics);
    }
  }

  if (evidenceItems.length === 0) {
    return {
      ...emptyBundle(),
      diagnostics,
    };
  }

  return {
    requestId,
    workId,
    entityType,
    scopeFieldValue,
    field: "_narrative_context",
    matched: true,
    tier: aggregateTier(evidenceItems),
    evidenceItems,
    diagnostics,
  };
}
