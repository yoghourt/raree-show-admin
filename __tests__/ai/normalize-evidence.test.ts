/**
 * Unit tests — lib/ai/normalize-evidence.ts structured extraction
 */

import { describe, it, expect, vi } from "vitest";
import type { EvidenceBundle } from "@/lib/ai/evidence-types";

vi.mock("@/lib/ai/copilot-text-llm", () => ({
  callCopilotTextLlm: vi.fn(),
}));

const { normalizeEvidence } = await import("@/lib/ai/normalize-evidence");

function makeBundle(excerpt: string, tier: 1 | 2 = 1): EvidenceBundle {
  return {
    requestId: "req-1",
    workId: "work-1",
    entityType: "character",
    scopeFieldValue: "Arya Stark",
    field: "house",
    matched: true,
    tier,
    evidenceItems: [
      {
        tier,
        connectorId: tier === 1 ? "awoiaf" : "wikipedia-en",
        sourceRef: {
          tier,
          label: "test",
          url: "https://example.com",
          excerpt,
        },
        excerpt,
        retrievedAt: "2026-01-01T00:00:00Z",
        matchConfidence: "high",
      },
    ],
    diagnostics: [],
  };
}

describe("normalizeEvidence — house structured extract", () => {
  it("extracts from AWOIAF infobox wikitext |House=", async () => {
    const excerpt = `{{Infobox character
|Name=Arya Stark
|House=[[House Stark]]
|Allegiance=House Stark
}}`;

    const { value, sources } = await normalizeEvidence(
      makeBundle(excerpt, 1),
      "character",
      "house"
    );

    expect(value).toBe("Stark");
    expect(sources).toHaveLength(1);
    expect(sources[0].tier).toBe(1);
  });

  it("extracts from plain-text House | Stark", async () => {
    const { value } = await normalizeEvidence(
      makeBundle("| House | Stark | Allegiance | House Stark |"),
      "character",
      "house"
    );
    expect(value).toBe("Stark");
  });
});
