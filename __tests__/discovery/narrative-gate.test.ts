/**
 * Unit tests — lib/discovery/narrative-gate.ts
 *
 * SPEC-D3-001 §4.3 — NG-01 through NG-07 (D3-AC-IMP-02)
 */

import { describe, it, expect } from "vitest";

import {
  APPROVED_SUMMARY_MIN_PROSE,
  EXCERPT_BUNDLE_MIN_PROSE,
} from "@/lib/discovery/constants";
import {
  computeTotalProse,
  isKeywordListExcerpt,
  validateNarrativeGate,
} from "@/lib/discovery/narrative-gate";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

function makeProse(length: number): string {
  const unit = "Narrative prose sentence. ";
  let out = "";
  while (out.length < length) {
    out += unit;
  }
  return out.slice(0, length);
}

function excerptBundle(
  overrides: Partial<NarrativeInputBundle> = {}
): NarrativeInputBundle {
  return {
    excerpts: [{ text: makeProse(EXCERPT_BUNDLE_MIN_PROSE), orderIndex: 0 }],
    operatorSummary: null,
    inputMode: "excerpt_bundle",
    summaryAttested: false,
    ...overrides,
  };
}

describe("isKeywordListExcerpt — NG-05 heuristic", () => {
  it("FAIL heuristic for comma-separated keyword line", () => {
    expect(isKeywordListExcerpt("Red Wedding, Robb, Walder Frey, Catelyn")).toBe(
      true
    );
  });

  it("PASS heuristic for prose with sentence terminators", () => {
    expect(
      isKeywordListExcerpt(
        "Catelyn watched the hall. The doors closed. Then the music changed."
      )
    ).toBe(false);
  });

  it("FAIL heuristic for short token list without terminators", () => {
    expect(isKeywordListExcerpt("Robb Stark Walder")).toBe(true);
  });
});

describe("validateNarrativeGate — NG-01 empty input", () => {
  it("FAIL when no excerpts and no summary", () => {
    const result = validateNarrativeGate({
      excerpts: [],
      operatorSummary: null,
      inputMode: "excerpt_bundle",
    });
    expect(result.pass).toBe(false);
    expect(result.failures.some((f) => f.ruleId === "NG-01")).toBe(true);
  });
});

describe("validateNarrativeGate — NG-02 excerpt_bundle min length", () => {
  it("FAIL when total prose below 512", () => {
    const result = validateNarrativeGate(
      excerptBundle({
        excerpts: [{ text: "Too short.", orderIndex: 0 }],
      })
    );
    expect(result.pass).toBe(false);
    expect(result.failures.some((f) => f.ruleId === "NG-02")).toBe(true);
  });

  it("PASS when total prose meets 512", () => {
    const result = validateNarrativeGate(excerptBundle());
    expect(result.pass).toBe(true);
    expect(result.totalProse).toBeGreaterThanOrEqual(EXCERPT_BUNDLE_MIN_PROSE);
  });
});

describe("validateNarrativeGate — NG-03 / NG-04 approved_summary", () => {
  it("FAIL NG-03 without summaryAttested", () => {
    const result = validateNarrativeGate({
      excerpts: [],
      operatorSummary: makeProse(APPROVED_SUMMARY_MIN_PROSE),
      inputMode: "approved_summary",
      summaryAttested: false,
    });
    expect(result.failures.some((f) => f.ruleId === "NG-03")).toBe(true);
  });

  it("FAIL NG-04 when summary below 768", () => {
    const result = validateNarrativeGate({
      excerpts: [],
      operatorSummary: makeProse(100),
      inputMode: "approved_summary",
      summaryAttested: true,
    });
    expect(result.failures.some((f) => f.ruleId === "NG-04")).toBe(true);
  });

  it("PASS approved_summary with attestation and zero excerpts", () => {
    const result = validateNarrativeGate({
      excerpts: [],
      operatorSummary: makeProse(APPROVED_SUMMARY_MIN_PROSE),
      inputMode: "approved_summary",
      summaryAttested: true,
    });
    expect(result.pass).toBe(true);
  });
});

describe("validateNarrativeGate — NG-05 keyword excerpt", () => {
  it("FAIL when any excerpt matches keyword-list heuristic", () => {
    const prose = makeProse(EXCERPT_BUNDLE_MIN_PROSE - 40);
    const result = validateNarrativeGate(
      excerptBundle({
        excerpts: [
          { text: prose, orderIndex: 0 },
          { text: "Red Wedding, Robb, Walder Frey, Catelyn", orderIndex: 1 },
        ],
      })
    );
    expect(result.failures.some((f) => f.ruleId === "NG-05")).toBe(true);
  });

  it("FAIL NG-05 when keyword line is pasted in operatorSummary only", () => {
    const result = validateNarrativeGate({
      excerpts: [],
      operatorSummary: "Red Wedding, Robb, Walder Frey, Catelyn",
      inputMode: "excerpt_bundle",
    });
    expect(result.failures.some((f) => f.ruleId === "NG-05")).toBe(true);
    expect(result.failures.some((f) => f.ruleId === "NG-07")).toBe(true);
  });
});

describe("validateNarrativeGate — NG-06 catalog/runtime flags", () => {
  it("FAIL when catalogOnly is true", () => {
    const result = validateNarrativeGate({
      ...excerptBundle(),
      catalogOnly: true,
    });
    expect(result.failures.some((f) => f.ruleId === "NG-06")).toBe(true);
  });

  it("FAIL when runtimeExportOnly is true", () => {
    const result = validateNarrativeGate({
      ...excerptBundle(),
      runtimeExportOnly: true,
    });
    expect(result.failures.some((f) => f.ruleId === "NG-06")).toBe(true);
  });
});

describe("validateNarrativeGate — NG-07 summary-only in excerpt_bundle mode", () => {
  it("FAIL when excerpt_bundle has summary but no excerpts", () => {
    const result = validateNarrativeGate({
      excerpts: [],
      operatorSummary: makeProse(EXCERPT_BUNDLE_MIN_PROSE),
      inputMode: "excerpt_bundle",
    });
    expect(result.failures.some((f) => f.ruleId === "NG-07")).toBe(true);
  });
});

describe("computeTotalProse", () => {
  it("sums excerpt and summary trimmed lengths", () => {
    const total = computeTotalProse({
      excerpts: [
        { text: "  abc  ", orderIndex: 0 },
        { text: "de", orderIndex: 1 },
      ],
      operatorSummary: " fg ",
      inputMode: "excerpt_bundle",
    });
    expect(total).toBe(7);
  });
});
