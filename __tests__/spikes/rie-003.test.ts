import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { evaluateInformationEquivalence } from "@/lib/discovery/information-equivalence";
import { assessAuthority, resolveStoryClaims } from "../../scripts/rie-003-spike/authority";
import {
  COMPOUND_REQUIRED_UNIT_ID,
  DONG_REQUIRED_IDS,
  EARLY_REQUIRED_IDS,
  OPTIONAL_OR_DISCARDABLE_IDS,
  requiredIds,
} from "../../scripts/rie-003-spike/canon";
import {
  COMPRESSION_CAPTIONS,
  COMPRESSION_SOURCE_OPTIONAL,
  HUMAN_COMPLETE_BINDS,
  HUMAN_SPARSE_BINDS,
  PROPOSE_CLAIMS,
  STORY_A_CAPTIONS,
  STORY_B_CAPTIONS,
  STORY_B_SUMMARY,
  STORY_DONG,
  STORY_EARLY,
  captionList,
} from "../../scripts/rie-003-spike/fixtures";
import {
  ENTITY_OVERLAP_CLAIMS,
  claimedUnitsForIds,
  runIe,
} from "../../scripts/rie-003-spike/ie";

const BATCH = [STORY_EARLY, STORY_DONG];

const spikeFiles = [
  "scripts/rie-003-spike/authority.ts",
  "scripts/rie-003-spike/canon.ts",
  "scripts/rie-003-spike/fixtures.ts",
  "scripts/rie-003-spike/ie.ts",
  "scripts/rie-003-spike/types.ts",
];

describe("SPIKE-RIE-003 — required unit authority", () => {
  it("does not special-case a Work id and does not import Propose/Accept/Reader", () => {
    for (const rel of spikeFiles) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toContain("42c22be9");
      expect(src, rel).not.toMatch(/propose-types|review-state|useDiscoverySession/);
      expect(src, rel).not.toMatch(/generateCaption|rewriteCaption|repair/);
    }
  });

  it("Work canon REQUIRED/OPTIONAL split is an annotated inventory fact", () => {
    expect(requiredIds()).toContain(COMPOUND_REQUIRED_UNIT_ID);
    expect(OPTIONAL_OR_DISCARDABLE_IDS.sort()).toEqual(
      ["U-COUNTS", "U-OATH-TEXT", "U-QINGZHOU", "U-THEME", "U-WEAPON-NAMES"].sort()
    );
  });
});

describe("E1 — per-Story ownership", () => {
  it("D binds Units A to Story A and Units B to Story B", () => {
    const a = resolveStoryClaims("D_HYBRID", {
      storyId: STORY_EARLY,
      batchStoryIds: BATCH,
      humanBinds: HUMAN_COMPLETE_BINDS,
    });
    const b = resolveStoryClaims("D_HYBRID", {
      storyId: STORY_DONG,
      batchStoryIds: BATCH,
      humanBinds: HUMAN_COMPLETE_BINDS,
    });
    expect(a.claimedUnitIds).toEqual([...EARLY_REQUIRED_IDS]);
    expect(b.claimedUnitIds).toEqual([...DONG_REQUIRED_IDS]);
    expect(a.bindStatus).toBe("COMPLETE");
    expect(a.claimedUnitIds.some((id) => b.claimedUnitIds.includes(id))).toBe(
      false
    );
  });

  it("Story A claims are not satisfied by Story B captions", () => {
    const ieWrongHay = runIe({
      frames: captionList(STORY_B_CAPTIONS),
      claimedUnitIds: [...EARLY_REQUIRED_IDS],
    });
    expect(ieWrongHay.status).toBe("FAIL");

    const ieOwnHay = runIe({
      frames: captionList(STORY_A_CAPTIONS),
      claimedUnitIds: [...EARLY_REQUIRED_IDS],
    });
    expect(ieOwnHay.status).toBe("PASS");
  });

  it("route-level concat would leak Story B scorn into Story A — candidate-level must not", () => {
    const scornOnly = ["U-SCORN"];
    const storyAOnly = runIe({
      frames: captionList(STORY_A_CAPTIONS),
      claimedUnitIds: scornOnly,
    });
    const leaked = runIe({
      frames: [
        ...captionList(STORY_A_CAPTIONS),
        ...captionList(STORY_B_CAPTIONS),
      ],
      claimedUnitIds: scornOnly,
    });
    expect(storyAOnly.status).toBe("FAIL");
    expect(leaked.status).toBe("PASS");
  });

  it("B Work canon copies every REQUIRED unit onto Story A → ownership overblock", () => {
    const resolution = resolveStoryClaims("B_WORK_CANON", {
      storyId: STORY_EARLY,
      batchStoryIds: BATCH,
    });
    expect(resolution.claimedUnitIds).toEqual(requiredIds());
    const ie = runIe({
      frames: captionList(STORY_A_CAPTIONS),
      claimedUnitIds: resolution.claimedUnitIds,
    });
    expect(ie.status).toBe("FAIL");
    expect(
      assessAuthority("B_WORK_CANON", resolution, {
        sourceRequiresCompound: false,
        ieStatus: ie.status,
        storyOwnsOnlySubset: true,
      })
    ).toBe("OWNERSHIP_OVERBLOCK");
  });
});

describe("E2 — compound unit", () => {
  it("canon expresses U-ATTEMPT-PREVENTED as one REQUIRED unit, not four names", () => {
    const contract = claimedUnitsForIds([COMPOUND_REQUIRED_UNIT_ID])[0]!;
    expect(contract.kind).toBe("causal_turn");
    expect(contract.relationEvidence).toHaveLength(2);
    expect(contract.naiveEntities).toEqual(
      expect.arrayContaining(["Zhang Fei", "Dong Zhuo", "Liu Bei", "Guan Yu"])
    );
  });

  it("entity-overlap claims PASS the failure caption; compound claim FAILs", () => {
    const frames = captionList(STORY_B_CAPTIONS);
    const entityOnly = evaluateInformationEquivalence({
      frames,
      claimedRequiredUnits: ENTITY_OVERLAP_CLAIMS,
    });
    const compound = runIe({
      frames,
      claimedUnitIds: [COMPOUND_REQUIRED_UNIT_ID],
    });
    expect(entityOnly.status).toBe("PASS");
    expect(compound.status).toBe("FAIL");
    expect(
      compound.units.find((u) => u.unitId === COMPOUND_REQUIRED_UNIT_ID)?.reason
    ).toBe("ENTITY_OVERLAP_ONLY");
  });
});

describe("E3 — missing claim (authority completeness failure case)", () => {
  it("C Propose claims only scorn → IE PASS on scorn-only captions", () => {
    const resolution = resolveStoryClaims("C_PROPOSE", {
      storyId: STORY_DONG,
      batchStoryIds: BATCH,
      proposeClaims: PROPOSE_CLAIMS,
    });
    expect(resolution.claimedUnitIds).toEqual(["U-SCORN"]);
    expect(resolution.origin).toContain("Propose");
    const ie = runIe({
      frames: captionList(STORY_B_CAPTIONS),
      claimedUnitIds: resolution.claimedUnitIds,
    });
    expect(ie.status).toBe("PASS");
    expect(
      assessAuthority("C_PROPOSE", resolution, {
        sourceRequiresCompound: true,
        ieStatus: ie.status,
        storyOwnsOnlySubset: true,
      })
    ).toBe("AUTHORITY_COMPLETENESS_FAILURE");
  });

  it("A unaudited human can punch the same hole", () => {
    const resolution = resolveStoryClaims("A_HUMAN", {
      storyId: STORY_DONG,
      batchStoryIds: BATCH,
      humanBinds: HUMAN_SPARSE_BINDS,
    });
    const ie = runIe({
      frames: captionList(STORY_B_CAPTIONS),
      claimedUnitIds: resolution.claimedUnitIds,
    });
    expect(ie.status).toBe("PASS");
    expect(
      assessAuthority("A_HUMAN", resolution, {
        sourceRequiresCompound: true,
        ieStatus: ie.status,
        storyOwnsOnlySubset: true,
      })
    ).toBe("AUTHORITY_COMPLETENESS_FAILURE");
  });

  it("D sparse bind is caught as BIND_INCOMPLETE before IE can false-PASS", () => {
    const resolution = resolveStoryClaims("D_HYBRID", {
      storyId: STORY_DONG,
      batchStoryIds: BATCH,
      humanBinds: HUMAN_SPARSE_BINDS,
    });
    expect(resolution.bindStatus).toBe("INCOMPLETE");
    const ieIfIgnored = runIe({
      frames: captionList(STORY_B_CAPTIONS),
      claimedUnitIds: resolution.claimedUnitIds,
    });
    expect(ieIfIgnored.status).toBe("PASS");
    expect(
      assessAuthority("D_HYBRID", resolution, {
        sourceRequiresCompound: true,
        ieStatus: ieIfIgnored.status,
        storyOwnsOnlySubset: true,
      })
    ).toBe("BIND_INCOMPLETE");
  });

  it("D complete bind + failure caption → IE FAIL (authority complete, captions not)", () => {
    const resolution = resolveStoryClaims("D_HYBRID", {
      storyId: STORY_DONG,
      batchStoryIds: BATCH,
      humanBinds: HUMAN_COMPLETE_BINDS,
    });
    expect(resolution.bindStatus).toBe("COMPLETE");
    expect(resolution.claimedUnitIds).toContain(COMPOUND_REQUIRED_UNIT_ID);
    const ie = runIe({
      frames: captionList(STORY_B_CAPTIONS),
      claimedUnitIds: resolution.claimedUnitIds,
    });
    expect(ie.status).toBe("FAIL");
    expect(
      assessAuthority("D_HYBRID", resolution, {
        sourceRequiresCompound: true,
        ieStatus: ie.status,
        storyOwnsOnlySubset: true,
      })
    ).toBe("OK");
  });

  it("Story.summary naming the compound does not mint claims", () => {
    expect(STORY_B_SUMMARY.toLowerCase()).toContain("attempted to kill");
    const d = resolveStoryClaims("D_HYBRID", {
      storyId: STORY_DONG,
      batchStoryIds: BATCH,
      humanBinds: HUMAN_COMPLETE_BINDS,
    });
    const c = resolveStoryClaims("C_PROPOSE", {
      storyId: STORY_DONG,
      batchStoryIds: BATCH,
      proposeClaims: PROPOSE_CLAIMS,
    });
    expect(d.origin).not.toMatch(/summary/i);
    expect(c.claimedUnitIds).not.toContain(COMPOUND_REQUIRED_UNIT_ID);
    const authoritySrc = readFileSync(
      path.join(process.cwd(), "scripts/rie-003-spike/authority.ts"),
      "utf8"
    );
    expect(authoritySrc).not.toMatch(/summary/i);
  });
});

describe("E4 — reasonable compression", () => {
  it("authority REQUIRED set does not promote counts, weapons, oath, Qingzhou", () => {
    const claimed = new Set(requiredIds());
    for (const optional of OPTIONAL_OR_DISCARDABLE_IDS) {
      expect(claimed.has(optional)).toBe(false);
    }
  });

  it("compression captions omit OPTIONAL detail and still IE PASS on REQUIRED claims", () => {
    const text = Object.values(COMPRESSION_CAPTIONS).join(" ").toLowerCase();
    for (const detail of COMPRESSION_SOURCE_OPTIONAL) {
      expect(text.includes(detail.toLowerCase())).toBe(false);
    }
    const ie = runIe({
      frames: captionList(COMPRESSION_CAPTIONS),
      claimedUnitIds: requiredIds(),
    });
    expect(ie.status).toBe("PASS");
  });
});

describe("E5 — authority independent of caption generator", () => {
  it("C is self-certification: Propose claims what captions already say", () => {
    const resolution = resolveStoryClaims("C_PROPOSE", {
      storyId: STORY_DONG,
      batchStoryIds: BATCH,
      proposeClaims: PROPOSE_CLAIMS,
    });
    const ie = runIe({
      frames: captionList(STORY_B_CAPTIONS),
      claimedUnitIds: resolution.claimedUnitIds,
    });
    expect(resolution.origin).toBe(
      "Propose output claimedUnitIds for this Story"
    );
    expect(ie.status).toBe("PASS");
    expect(STORY_B_CAPTIONS.b2).toContain("Liu Bei, Guan Yu, Zhang Fei");
    expect(STORY_B_CAPTIONS.b1.toLowerCase()).toContain("scorns");
  });

  it("D/B canon is sourced from inventory, not captions or Propose", () => {
    const canon = readFileSync(
      path.join(process.cwd(), "scripts/rie-003-spike/canon.ts"),
      "utf8"
    );
    expect(canon).toContain("This file does not read Propose output, captions");
    expect(canon).toContain("../rie-spike/inventory");
    expect(canon).not.toContain("STORY_B_CAPTIONS");
    expect(canon).not.toContain("PROPOSE_CLAIMS");
  });
});
