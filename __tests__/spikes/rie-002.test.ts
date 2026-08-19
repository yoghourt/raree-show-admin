import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { runGranularityGate } from "@/lib/discovery/granularity-gate";
import { naiveEntitiesAllPresent } from "../../scripts/rie-spike/evaluate";
import {
  CANDIDATE_A_KEEP,
  CANDIDATE_B_LOSS,
  CANDIDATE_C_COMPRESSION,
  CANDIDATE_D_TRAP,
  CANDIDATE_MIX_EARLY,
  CANDIDATE_MIX_TRAP,
  GRANULARITY_INPUTS,
  compressionCaptionsOmitOptionalDetail,
  compressionSourceHasOptionalDetail,
  trapCaptionHasAllEntities,
} from "../../scripts/rie-002-spike/fixtures";
import {
  blockingUnits,
  validateCandidateInformation,
  validateRouteInformation,
} from "../../scripts/rie-002-spike/validator";

describe("SPIKE-RIE-002 — information equivalence boundary", () => {
  it("does not special-case the primary Work id", () => {
    const files = [
      "scripts/rie-002-spike/validator.ts",
      "scripts/rie-002-spike/fixtures.ts",
      "scripts/rie-002-spike/run.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toContain("42c22be9");
    }
  });

  it("Experiment A — B_KEEP: Granularity PASS and IE PASS", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.A_KEEP).status).toBe("PASS");
    const ie = validateCandidateInformation(CANDIDATE_A_KEEP);
    expect(ie.scope).toBe("candidate");
    expect(ie.status).toBe("PASS");
    expect(blockingUnits(ie)).toEqual([]);
    const compound = ie.units.find((u) => u.unitId === "U-ATTEMPT-PREVENTED");
    expect(compound?.status).toBe("PRESENT");
    expect(compound?.supportingFrameIds).toEqual(["f3"]);
  });

  it("Experiment B — B_LOSS: Granularity PASS and IE FAIL on attempt/prevent", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.B_LOSS).status).toBe("PASS");
    const ie = validateCandidateInformation(CANDIDATE_B_LOSS);
    expect(ie.status).toBe("FAIL");
    expect(blockingUnits(ie).map((u) => u.unitId).sort()).toEqual(
      ["U-ATTEMPT", "U-ATTEMPT-PREVENTED", "U-PREVENT"].sort()
    );
    const lost = ie.units.find((u) => u.unitId === "U-ATTEMPT-PREVENTED");
    expect(lost?.reason).toBe("ENTITY_OVERLAP_ONLY");
    expect(lost?.expected).toContain("欲杀");
  });

  it("Experiment C — reasonable compression is IE PASS", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.C_COMPRESSION).status).toBe(
      "PASS"
    );
    expect(compressionSourceHasOptionalDetail()).toBe(true);
    expect(compressionCaptionsOmitOptionalDetail()).toBe(true);
    const ie = validateCandidateInformation(CANDIDATE_C_COMPRESSION);
    expect(ie.status).toBe("PASS");
    expect(blockingUnits(ie)).toEqual([]);
  });

  it("Experiment D — entity-overlap trap is IE FAIL", () => {
    expect(runGranularityGate(GRANULARITY_INPUTS.D_TRAP).status).toBe("PASS");
    expect(trapCaptionHasAllEntities()).toBe(true);
    const ie = validateCandidateInformation(CANDIDATE_D_TRAP);
    expect(ie.status).toBe("FAIL");
    expect(blockingUnits(ie).map((u) => u.unitId)).toEqual(
      expect.arrayContaining(["U-ATTEMPT", "U-PREVENT", "U-ATTEMPT-PREVENTED"])
    );
    expect(
      naiveEntitiesAllPresent(
        Object.values(CANDIDATE_D_TRAP.captionsByFrameId).join(" "),
        "U-ATTEMPT-PREVENTED"
      )
    ).toBe(true);
  });

  it("candidate-level is sufficient; route-level is coarser", () => {
    const early = validateCandidateInformation(CANDIDATE_MIX_EARLY);
    const trap = validateCandidateInformation(CANDIDATE_MIX_TRAP);
    const route = validateRouteInformation([
      CANDIDATE_MIX_EARLY,
      CANDIDATE_MIX_TRAP,
    ]);
    expect(early.status).toBe("PASS");
    expect(trap.status).toBe("FAIL");
    expect(route.scope).toBe("route");
    expect(route.status).toBe("FAIL");
  });

  it("OPTIONAL units never fail the candidate", () => {
    const ie = validateCandidateInformation(CANDIDATE_C_COMPRESSION);
    expect(ie.units.every((u) => u.necessity === "REQUIRED")).toBe(true);
    expect(ie.status).toBe("PASS");
  });

  it("Story.summary is not in the validator input authority", () => {
    const src = readFileSync(
      path.join(process.cwd(), "scripts/rie-002-spike/validator.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/story\.summary|storySummary/);
  });
});
