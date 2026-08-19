import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { invariantSet, runGranularityGate } from "@/lib/discovery/granularity-gate";
import { evaluateRie, naiveEntitiesAllPresent, readerVisibleNarrative } from "../../scripts/rie-spike/evaluate";
import {
  FIXTURE_A,
  FIXTURE_B_KEEP,
  FIXTURE_B_LOSS,
} from "../../scripts/rie-spike/fixtures";

describe("SPIKE-RIE-001 — information equivalence", () => {
  it("does not special-case the primary Work id", () => {
    const files = [
      "scripts/rie-spike/evaluate.ts",
      "scripts/rie-spike/inventory.ts",
      "scripts/rie-spike/run.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toContain("42c22be9");
    }
  });

  it("Case A — actual Propose: topology FAIL and Reader still misses prevention", () => {
    const ev = evaluateRie(FIXTURE_A);
    expect(ev.gateStatus).toBe("FAIL");
    expect(invariantSet(runGranularityGate(FIXTURE_A.input)).has("G1")).toBe(
      true
    );
    expect(ev.information).toBe("FAIL");
    expect(ev.requiredProblems).toContain("U-PREVENT");
    expect(ev.requiredProblems).toContain("U-ATTEMPT-PREVENTED");
  });

  it("Case B_LOSS — Gate PASS on 1 Story × N Frames, information still FAIL", () => {
    const ev = evaluateRie(FIXTURE_B_LOSS);
    expect(ev.gateStatus).toBe("PASS");
    expect(ev.information).toBe("FAIL");
    expect(FIXTURE_B_LOSS.input.stories).toHaveLength(1);
    expect(FIXTURE_B_LOSS.input.frames.length).toBeGreaterThanOrEqual(4);
    expect(ev.requiredProblems).toEqual(
      expect.arrayContaining(["U-ATTEMPT", "U-PREVENT", "U-ATTEMPT-PREVENTED"])
    );
    expect(ev.storyOnlyRequired).toEqual(
      expect.arrayContaining(["U-ATTEMPT", "U-PREVENT", "U-ATTEMPT-PREVENTED"])
    );
  });

  it("Case B_KEEP — same topology, captions carry the turn → information PASS", () => {
    const ev = evaluateRie(FIXTURE_B_KEEP);
    expect(ev.gateStatus).toBe("PASS");
    expect(ev.information).toBe("PASS");
    expect(ev.requiredProblems).toEqual([]);
  });

  it("naive entity overlap is not treated as narrative coverage", () => {
    const caption = FIXTURE_B_LOSS.input.frames
      .map((f) => f.caption)
      .join(" ");
    expect(naiveEntitiesAllPresent(caption, "U-ATTEMPT-PREVENTED")).toBe(true);
    expect(FIXTURE_B_LOSS.coverage["U-ATTEMPT-PREVENTED"]?.caption).toBe("LOST");
  });

  it("Reader reconstruction uses captions only — Story.summary PRESENT does not count", () => {
    const reader = readerVisibleNarrative(FIXTURE_B_LOSS.input);
    expect(reader.toLowerCase()).not.toMatch(/restrain|prevent|劝阻/);
    expect(FIXTURE_B_LOSS.coverage["U-PREVENT"]?.story).toBe("PRESENT");
    expect(FIXTURE_B_LOSS.coverage["U-PREVENT"]?.caption).toBe("LOST");
    const row = evaluateRie(FIXTURE_B_LOSS).rows.find(
      (r) => r.unitId === "U-PREVENT"
    );
    expect(row?.readerCanRecover).toBe("LOST");
  });

  it("Fixture A caption has the attempt but not the interruption — PARTIAL ≠ PASS", () => {
    expect(FIXTURE_A.coverage["U-ATTEMPT"]?.caption).toBe("PRESENT");
    expect(FIXTURE_A.coverage["U-PREVENT"]?.caption).toBe("LOST");
    expect(FIXTURE_A.coverage["U-ATTEMPT-PREVENTED"]?.caption).toBe("PARTIAL");
    const f5 = FIXTURE_A.input.frames[4]?.caption ?? "";
    expect(f5).toMatch(/Zhang Fei/i);
    expect(f5).not.toMatch(/Guan Yu/i);
    expect(f5).not.toMatch(/restrain|prevent|held him|劝阻/i);
  });
});
