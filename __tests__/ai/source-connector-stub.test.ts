/**
 * Unit tests — lib/ai/source-connector-stub.ts
 *
 * Verifies the v1 stub always returns { matched: false, tier: 3, results: [] }
 * per Architect Decision (2026-06-11) / SPEC-D2-002 §4.4.
 */

import { describe, it, expect } from "vitest";
import { querySourceConnector } from "@/lib/ai/source-connector-stub";

describe("querySourceConnector — v1 Stub", () => {
  it("always returns matched: false", () => {
    const result = querySourceConnector({
      entityType: "character",
      scopeFieldValue: "Arya Stark",
      field: "house",
      workId: "work-123",
    });
    expect(result.matched).toBe(false);
  });

  it("always returns tier: 3", () => {
    const result = querySourceConnector({
      entityType: "location",
      scopeFieldValue: "Winterfell",
      field: "region",
      workId: "work-123",
    });
    expect(result.tier).toBe(3);
  });

  it("always returns empty results array", () => {
    const result = querySourceConnector({
      entityType: "scene",
      scopeFieldValue: "The Long Night",
      field: "chapter_number",
      workId: "work-123",
    });
    expect(result.results).toEqual([]);
  });

  it("returns same shape for all entity types", () => {
    const entityTypes = ["character", "location", "scene"] as const;
    for (const entityType of entityTypes) {
      const result = querySourceConnector({
        entityType,
        scopeFieldValue: "test",
        field: "testField",
        workId: "work-123",
      });
      expect(result).toEqual({ matched: false, tier: 3, results: [] });
    }
  });
});
