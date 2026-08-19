import { describe, expect, it } from "vitest";

import { INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED } from "@/lib/discovery/information-equivalence";
import {
  AUTHORITY_BIND_INCOMPLETE,
  inspectAuthority,
  resolveStoryClaimedUnits,
  workCanonFromRequiredClaims,
} from "@/lib/discovery/required-unit-authority";
import { RIE_001_CLAIMED_REQUIRED_UNITS } from "@/lib/discovery/information-equivalence";

const CLAIMS = RIE_001_CLAIMED_REQUIRED_UNITS;
const CANON = workCanonFromRequiredClaims(CLAIMS);

describe("IMPLEMENT-RIE-002 required unit authority resolver", () => {
  it("missing Canon is CONTEXT_REQUIRED, not IE PASS", () => {
    const resolved = resolveStoryClaimedUnits(undefined, "story-arc", [
      "story-arc",
    ]);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) throw new Error("expected block");
    expect(resolved.code).toBe(INFORMATION_EQUIVALENCE_CONTEXT_REQUIRED);
  });

  it("Canon without binds is AUTHORITY_BIND_INCOMPLETE", () => {
    const resolved = resolveStoryClaimedUnits(
      { workCanon: CANON, storyBinds: [] },
      "story-arc",
      ["story-arc"]
    );
    expect(resolved.ok).toBe(false);
    if (resolved.ok) throw new Error("expected block");
    expect(resolved.code).toBe(AUTHORITY_BIND_INCOMPLETE);
  });

  it("does not default-inherit all REQUIRED onto a 1×N Story", () => {
    const inspection = inspectAuthority(
      { workCanon: CANON, storyBinds: [] },
      ["story-arc"]
    );
    expect(inspection.status).toBe("INCOMPLETE");
    expect(inspection.unboundRequiredIds).toContain("U-ATTEMPT-PREVENTED");
  });

  it("rejects binding OPTIONAL or unknown ids", () => {
    const resolved = resolveStoryClaimedUnits(
      {
        workCanon: CANON,
        storyBinds: [
          { storyCandidateId: "story-arc", unitIds: ["U-QINGZHOU"] },
        ],
      },
      "story-arc",
      ["story-arc"]
    );
    expect(resolved.ok).toBe(false);
    if (resolved.ok) throw new Error("expected block");
    expect(resolved.code).toBe(AUTHORITY_BIND_INCOMPLETE);
  });

  it("rejects duplicate ownership", () => {
    const ids = CLAIMS.map((c) => c.unitId);
    const inspection = inspectAuthority(
      {
        workCanon: CANON,
        storyBinds: [
          { storyCandidateId: "story-a", unitIds: ids },
          { storyCandidateId: "story-b", unitIds: ["U-SCORN"] },
        ],
      },
      ["story-a", "story-b"]
    );
    expect(inspection.status).toBe("INCOMPLETE");
    expect(inspection.duplicateUnitIds).toContain("U-SCORN");
  });

  it("complete per-Story bind yields that Story's claims only", () => {
    const early = CLAIMS.filter((c) =>
      ["U-REBELLION", "U-NOTICE", "U-MEET-OATH", "U-ARMS", "U-DAXING"].includes(
        c.unitId
      )
    );
    const dong = CLAIMS.filter((c) =>
      [
        "U-RESCUE",
        "U-SCORN",
        "U-ATTEMPT",
        "U-PREVENT",
        "U-ATTEMPT-PREVENTED",
      ].includes(c.unitId)
    );
    const ctx = {
      workCanon: workCanonFromRequiredClaims([...early, ...dong]),
      storyBinds: [
        { storyCandidateId: "story-a", unitIds: early.map((c) => c.unitId) },
        { storyCandidateId: "story-b", unitIds: dong.map((c) => c.unitId) },
      ],
    };
    const a = resolveStoryClaimedUnits(ctx, "story-a", ["story-a", "story-b"]);
    expect(a.ok).toBe(true);
    if (!a.ok) throw new Error("expected ok");
    expect(a.claimedRequiredUnits.map((u) => u.unitId)).toEqual(
      early.map((c) => c.unitId)
    );
    expect(a.claimedRequiredUnits.some((u) => u.unitId === "U-SCORN")).toBe(
      false
    );
  });
});
