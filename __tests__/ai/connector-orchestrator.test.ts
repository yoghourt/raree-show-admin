/**
 * Unit tests — lib/ai/connector-orchestrator.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { queryEvidenceBundle } from "@/lib/ai/connector-orchestrator";
import type { WorkSourceContext } from "@/lib/ai/evidence-types";

process.env.SOURCE_CONNECTOR_MODE = "mock";

const asoiafContext: WorkSourceContext = {
  sourceProfileId: "asoiaf-profile",
  profile: {
    profileId: "asoiaf-profile",
    kind: "public_franchise",
    displayName: "ASOIAF",
    workPattern: "asoiaf",
    wikipediaSearchContext: "A Song of Ice and Fire",
    tier2Enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  tier1Bindings: [
    {
      bindingId: "asoiaf-awoiaf-house",
      profileId: "asoiaf-profile",
      tier: 1,
      connectorId: "awoiaf",
      officialSourceId: "awoiaf",
      sourceLabel: "A Wiki of Ice and Fire",
      baseUrl: "https://awoiaf.westeros.org",
      applicableFields: ["house"],
      effectiveFrom: "2026-01-01",
      status: "approved",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
};

describe("queryEvidenceBundle", () => {
  beforeEach(() => {
    delete process.env.MOCK_AWOIAF_TIER;
    delete process.env.MOCK_WIKIPEDIA_EN_TIER;
  });

  it("returns empty bundle when sourceContext is null (SC-03 path)", async () => {
    const bundle = await queryEvidenceBundle({
      workId: "work-1",
      entityType: "character",
      scopeFieldValue: "Arya Stark",
      field: "house",
      sourceContext: null,
    });

    expect(bundle.matched).toBe(false);
    expect(bundle.tier).toBe(3);
    expect(bundle.evidenceItems).toEqual([]);
  });

  it("Tier-1 green: house in applicable_fields invokes awoiaf mock", async () => {
    const bundle = await queryEvidenceBundle({
      workId: "work-1",
      entityType: "character",
      scopeFieldValue: "Arya Stark",
      field: "house",
      sourceContext: asoiafContext,
    });

    expect(bundle.matched).toBe(true);
    expect(bundle.tier).toBe(1);
    expect(bundle.evidenceItems.some((i) => i.connectorId === "awoiaf")).toBe(
      true
    );
    expect(bundle.evidenceItems[0].sourceRef.tier).toBe(1);
  });

  it("Tier-2 yellow: field not in applicable_fields skips Tier-1, uses Wikipedia", async () => {
    const bundle = await queryEvidenceBundle({
      workId: "work-1",
      entityType: "location",
      scopeFieldValue: "Winterfell",
      field: "region",
      sourceContext: asoiafContext,
    });

    expect(bundle.matched).toBe(true);
    expect(bundle.tier).toBe(2);
    expect(bundle.evidenceItems.every((i) => i.connectorId === "wikipedia-en")).toBe(
      true
    );
  });

  it("does not dispatch draft bindings", async () => {
    const ctx: WorkSourceContext = {
      ...asoiafContext,
      tier1Bindings: [
        {
          ...asoiafContext.tier1Bindings[0],
          status: "draft",
        },
      ],
      profile: { ...asoiafContext.profile, tier2Enabled: false },
    };

    const bundle = await queryEvidenceBundle({
      workId: "work-1",
      entityType: "character",
      scopeFieldValue: "Arya Stark",
      field: "house",
      sourceContext: ctx,
    });

    expect(bundle.matched).toBe(false);
    expect(bundle.evidenceItems).toEqual([]);
  });
});
