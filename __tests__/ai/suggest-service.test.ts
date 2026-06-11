/**
 * Unit tests — lib/ai/suggest-service.ts
 *
 * Verifies:
 *   - AC-12: classification: "fact" with sources: [] is never returned
 *   - AC-20: SC-03 fallback always yields confidence: "yellow"
 *   - SC-03: when stub returns matched=false, output is classification: "narrative"
 *   - Partial failure handling (§13.2)
 *
 * The Gemini API call is mocked to isolate pure service logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch before importing the service
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Set env var for tests
process.env.COPILOT_TEXT_PROVIDER = "gemini";
process.env.GEMINI_API_KEY = "test-key";
process.env.COPILOT_LLM_CALL_GAP_MS = "0";

// Dynamic import to pick up the mock
const { generateSuggestions, generateRetrySuggestions } = await import(
  "@/lib/ai/suggest-service"
);

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

  it("SC-03: stub matched=false → returns classification: narrative (AC-12)", async () => {
    mockFetch.mockResolvedValue(makeFakeGeminiResponse("House Stark"));

    const { items } = await generateSuggestions({
      workId: "work-1",
      entityType: "character",
      entityId: "new",
      scopeField: "Arya Stark",
      emptyFields: [{ field: "house", copilot_route: "fact" }],
    });

    expect(items).toHaveLength(1);
    // AC-12: fact pipeline miss → classification must be "narrative", not "fact"
    expect(items[0].classification).toBe("narrative");
    // AC-12: classification: "fact" with sources: [] is forbidden — we return "narrative"
    expect(items[0].sources).toEqual([]);
  });

  it("SC-03 / AC-20: fallback confidence is always yellow", async () => {
    mockFetch.mockResolvedValue(makeFakeGeminiResponse("The North"));

    const { items } = await generateSuggestions({
      workId: "work-1",
      entityType: "location",
      entityId: "new",
      scopeField: "Winterfell",
      emptyFields: [{ field: "region", copilot_route: "fact" }],
    });

    // AC-20: SC-03 must NOT produce confidence: "green"
    expect(items[0].confidence).toBe("yellow");
  });

  it("narrative route fields: classification narrative, confidence yellow", async () => {
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

  it("batch mode: multiple fields in one LLM call", async () => {
    mockFetch.mockResolvedValue(
      makeFakeBatchResponse({
        house: "",
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
      emptyFields: [
        { field: "house", copilot_route: "fact" },
        { field: "description", copilot_route: "narrative" },
        { field: "signatureQuote", copilot_route: "narrative" },
      ],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.field)).toEqual(
      expect.arrayContaining(["description", "signatureQuote"])
    );
  });

  it("partial failure: batch fails then sequential returns item + error (§13.2)", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Batch failed"))
      .mockResolvedValueOnce(makeFakeGeminiResponse("Stark"))
      .mockRejectedValueOnce(new Error("Provider error"));

    const { items, errors } = await generateSuggestions({
      workId: "work-1",
      entityType: "character",
      entityId: "new",
      scopeField: "Arya Stark",
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

  it("all fields succeed: errors is empty", async () => {
    mockFetch.mockResolvedValue(
      makeFakeBatchResponse({
        house: "Stark",
        description: "Some value",
      })
    );

    const { items, errors } = await generateSuggestions({
      workId: "work-1",
      entityType: "character",
      entityId: "new",
      scopeField: "Test",
      emptyFields: [
        { field: "house", copilot_route: "fact" },
        { field: "description", copilot_route: "narrative" },
      ],
    });

    expect(errors).toHaveLength(0);
    expect(items).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("generateRetrySuggestions — RT-INV-11 batch invariants", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("processes all retry fields in a single LLM call (RT-INV-11)", async () => {
    mockFetch.mockResolvedValue(
      makeFakeBatchResponse({
        house: "Stark",
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
      }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.field)).toEqual(
      expect.arrayContaining(["house", "description"])
    );
  });

  it("retry result: confidence yellow, classification narrative (SC-03 stub path)", async () => {
    mockFetch.mockResolvedValue(makeFakeBatchResponse({ house: "Updated Stark" }));

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
