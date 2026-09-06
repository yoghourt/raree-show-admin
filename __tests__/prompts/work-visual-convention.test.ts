import { describe, expect, it } from "vitest";

import {
  clipWorkVisualConvention,
  flattenWorkVisualConventionForPrompt,
  forbidsFromUnlabeledNegations,
  forbidsFromWorkVisualConvention,
  stripPositiveNegations,
  workTitleAndConventionFromRow,
  workVisualConventionFromRow,
  workVisualConventionPromptBlock,
  WORK_VISUAL_CONVENTION_MAX_CHARS,
  WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS,
} from "@/lib/prompts/work-visual-convention";

describe("clipWorkVisualConvention", () => {
  it("returns empty for blank input", () => {
    expect(clipWorkVisualConvention("   ")).toBe("");
    expect(clipWorkVisualConvention("")).toBe("");
  });

  it("collapses whitespace and respects persist budget", () => {
    expect(clipWorkVisualConvention("ERA:  medieval   wool.")).toBe(
      "ERA: medieval wool."
    );
    const long = "x".repeat(WORK_VISUAL_CONVENTION_MAX_CHARS + 40);
    const clipped = clipWorkVisualConvention(long);
    expect(clipped.length).toBeLessThanOrEqual(
      WORK_VISUAL_CONVENTION_MAX_CHARS + 1
    );
    expect(clipped.endsWith("…")).toBe(true);
  });
});

describe("workVisualConventionFromRow", () => {
  it("reads visual_convention and ignores missing column", () => {
    expect(
      workVisualConventionFromRow({ visual_convention: "ERA: wool." })
    ).toBe("ERA: wool.");
    expect(workVisualConventionFromRow({ title: "A" })).toBe("");
    expect(workVisualConventionFromRow(null)).toBe("");
  });
});

describe("workTitleAndConventionFromRow", () => {
  it("parses title and convention together", () => {
    expect(
      workTitleAndConventionFromRow({
        title: "A Game of Thrones",
        visual_convention: "ERA: medieval wool.",
      })
    ).toEqual({
      title: "A Game of Thrones",
      visualConvention: "ERA: medieval wool.",
    });
  });
});

describe("workVisualConventionPromptBlock", () => {
  it("returns empty when unset", () => {
    expect(workVisualConventionPromptBlock("")).toBe("");
    expect(workVisualConventionPromptBlock(undefined)).toBe("");
  });

  it("clips to execute budget and says character/caption still win", () => {
    const long = `ERA: ${"wool, ".repeat(80)}FORBID: camouflage.`;
    const clipped = clipWorkVisualConvention(
      long,
      WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS
    );
    expect(clipped.length).toBeLessThanOrEqual(
      WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS + 1
    );
    const block = workVisualConventionPromptBlock(long);
    expect(block).not.toMatch(/Work look/);
    expect(block).not.toMatch(/\bERA\s*:/);
    expect(block).not.toMatch(/\bFORBID\s*:/);
    expect(block).toMatch(/wool/);
  });
});

describe("flattenWorkVisualConventionForPrompt", () => {
  it("strips section labels and drops FORBID from the positive block", () => {
    const flat = flattenWorkVisualConventionForPrompt(
      "STYLE: painterly. ERA: wool, fur. FORBID: modern military, olive drab."
    );
    expect(flat).toMatch(/painterly/);
    expect(flat).toMatch(/wool/);
    expect(flat).not.toMatch(/cloak/i);
    expect(flat).not.toMatch(/\bSTYLE\s*:/i);
    expect(flat).not.toMatch(/\bERA\s*:/i);
    expect(flat).not.toMatch(/modern military/);
  });

  it("drops work-wide cloaks so they cannot paint every figure the same", () => {
    const flat = flattenWorkVisualConventionForPrompt(
      "STYLE: painterly digital painting. ERA: medieval wool, fur, leather, all-black cloaks."
    );
    expect(flat).toMatch(/painterly/);
    expect(flat).toMatch(/wool/);
    expect(flat).toMatch(/leather/);
    expect(flat).not.toMatch(/cloak/i);
  });

  it("drops unlabeled no-X forbids from the positive block", () => {
    const flat = flattenWorkVisualConventionForPrompt(
      "painterly digital painting, medieval wool fur leather, no modern military, no olive drab, no camouflage"
    );
    expect(flat).toMatch(/painterly/);
    expect(flat).toMatch(/wool/);
    expect(flat).not.toMatch(/camouflage/i);
    expect(flat).not.toMatch(/olive drab/i);
    expect(flat).not.toMatch(/modern military/i);
    expect(flat).not.toMatch(/\bno\b/i);
  });
});

describe("forbidsFromWorkVisualConvention", () => {
  it("extracts FORBID clauses for negatives", () => {
    expect(
      forbidsFromWorkVisualConvention(
        "STYLE: painterly. FORBID: modern military, olive drab."
      )
    ).toEqual(["modern military", "olive drab"]);
  });

  it("extracts unlabeled no-X prose for negatives", () => {
    expect(
      forbidsFromWorkVisualConvention(
        "painterly, no modern military, no olive drab, no camouflage"
      )
    ).toEqual(["modern military", "olive drab", "camouflage"]);
  });
});

describe("stripPositiveNegations", () => {
  it("removes no-X clauses and anachronism nouns from Local positives", () => {
    expect(
      stripPositiveNegations(
        "dark mail, no camouflage, no olive drab, pale dead face"
      )
    ).toBe("dark mail, pale dead face");
    expect(
      stripPositiveNegations(
        "Ser Waymar Royce standing right, living human, younger, no grey hair, no silver beard. haunted forest"
      )
    ).toBe(
      "Ser Waymar Royce standing right, living human, younger. haunted forest"
    );
    expect(forbidsFromUnlabeledNegations("no camouflage, not a child")).toEqual([
      "camouflage",
      "child",
    ]);
  });
});
