/**
 * SPEC-DVE-001 / ADR-011 A3–A4 — Visual Intent + Renderer Expression contract
 */

import { describe, expect, it } from "vitest";

import { normalizeRawCandidate } from "@/lib/discovery/candidate-validate";
import {
  findForbiddenPhysicsCues,
  FORBIDDEN_PHYSICS_PATTERN,
} from "@/lib/discovery/expression-capability-rules";
import { buildFrameDraftPrompt } from "@/lib/prompts/frame-draft";
import { parseFrameProvenance } from "@/lib/rollout/scenes-server";
import {
  MINIMAL_RENDERER_EXPRESSION,
  parseRendererExpression,
  parseVisualIntent,
  rendererExpressionToPrompt,
} from "@/lib/discovery/visual-contract";

const SAMPLE_EXPRESSION = {
  environment: "castle hall",
  characters: [
    { role: "knight", visual: "armor, sword raised" },
    { role: "king", visual: "crown, seated on throne" },
  ],
  action: "knight kneels holding sword before king",
  composition: "foreground knight, background king on throne",
};

describe("parseRendererExpression", () => {
  it("accepts required fields and empty cast", () => {
    const result = parseRendererExpression({
      environment: "abandoned castle at night",
      characters: [],
      action: "empty courtyard",
      composition: "wide view of castle entrance",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing environment", () => {
    const result = parseRendererExpression({
      characters: [],
      action: "empty courtyard",
      composition: "wide view",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects quality-spam styleHints", () => {
    const result = parseRendererExpression({
      ...SAMPLE_EXPRESSION,
      styleHints: "masterpiece, 8k",
    });
    expect(result.ok).toBe(false);
  });

  it("warns on forbidden physics cues without rejecting parse (legacy render path)", () => {
    const result = parseRendererExpression({
      ...SAMPLE_EXPRESSION,
      action: "monster lifts soldier by the throat",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.includes("forbidden physics"))).toBe(
        true
      );
    }
  });
});

describe("A4 capability adaptation", () => {
  it("detects lift/shatter cues", () => {
    expect(FORBIDDEN_PHYSICS_PATTERN.test("lifts ranger")).toBe(true);
    expect(FORBIDDEN_PHYSICS_PATTERN.test("sword shatters into fragments")).toBe(
      true
    );
    expect(FORBIDDEN_PHYSICS_PATTERN.test("hands gripping collar")).toBe(false);
    expect(
      findForbiddenPhysicsCues({
        action: "white walker towering over fallen ranger",
        composition: "both full bodies visible",
        characters: [],
      })
    ).toEqual([]);
  });

  it("hard-rejects physics cues on scene propose", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Choke",
        summary: "s",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Choke",
          rendererExpression: {
            ...SAMPLE_EXPRESSION,
            action: "undead lifts ranger by the throat",
          },
        },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/physics cues/i);
    }
  });

  it("hard-rejects cast count mismatch on scene propose", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Camp",
        summary: "s",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Camp",
          rendererExpression: {
            environment: "snowy pine forest",
            characters: [
              { role: "ranger", visual: "holding spear" },
              { role: "commander", visual: "holding sword" },
            ],
            action: "three rangers standing near frozen bodies on snow",
            composition: "three figures standing in forest clearing",
          },
        },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/cast inconsistency/i);
    }
  });

  it("accepts consistent three-ranger cast", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Camp",
        summary: "s",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Camp",
          rendererExpression: {
            environment: "snowy pine forest",
            characters: [
              { role: "ranger", visual: "holding spear" },
              { role: "ranger", visual: "holding bow" },
              { role: "commander", visual: "holding sword" },
            ],
            action: "three rangers standing near frozen bodies on snow",
            composition: "three figures standing in forest clearing",
          },
        },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(true);
  });
});

describe("parseVisualIntent", () => {
  it("allows null / omitted", () => {
    expect(parseVisualIntent(null).ok).toBe(true);
    expect(parseVisualIntent(undefined).ok).toBe(true);
  });

  it("allows landscape with null relationship", () => {
    const result = parseVisualIntent({ relationship: null, purpose: "mood" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.relationship).toBeNull();
    }
  });
});

describe("rendererExpressionToPrompt", () => {
  it("joins expression fields without inventing meaning", () => {
    const prompt = rendererExpressionToPrompt(SAMPLE_EXPRESSION);
    expect(prompt).toContain("Action: knight kneels");
    expect(prompt).toContain("Environment: castle hall");
    expect(prompt).toContain("Composition: foreground knight");
    expect(prompt).toContain("knight: armor, sword raised");
    expect(prompt).not.toContain("protects");
    expect(prompt).toContain("frozen cinematic still");
    expect(prompt).toContain("static poses");
  });
});

describe("buildFrameDraftPrompt Expression-first", () => {
  it("uses thin Expression transport without long caption wrapper", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "legacy caption should not dominate",
      rendererExpression: SAMPLE_EXPRESSION,
    });
    expect(prompt).toContain("knight kneels holding sword");
    expect(prompt).not.toContain("legacy caption should not dominate");
    expect(prompt).not.toContain("Scene content (authoritative)");
    expect(prompt).not.toContain("Must match scene:");
    expect(prompt.split("knight kneels holding sword").length - 1).toBe(1);
  });

  it("keeps operator revision with Expression", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "legacy\n\n[操作员修改意见] 加雨",
      rendererExpression: SAMPLE_EXPRESSION,
    });
    expect(prompt).toContain("OPERATOR OVERRIDE");
    expect(prompt).toContain("加雨");
    expect(prompt).toContain("knight kneels");
    expect(prompt.indexOf("OPERATOR OVERRIDE")).toBeLessThan(
      prompt.indexOf("knight kneels")
    );
  });

  it("falls back to caption when Expression absent", () => {
    const prompt = buildFrameDraftPrompt({ caption: "街垒夜战" });
    expect(prompt).toContain("街垒夜战");
    expect(prompt).toContain("Scene content (authoritative)");
  });

  it("never requires Intent in prompt builder input", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "x",
      rendererExpression: MINIMAL_RENDERER_EXPRESSION,
    });
    expect(prompt).not.toContain("visualIntent");
    expect(prompt).not.toContain("relationship");
  });
});

describe("normalizeRawCandidate scene Expression", () => {
  it("requires rendererExpression on scene propose", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Courtyard",
        summary: "s",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Courtyard",
        },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(false);
  });

  it("keeps Expression and optional Intent", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Courtyard",
        summary: "s",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Courtyard",
          visualIntent: { relationship: "household greets king" },
          rendererExpression: SAMPLE_EXPRESSION,
        },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(true);
    if (result.ok && "rendererExpression" in result.candidate.fields) {
      expect(result.candidate.fields.rendererExpression.environment).toBe(
        "castle hall"
      );
      expect(result.candidate.fields.visualIntent?.relationship).toBe(
        "household greets king"
      );
    }
  });
});

describe("parseFrameProvenance Expression round-trip", () => {
  it("preserves rendererExpression on provenance entries", () => {
    const parsed = parseFrameProvenance([
      {
        sourceReviewId: "rev-1",
        frameIndex: 0,
        rendererExpression: SAMPLE_EXPRESSION,
        visualIntent: { purpose: "establish tension" },
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.rendererExpression?.action).toContain("kneels");
    expect(parsed[0]!.visualIntent?.purpose).toBe("establish tension");
  });
});
