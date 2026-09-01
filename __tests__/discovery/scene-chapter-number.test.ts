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

  it("accepts zero as prologue index", () => {
    expect(parseSceneChapterNumber(0)).toBe(0);
    expect(isValidSceneChapterNumber(0)).toBe(true);
    expect(isValidSceneChapterNumber("0")).toBe(true);
  });

  it("rejects negative", () => {
    expect(isValidSceneChapterNumber(-1)).toBe(false);
  });

  it("validateSceneAcceptFields aligns with Rollout rules", () => {
    const expression = {
      environment: "winter courtyard",
      characters: [] as { role: string; visual: string }[],
      action: "household stands facing gate",
      composition: "wide courtyard view",
    };
    const bad = validateSceneAcceptFields({
      parentStoryCandidateId: "story-1",
      chapter_number: "Bran I",
      chapter_title: "Bran I",
      title: "Courtyard",
      rendererExpression: expression,
    });
    expect(bad.ok).toBe(false);

    const missingParent = validateSceneAcceptFields({
      chapter_number: 1,
      chapter_title: "Bran I",
      title: "Courtyard",
      rendererExpression: expression,
    } as never);
    expect(missingParent.ok).toBe(false);

    const good = validateSceneAcceptFields({
      parentStoryCandidateId: "story-1",
      chapter_number: 1,
      chapter_title: "Bran I",
      title: "Courtyard",
      rendererExpression: expression,
    });
    const prologue = validateSceneAcceptFields({
      parentStoryCandidateId: "story-1",
      chapter_number: 0,
      chapter_title: "Prologue",
      title: "The Wall",
      rendererExpression: expression,
    });
    expect(prologue.ok).toBe(true);
  });
});
