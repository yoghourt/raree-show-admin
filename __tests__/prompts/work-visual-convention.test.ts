import { describe, expect, it } from "vitest";

import {
  clipWorkVisualConvention,
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
    expect(block).toMatch(/Work visual convention/);
    expect(block).toMatch(/caption beat still win/);
    expect(block).toContain(clipped);
  });
});
