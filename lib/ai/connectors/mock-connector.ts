/**
 * Mock connectors for CI — configurable tier fixtures via env.
 *
 * Default excerpts MUST stay gender/title-neutral unless a known fixture is
 * defined. Hardcoding "Lady" / House Stark for every name poisons Copilot drafts
 * (e.g. Night's Watch ranger Gared → false "Lady of House Stark").
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

/** Canon-ish fixtures for names used in Admin smoke / Discovery demos. */
const KNOWN_MOCK_FACTS: Record<
  string,
  { awoiaf: string; wikipedia: string }
> = {
  gared: {
    awoiaf: [
      `| Allegiance | Night's Watch |`,
      `| Title | Ranger |`,
      `| Gender | Male |`,
      `| Name | Gared |`,
      ``,
      `'''Gared''' is a ranger of the Night's Watch who appears in the prologue`,
      `of A Game of Thrones. Use only the facts present in this excerpt when`,
      `drafting narrative fields; do not invent noble houses or titles absent here.`,
    ].join("\n"),
    wikipedia: [
      `Gared is a male ranger of the Night's Watch in A Song of Ice and Fire.`,
      `He appears in the prologue of A Game of Thrones.`,
    ].join(" "),
  },
  will: {
    awoiaf: [
      `| Allegiance | Night's Watch |`,
      `| Title | Ranger |`,
      `| Gender | Male |`,
      `| Name | Will |`,
      ``,
      `'''Will''' is a ranger of the Night's Watch in the prologue of A Game of Thrones.`,
    ].join("\n"),
    wikipedia:
      "Will is a male ranger of the Night's Watch in A Song of Ice and Fire.",
  },
  "waymar royce": {
    awoiaf: [
      `| Allegiance | Night's Watch |`,
      `| House | Royce |`,
      `| Title | Ranger |`,
      `| Gender | Male |`,
      `| Name | Waymar Royce |`,
      ``,
      `'''Waymar Royce''' is a young ranger of the Night's Watch from House Royce.`,
    ].join("\n"),
    wikipedia:
      "Waymar Royce is a male ranger of the Night's Watch from House Royce.",
  },
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

function mockExcerpt(connectorId: string, scopeFieldValue: string): string {
  const key = scopeFieldValue.trim().toLowerCase();
  const known = KNOWN_MOCK_FACTS[key];
  if (known) {
    return connectorId === "awoiaf" ? known.awoiaf : known.wikipedia;
  }

  // Neutral default: no invented House / Lady / Lord.
  if (connectorId === "awoiaf") {
    return [
      `| Name | ${scopeFieldValue} |`,
      ``,
      `'''${scopeFieldValue}''' is documented in the franchise wiki mock.`,
      `This excerpt does not specify house, title, or gender.`,
      `Use only the facts present here when drafting narrative fields;`,
      `do not invent battles, titles, allegiances, or gender absent here.`,
    ].join("\n");
  }

  return `Infobox excerpt for ${scopeFieldValue}. No house, title, or gender is specified in this mock.`;
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

  const excerpt = mockExcerpt(input.connectorId, input.scopeFieldValue);

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
