import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  APPENDIX_MERCHANT_SLICE,
  APPENDIX_PEACH_SLICE,
  CASE_CAUSAL,
  CASE_DENSE,
  CASE_SIMPLE,
  LEDGER,
} from "../../scripts/discovery-scene-spike/cases";
import {
  architectureSplit,
  captionAuthorityDrops,
  probeLedger,
} from "../../scripts/discovery-scene-spike/ledger";
import { SOURCE_EXCERPT } from "../../scripts/discovery-scene-spike/source";

const SPIKE_EVAL_FILES = [
  "scripts/discovery-scene-spike/ledger.ts",
  "scripts/discovery-scene-spike/run.ts",
  "scripts/discovery-scene-spike/types.ts",
];

describe("SPIKE-DISCOVERY-SCENE-001 — information loss location", () => {
  it("does not special-case the primary Work id in evaluators", () => {
    for (const rel of SPIKE_EVAL_FILES) {
      const src = readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toContain("42c22be9");
    }
  });

  it("dump script is read-only", () => {
    const src = readFileSync(
      path.join(process.cwd(), "scripts/discovery-scene-spike/dump-runtime.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/\.insert\(/);
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/\.delete\(/);
  });

  it("uses the production Source excerpt (three required case headings)", () => {
    expect(SOURCE_EXCERPT).toContain("黄巾起义与招兵榜文");
    expect(SOURCE_EXCERPT).toContain("大兴山首战告捷");
    expect(SOURCE_EXCERPT).toContain("救援董卓与遭遇冷落");
    expect(SOURCE_EXCERPT).toContain("张飞大怒，提刀欲入帐斩杀董卓");
    expect(SOURCE_EXCERPT).toContain("幸被刘备与关羽死死劝阻");
  });

  it("selects simple / dense / causal Runtime slices with real captions", () => {
    expect(CASE_SIMPLE.slice.frames).toHaveLength(1);
    expect(CASE_DENSE.slice.frames).toHaveLength(1);
    expect(CASE_CAUSAL.slice.frames).toHaveLength(1);
    expect(CASE_SIMPLE.slice.frames[0]!.caption).toContain("recruitment notice");
    expect(CASE_DENSE.slice.frames[0]!.caption).toContain("confront");
    expect(CASE_CAUSAL.slice.frames[0]!.caption).toContain("restrain");
  });

  it("ledger annotations match frozen Runtime artifacts", () => {
    const probes = probeLedger();
    const failed = probes.filter((p) => !p.ok);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  });

  it("A vs B vs C are split — not collapsed into one Discovery problem", () => {
    const split = architectureSplit();
    expect(split["A. Discovery extraction problem"].length).toBeGreaterThan(0);
    expect(
      split["B. Discovery → Scene contract problem"].length
    ).toBeGreaterThan(0);
    expect(
      split["C. Projection / Runtime mapping problem"].length
    ).toBeGreaterThan(0);
    expect(split["A. Discovery extraction problem"]).toEqual(
      expect.arrayContaining(["S-ZOU-JING-ADVICE", "C-QINGZHOU"])
    );
    expect(split["B. Discovery → Scene contract problem"]).toEqual(
      expect.arrayContaining(["D-SLAYING", "C-RESCUE", "D-LIU-BEI"])
    );
    expect(split["C. Projection / Runtime mapping problem"]).toEqual(
      expect.arrayContaining(["C-DONG-ZHUO-APPEARANCE", "C-SCORN-CAUSE"])
    );
  });

  it("dense outcome lives on Story.summary and is dropped from Reader caption", () => {
    expect(CASE_DENSE.slice.storySummary).toMatch(/slay/i);
    expect(CASE_DENSE.slice.storySummary).toMatch(/Deng Mao/);
    expect(CASE_DENSE.slice.frames[0]!.caption).not.toMatch(/slay/i);
    expect(CASE_DENSE.slice.frames[0]!.caption).not.toMatch(/Deng Mao/);
    const drop = captionAuthorityDrops().find((r) => r.id === "D-SLAYING");
    expect(drop?.architecture).toBe(
      "B. Discovery → Scene contract problem"
    );
  });

  it("causal prevention is in this production caption (not the later Propose snapshot)", () => {
    expect(CASE_CAUSAL.slice.frames[0]!.caption).toMatch(/restrain/i);
    expect(CASE_CAUSAL.slice.storySummary).not.toMatch(/restrain/i);
    const prevent = LEDGER.find((r) => r.id === "C-PREVENT");
    expect(prevent?.runtimeCaption).toBe("Y");
    expect(prevent?.lossPoint).toBe("none");
  });

  it("Dong Zhuo is named in caption but missing from Context appearance", () => {
    expect(CASE_CAUSAL.slice.frames[0]!.caption).toMatch(/Dong Zhuo/);
    expect(CASE_CAUSAL.slice.context?.appearanceNames).toEqual([
      "Liu Bei",
      "Guan Yu",
      "Zhang Fei",
    ]);
    expect(CASE_CAUSAL.slice.context?.expressionRoles).not.toContain(
      "Dong Zhuo"
    );
    expect(CASE_CAUSAL.slice.context?.intentNames).not.toContain("Dong Zhuo");
  });

  it("relationship can survive on Context and still miss Reader caption", () => {
    expect(CASE_CAUSAL.slice.context?.relationship).toMatch(/brother/i);
    expect(CASE_CAUSAL.slice.frames[0]!.caption).not.toMatch(/brother/i);
  });

  it("appendix: merchant Story accepted with zero Frames", () => {
    expect(APPENDIX_MERCHANT_SLICE.frames).toHaveLength(0);
    expect(APPENDIX_MERCHANT_SLICE.context).toBeNull();
    expect(APPENDIX_MERCHANT_SLICE.storySummary).toMatch(/Zhang Shiping/);
  });

  it("appendix: peach-garden Story.summary has a name error that caption does not", () => {
    expect(APPENDIX_PEACH_SLICE.storySummary).toMatch(/Zhang Feng/);
    expect(APPENDIX_PEACH_SLICE.frames[0]!.caption).toMatch(/Zhang Fei/);
    expect(APPENDIX_PEACH_SLICE.frames[0]!.caption).not.toMatch(/Zhang Feng/);
  });

  it("does not introduce a Canon database or atomic fact review types", () => {
    const types = readFileSync(
      path.join(process.cwd(), "scripts/discovery-scene-spike/types.ts"),
      "utf8"
    );
    expect(types).not.toMatch(/export type WorkCanon/);
    expect(types).not.toMatch(/CandidateNarrativeFact/);
    const dump = readFileSync(
      path.join(
        process.cwd(),
        "scripts/discovery-scene-spike/dump-runtime.ts"
      ),
      "utf8"
    );
    expect(dump).not.toMatch(/from\("work_canon"\)/);
  });
});
