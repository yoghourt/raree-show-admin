import { FIXTURE_A as GRANULARITY_FIXTURE_A } from "../granularity-gate-spike/fixtures";
import type { GranularityInput } from "../../lib/discovery/granularity-gate/types";
import type { Coverage } from "./types";

/** Provenance only — spike code must not branch on workId. */
export const PRIMARY_WORK_PROVENANCE = {
  workId: "42c22be9-ac88-4407-90cf-19cf79847d07",
  capturedAt: "2026-08-19T02:05:04.590Z",
  note: "Propose snapshot reused from SPIKE-GRANULARITY-GATE-001 Fixture A.",
} as const;

const SOURCE = GRANULARITY_FIXTURE_A.input.sourceText;

export type CoverageMap = Record<string, { story: Coverage; caption: Coverage }>;

export type RieFixture = {
  id: "A" | "B_LOSS" | "B_KEEP";
  label: string;
  expectedGate: "PASS" | "FAIL";
  expectedInformation: "PASS" | "FAIL";
  provenance?: typeof PRIMARY_WORK_PROVENANCE;
  input: GranularityInput;
  /** Human annotation. Authority for PRESENT/PARTIAL/LOST — not token overlap. */
  coverage: CoverageMap;
};

/** Case A — actual Propose topology 5×1. Captions are often decent; prevention is not. */
export const FIXTURE_A: RieFixture = {
  id: "A",
  label: "Actual Propose — 5 Stories × 1 Frame",
  expectedGate: "FAIL",
  expectedInformation: "FAIL",
  provenance: PRIMARY_WORK_PROVENANCE,
  input: GRANULARITY_FIXTURE_A.input,
  coverage: {
    "U-REBELLION": { story: "PRESENT", caption: "PRESENT" },
    "U-NOTICE": { story: "PARTIAL", caption: "PRESENT" },
    "U-MEET-OATH": { story: "PRESENT", caption: "PRESENT" },
    "U-ARMS": { story: "PRESENT", caption: "PRESENT" },
    "U-DAXING": { story: "PRESENT", caption: "PRESENT" },
    "U-RESCUE": { story: "PRESENT", caption: "PRESENT" },
    "U-SCORN": { story: "PRESENT", caption: "PRESENT" },
    "U-ATTEMPT": { story: "LOST", caption: "PRESENT" },
    "U-PREVENT": { story: "LOST", caption: "LOST" },
    "U-ATTEMPT-PREVENTED": { story: "LOST", caption: "PARTIAL" },
    "U-OATH-TEXT": { story: "LOST", caption: "LOST" },
    "U-WEAPON-NAMES": { story: "LOST", caption: "PRESENT" },
    "U-QINGZHOU": { story: "LOST", caption: "LOST" },
    "U-THEME": { story: "LOST", caption: "LOST" },
    "U-COUNTS": { story: "LOST", caption: "LOST" },
  },
};

/**
 * Case B — topology-correct 1 Story × 4 Frames (setup / conflict / attempt / consequence).
 * Story.summary carries the prevented killing; Frame 3 only names the people present.
 * Gate must PASS. Information Equivalence must FAIL.
 */
export const FIXTURE_B_LOSS: RieFixture = {
  id: "B_LOSS",
  label: "Correct topology 1×4 — captions drop prevented killing",
  expectedGate: "PASS",
  expectedInformation: "FAIL",
  input: {
    sourceText: SOURCE,
    stories: [
      {
        id: "story-arc",
        title: "From the Notice to Dong Zhuo's Contempt",
        summary:
          "Liu Bei, Guan Yu, and Zhang Fei rise from a recruitment notice, swear brotherhood, win at Mount Daxing, and rescue Dong Zhuo. Zhang Fei attempted to kill Dong Zhuo, but Liu Bei and Guan Yu prevented it.",
      },
    ],
    frames: [
      {
        id: "f1",
        parentStoryId: "story-arc",
        title: "Setup",
        caption:
          "Yellow Turban Rebellion spreads. Prefect Liu Yan posts a recruitment notice in Zhuozhou. Liu Bei, Guan Yu, and Zhang Fei meet, drink, and swear brotherhood in a peach garden.",
      },
      {
        id: "f2",
        parentStoryId: "story-arc",
        title: "Conflict",
        caption:
          "Merchants Zhang Shiping and Su Shuang fund them. They forge weapons, raise a militia, and win a first victory at Mount Daxing against Yellow Turban commanders.",
      },
      {
        id: "f3",
        parentStoryId: "story-arc",
        title: "Attempt / intervention",
        caption:
          "The brothers rescue Dong Zhuo from a siege. Afterward Liu Bei, Guan Yu, Zhang Fei, and Dong Zhuo are together in the camp. Dong Zhuo treats the brothers with contempt.",
      },
      {
        id: "f4",
        parentStoryId: "story-arc",
        title: "Consequence",
        caption:
          "The brothers leave the camp having been scorned for their lack of rank. Class prejudice hangs over the encounter.",
      },
    ],
  },
  coverage: {
    "U-REBELLION": { story: "LOST", caption: "PRESENT" },
    "U-NOTICE": { story: "PARTIAL", caption: "PRESENT" },
    "U-MEET-OATH": { story: "PRESENT", caption: "PRESENT" },
    "U-ARMS": { story: "LOST", caption: "PRESENT" },
    "U-DAXING": { story: "PRESENT", caption: "PRESENT" },
    "U-RESCUE": { story: "PRESENT", caption: "PRESENT" },
    "U-SCORN": { story: "LOST", caption: "PRESENT" },
    "U-ATTEMPT": { story: "PRESENT", caption: "LOST" },
    "U-PREVENT": { story: "PRESENT", caption: "LOST" },
    "U-ATTEMPT-PREVENTED": { story: "PRESENT", caption: "LOST" },
    "U-OATH-TEXT": { story: "LOST", caption: "LOST" },
    "U-WEAPON-NAMES": { story: "LOST", caption: "LOST" },
    "U-QINGZHOU": { story: "LOST", caption: "LOST" },
    "U-THEME": { story: "LOST", caption: "PARTIAL" },
    "U-COUNTS": { story: "LOST", caption: "LOST" },
  },
};

/** Control: same 1×4 topology, captions carry the prevented killing. */
export const FIXTURE_B_KEEP: RieFixture = {
  id: "B_KEEP",
  label: "Correct topology 1×4 — captions carry prevented killing",
  expectedGate: "PASS",
  expectedInformation: "PASS",
  input: {
    sourceText: SOURCE,
    stories: [
      {
        id: "story-arc",
        title: "From the Notice to Dong Zhuo's Contempt",
        summary:
          "Liu Bei, Guan Yu, and Zhang Fei rise from a recruitment notice, swear brotherhood, win at Mount Daxing, and rescue Dong Zhuo. Zhang Fei attempted to kill Dong Zhuo, but Liu Bei and Guan Yu prevented it.",
      },
    ],
    frames: [
      {
        id: "f1",
        parentStoryId: "story-arc",
        title: "Setup",
        caption:
          "Yellow Turban Rebellion spreads. Prefect Liu Yan posts a recruitment notice in Zhuozhou. Liu Bei, Guan Yu, and Zhang Fei meet, drink, and swear brotherhood in a peach garden.",
      },
      {
        id: "f2",
        parentStoryId: "story-arc",
        title: "Conflict",
        caption:
          "Merchants Zhang Shiping and Su Shuang fund them. They forge weapons, raise a militia, and win a first victory at Mount Daxing against Yellow Turban commanders.",
      },
      {
        id: "f3",
        parentStoryId: "story-arc",
        title: "Attempt / intervention",
        caption:
          "The brothers rescue Dong Zhuo from a Yellow Turban siege. Dong Zhuo scorns them for having no rank. Zhang Fei tries to kill Dong Zhuo; Liu Bei and Guan Yu restrain him and prevent the killing.",
      },
      {
        id: "f4",
        parentStoryId: "story-arc",
        title: "Consequence",
        caption:
          "The brothers leave having been scorned for their lack of rank. Class prejudice hangs over the encounter.",
      },
    ],
  },
  coverage: {
    "U-REBELLION": { story: "LOST", caption: "PRESENT" },
    "U-NOTICE": { story: "PARTIAL", caption: "PRESENT" },
    "U-MEET-OATH": { story: "PRESENT", caption: "PRESENT" },
    "U-ARMS": { story: "LOST", caption: "PRESENT" },
    "U-DAXING": { story: "PRESENT", caption: "PRESENT" },
    "U-RESCUE": { story: "PRESENT", caption: "PRESENT" },
    "U-SCORN": { story: "LOST", caption: "PRESENT" },
    "U-ATTEMPT": { story: "PRESENT", caption: "PRESENT" },
    "U-PREVENT": { story: "PRESENT", caption: "PRESENT" },
    "U-ATTEMPT-PREVENTED": { story: "PRESENT", caption: "PRESENT" },
    "U-OATH-TEXT": { story: "LOST", caption: "LOST" },
    "U-WEAPON-NAMES": { story: "LOST", caption: "LOST" },
    "U-QINGZHOU": { story: "LOST", caption: "LOST" },
    "U-THEME": { story: "LOST", caption: "PARTIAL" },
    "U-COUNTS": { story: "LOST", caption: "LOST" },
  },
};

export const RIE_FIXTURES: RieFixture[] = [
  FIXTURE_A,
  FIXTURE_B_LOSS,
  FIXTURE_B_KEEP,
];
