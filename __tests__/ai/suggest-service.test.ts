/**
 * Unit tests — lib/ai/suggest-service.ts
 *
 * Verifies SC-03, Option B batch topology, and Tier-1 fact path with mock connectors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WorkSourceContext } from "@/lib/ai/evidence-types";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

process.env.COPILOT_TEXT_PROVIDER = "gemini";
process.env.GEMINI_API_KEY = "test-key";
process.env.COPILOT_LLM_CALL_GAP_MS = "0";
process.env.SOURCE_CONNECTOR_MODE = "mock";

const { generateSuggestions, generateRetrySuggestions } = await import(
  "@/lib/ai/suggest-service"
);

const asoiafContext: WorkSourceContext = {
  sourceProfileId: "asoiaf-profile",
  profile: {
    profileId: "asoiaf-profile",
    kind: "public_franchise",
    displayName: "ASOIAF",
    workPattern: "asoiaf",
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

function makeFakeGeminiResponse(value: string) {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({ value }),
            },
          },
        ],
      }),
  };
}

function makeFakeBatchResponse(fields: Record<string, string>) {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(fields),
            },
          },
        ],
      }),
  };
}

describe("generateSuggestions — SC-03 fallback invariants", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("SC-03: no sourceContext → classification narrative, empty sources", async () => {
    mockFetch.mockResolvedValue(makeFakeGeminiResponse("House Stark"));

    const { items } = await generateSuggestions({
      workId: "work-1",
      entityType: "character",
      entityId: "new",
      scopeField: "Arya Stark",
      emptyFields: [{ field: "house", copilot_route: "fact" }],
    });

    expect(items).toHaveLength(1);
    expect(items[0].classification).toBe("narrative");
    expect(items[0].sources).toEqual([]);
    expect(items[0].confidence).toBe("yellow");
  });

  it("Tier-1: sourceContext + house → fact/green with sources (mock AWOIAF)", async () => {
    const { items } = await generateSuggestions({
      workId: "work-1",
      entityType: "character",
      entityId: "new",
      scopeField: "Arya Stark",
      sourceContext: asoiafContext,
      emptyFields: [{ field: "house", copilot_route: "fact" }],
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0].classification).toBe("fact");
    expect(items[0].confidence).toBe("green");
    expect(items[0].sources.length).toBeGreaterThan(0);
    expect(items[0].sources[0].tier).toBe(1);
  });

  it("narrative route: classification narrative, confidence yellow", async () => {
    mockFetch.mockResolvedValue(
      makeFakeGeminiResponse("A fierce and skilled assassin of the North.")
    );

    const { items } = await generateSuggestions({
      workId: "work-1",
      entityType: "character",
      entityId: "new",
      scopeField: "Arya Stark",
      emptyFields: [{ field: "description", copilot_route: "narrative" }],
    });

    expect(items[0].classification).toBe("narrative");
    expect(items[0].confidence).toBe("yellow");
  });

  it("Option B batch: fact connector-first, then narrative batch LLM", async () => {
    mockFetch.mockResolvedValue(
      makeFakeBatchResponse({
        description: "物理学家，ETO 创始人",
        signatureQuote: "这是人类的落日……",
      })
    );

    const { items, errors } = await generateSuggestions({
      workId: "work-1",
      entityType: "character",
      entityId: "new",
      scopeField: "叶文洁",
      workTitle: "三体",
      sourceContext: asoiafContext,
      emptyFields: [
        { field: "house", copilot_route: "fact" },
        { field: "description", copilot_route: "narrative" },
        { field: "signatureQuote", copilot_route: "narrative" },
      ],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(3);
    const house = items.find((i) => i.field === "house");
    expect(house?.classification).toBe("fact");
    expect(house?.confidence).toBe("green");
  });

  it("partial failure: narrative batch fails, fact field still succeeds", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Batch failed"));

    const { items, errors } = await generateSuggestions({
      workId: "work-1",
      entityType: "character",
      entityId: "new",
      scopeField: "Arya Stark",
      sourceContext: asoiafContext,
      emptyFields: [
        { field: "house", copilot_route: "fact" },
        { field: "description", copilot_route: "narrative" },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0].field).toBe("house");
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("description");
    expect(errors[0].code).toBe("PROVIDER_ERROR");
  });
});

describe("generateRetrySuggestions — Option B retry", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("fact retry uses connector path; narrative retries batch LLM", async () => {
    mockFetch.mockResolvedValue(
      makeFakeBatchResponse({
        description: "Regenerated bio",
      })
    );

    const { items } = await generateRetrySuggestions(
      [
        { field: "house", previousSuggestion: "Baratheon", feedback: "Wrong house" },
        { field: "description", previousSuggestion: "Short bio", feedback: null },
      ],
      {
        entityType: "character",
        scopeFieldValue: "Arya Stark",
        workId: "work-1",
        sourceContext: asoiafContext,
      }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(2);
    const house = items.find((i) => i.field === "house");
    expect(house?.classification).toBe("fact");
    expect(house?.confidence).toBe("green");
  });

  it("retry without sourceContext: SC-03 narrative path", async () => {
    mockFetch.mockResolvedValue(makeFakeGeminiResponse("Updated Stark"));

    const { items } = await generateRetrySuggestions(
      [{ field: "house", previousSuggestion: "Baratheon", feedback: "Wrong family" }],
      {
        entityType: "character",
        scopeFieldValue: "Arya Stark",
        workId: "work-1",
      }
    );

    expect(items[0].confidence).toBe("yellow");
    expect(items[0].classification).toBe("narrative");
    expect(items[0].sources).toEqual([]);
  });
});
