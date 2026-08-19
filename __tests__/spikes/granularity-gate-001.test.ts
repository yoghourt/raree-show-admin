import { describe, expect, it } from "vitest";

import {
  FIXTURE_A,
  FIXTURE_B,
  FIXTURE_C,
  FIXTURE_D,
  FIXTURES,
} from "../../scripts/granularity-gate-spike/fixtures";
import {
  invariantSet,
  runGranularityGate,
} from "../../scripts/granularity-gate-spike/gate";
import { extractHeadings } from "../../scripts/granularity-gate-spike/text";
import type { GranularityInput } from "../../scripts/granularity-gate-spike/types";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("SPIKE-GRANULARITY-GATE-001", () => {
  it("does not special-case the primary Work id", () => {
    const productionFiles = [
      "lib/discovery/granularity-gate/gate.ts",
      "lib/discovery/granularity-gate/analyze.ts",
      "lib/discovery/granularity-gate/from-candidates.ts",
      "lib/discovery/granularity-gate/accept-guard.ts",
      "lib/discovery/granularity-gate/text.ts",
    ];
    for (const rel of productionFiles) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toContain("42c22be9");
    }
  });

  it("extracts numbered source headings from Fixture A", () => {
    const headings = extractHeadings(FIXTURE_A.input.sourceText);
    expect(headings).toHaveLength(5);
    expect(headings[0]?.title).toContain("黄巾");
    expect(headings[4]?.index).toBe(5);
  });

  it("Fixture A FAIL with G1+G4 evidence (5 Stories × 1 Frame topology)", () => {
    const result = runGranularityGate(FIXTURE_A.input);
    expect(result.status).toBe("FAIL");
    const errors = invariantSet(result);
    expect(errors.has("G1")).toBe(true);
    expect(errors.has("G4")).toBe(true);
    const g4 = result.violations.find(
      (v) => v.invariant === "G4" && v.severity === "error"
    );
    expect(g4?.evidence.some((e) => /5 Stories/i.test(e) || /singleton 5\/5/.test(e))).toBe(
      true
    );
    expect(result.analysis.storyCount).toBe(5);
    expect(result.analysis.singletonStoryCount).toBe(5);
    expect(result.analysis.headingCount).toBe(5);
  });

  it("Fixture B PASS — 1 Story × N Frames", () => {
    const result = runGranularityGate(FIXTURE_B.input);
    expect(result.status).toBe("PASS");
    expect(invariantSet(result).size).toBe(0);
    expect(result.analysis.storyCount).toBe(1);
    expect(result.analysis.frameCount).toBe(4);
  });

  it("Fixture C PASS — legal 1 Story × 1 Frame", () => {
    const result = runGranularityGate(FIXTURE_C.input);
    expect(result.status).toBe("PASS");
    expect(invariantSet(result).size).toBe(0);
    expect(result.analysis.storyCount).toBe(1);
    expect(result.analysis.frameCount).toBe(1);
  });

  it("Fixture D FAIL G3 — labeled plot turn missing from caption", () => {
    const result = runGranularityGate(FIXTURE_D.input);
    expect(result.status).toBe("FAIL");
    const errors = invariantSet(result);
    expect(errors.has("G3")).toBe(true);
    expect(errors.has("G1")).toBe(false);
    expect(errors.has("G4")).toBe(false);
    const g3 = result.violations.find(
      (v) => v.invariant === "G3" && v.severity === "error"
    );
    expect(g3?.evidence.some((e) => /Zhang Fei nearly kills/i.test(e))).toBe(
      true
    );
  });

  it("G2 fires when one Story compresses multiple progression sentences into one Frame", () => {
    const input: GranularityInput = {
      sourceText: "A happens. B happens. C happens. D happens.",
      stories: [
        {
          id: "s",
          title: "The Whole War",
          summary:
            "Liu Bei posts the notice. Guan Yu joins at the tavern. Zhang Fei swears the peach garden oath. Dong Zhuo scorns the brothers after the rescue.",
        },
      ],
      frames: [
        {
          id: "f",
          parentStoryId: "s",
          title: "War",
          caption: "Liu Bei posts a recruitment notice.",
        },
      ],
    };
    const result = runGranularityGate(input);
    expect(result.status).toBe("FAIL");
    expect(invariantSet(result).has("G2")).toBe(true);
  });

  it("heading_count == story_count alone does not FAIL G1", () => {
    const input: GranularityInput = {
      sourceText: `1. First independent tale
Short beat one.
2. Second independent tale
Short beat two.
3. Third independent tale
Short beat three.`,
      stories: [
        {
          id: "s1",
          title: "River Incident",
          summary: "A ferryman drowns near Maidenpool.",
        },
        {
          id: "s2",
          title: "Desert Caravan",
          summary: "A spice merchant is lost in Dorne.",
        },
        {
          id: "s3",
          title: "Night Watch Alarm",
          summary: "A horn sounds once beyond the Wall.",
        },
      ],
      frames: [
        {
          id: "f1",
          parentStoryId: "s1",
          title: "Ferry",
          caption: "A ferryman drowns near Maidenpool.",
        },
        {
          id: "f2",
          parentStoryId: "s2",
          title: "Sand",
          caption: "A spice merchant is lost in Dorne.",
        },
        {
          id: "f3",
          parentStoryId: "s3",
          title: "Horn",
          caption: "A horn sounds once beyond the Wall.",
        },
      ],
    };
    const result = runGranularityGate(input);
    const g1Error = result.violations.some(
      (v) => v.invariant === "G1" && v.severity === "error"
    );
    expect(g1Error).toBe(false);
    expect(result.violations.some((v) => v.invariant === "G1")).toBe(true);
  });

  it("required fixtures match expected status/invariants", () => {
    for (const fx of FIXTURES) {
      const result = runGranularityGate(fx.input);
      expect(result.status, fx.id).toBe(fx.expectedStatus);
      const errors = invariantSet(result);
      for (const inv of fx.expectedErrorInvariants) {
        expect(errors.has(inv), `${fx.id} missing ${inv}`).toBe(true);
      }
    }
  });
});
