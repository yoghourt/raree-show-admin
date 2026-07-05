/**
 * Scene chapter_number parsing tests
 */

import { describe, expect, it } from "vitest";

import {
  isValidSceneChapterNumber,
  parseSceneChapterNumber,
} from "@/lib/discovery/scene-chapter-number";
import { validateSceneAcceptFields } from "@/lib/discovery/review-state";

describe("scene chapter_number", () => {
  it("accepts positive integers", () => {
    expect(parseSceneChapterNumber(1)).toBe(1);
    expect(parseSceneChapterNumber("12")).toBe(12);
    expect(isValidSceneChapterNumber("01")).toBe(true);
  });

  it("rejects POV labels and non-numeric strings", () => {
    expect(isValidSceneChapterNumber("Bran I")).toBe(false);
    expect(isValidSceneChapterNumber("Chapter 1")).toBe(false);
    expect(parseSceneChapterNumber("abc")).toBeNull();
  });

  it("rejects zero and negative", () => {
    expect(isValidSceneChapterNumber(0)).toBe(false);
    expect(isValidSceneChapterNumber(-1)).toBe(false);
  });

  it("validateSceneAcceptFields aligns with Rollout rules", () => {
    const bad = validateSceneAcceptFields({
      chapter_number: "Bran I",
      chapter_title: "Bran I",
      title: "Courtyard",
    });
    expect(bad.ok).toBe(false);

    const good = validateSceneAcceptFields({
      chapter_number: 1,
      chapter_title: "Bran I",
      title: "Courtyard",
    });
    expect(good.ok).toBe(true);
  });
});
