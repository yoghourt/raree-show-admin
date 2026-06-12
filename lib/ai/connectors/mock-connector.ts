/**
 * Mock connectors for CI — configurable tier fixtures via env.
 */

import type {
  ConnectorRetrieveInput,
  EvidenceDiagnostic,
  EvidenceItem,
} from "@/lib/ai/evidence-types";

export type MockConnectorResult = {
  items: EvidenceItem[];
  diagnostics: EvidenceDiagnostic[];
};

function mockFixtureTier(connectorId: string): 1 | 2 | 3 | "none" {
  const key = `MOCK_${connectorId.toUpperCase().replace(/-/g, "_")}_TIER`;
  const raw = process.env[key]?.trim();
  if (raw === "1") return 1;
  if (raw === "2") return 2;
  if (raw === "3") return 3;
  if (raw === "none") return "none";

  if (connectorId === "awoiaf") return 1;
  if (connectorId === "wikipedia-en") return 2;
  return "none";
}

export function mockRetrieveEvidence(
  input: ConnectorRetrieveInput
): MockConnectorResult {
  const tier = mockFixtureTier(input.connectorId);
  const diagnostics: EvidenceDiagnostic[] = [];

  if (tier === "none") {
    diagnostics.push({
      connectorId: input.connectorId,
      code: "NO_MATCH",
      message: `Mock: no evidence for ${input.scopeFieldValue}`,
    });
    return { items: [], diagnostics };
  }

  const label =
    input.connectorId === "awoiaf"
      ? "A Wiki of Ice and Fire (mock)"
      : "Wikipedia (mock)";

  const url =
    input.connectorId === "awoiaf"
      ? `${input.baseUrl}/index.php/${encodeURIComponent(input.scopeFieldValue.replace(/ /g, "_"))}`
      : `https://en.wikipedia.org/wiki/${encodeURIComponent(input.scopeFieldValue.replace(/ /g, "_"))}`;

  const excerpt =
    input.connectorId === "awoiaf"
      ? `| House | Stark |\n| Allegiance | House Stark |\n| Title | Lady |\n| Name | ${input.scopeFieldValue} |`
      : `Infobox excerpt for ${input.scopeFieldValue}. House: Stark. Region: The North.`;

  const item: EvidenceItem = {
    tier,
    connectorId: input.connectorId,
    sourceRef: {
      tier,
      label,
      url,
      excerpt,
    },
    excerpt,
    retrievedAt: new Date().toISOString(),
    matchConfidence: "high",
  };

  return { items: [item], diagnostics };
}
