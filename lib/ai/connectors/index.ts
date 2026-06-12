import type {
  ConnectorRetrieveInput,
  EvidenceDiagnostic,
  EvidenceItem,
} from "@/lib/ai/evidence-types";

import { liveAwoiafRetrieve } from "@/lib/ai/connectors/awoiaf-connector";
import { getSourceConnectorMode } from "@/lib/ai/connectors/connector-mode";
import { mockRetrieveEvidence } from "@/lib/ai/connectors/mock-connector";
import { liveWikipediaRetrieve } from "@/lib/ai/connectors/wikipedia-connector";

export async function retrieveConnectorEvidence(
  input: ConnectorRetrieveInput
): Promise<{ items: EvidenceItem[]; diagnostics: EvidenceDiagnostic[] }> {
  if (getSourceConnectorMode() === "mock") {
    return mockRetrieveEvidence(input);
  }

  switch (input.connectorId) {
    case "awoiaf":
      return liveAwoiafRetrieve(input);
    case "wikipedia-en":
      return liveWikipediaRetrieve(input);
    default:
      return {
        items: [],
        diagnostics: [
          {
            connectorId: input.connectorId,
            code: "UNAVAILABLE",
            message: `Unknown connector: ${input.connectorId}`,
          },
        ],
      };
  }
}
