/**
 * SPEC-DVE-001 / ADR-011 A3–A4 — Visual Intent + Renderer Expression contract
 */

import { describe, expect, it } from "vitest";

import { normalizeRawCandidate } from "@/lib/discovery/candidate-validate";
import {
  adaptSceneExpressionForLocalCapability,
  assessSceneFaceSafety,
  findForbiddenPhysicsCues,
  findRestrictedFullFaceSceneCues,
  FORBIDDEN_PHYSICS_PATTERN,
  FULL_FACE_SCENE_PATTERN,
  remapGenericRolesToRoleNames,
  sharpenExpressionAnchors,
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

describe("Rule 6 Face Safety", () => {
  it("detects unrestricted full-face scene cues", () => {
    expect(FULL_FACE_SCENE_PATTERN.test("close-up of boy's face")).toBe(true);
    expect(FULL_FACE_SCENE_PATTERN.test("faces not close-up")).toBe(false);
    expect(FULL_FACE_SCENE_PATTERN.test("no close-up framing")).toBe(false);
    expect(
      findRestrictedFullFaceSceneCues({
        environment: "snow",
        characters: [{ role: "boy", visual: "young boy" }],
        action: "close-up of boy's terrified face staring at the camera",
        composition: "tight face fill frame",
      }).length
    ).toBeGreaterThan(0);
  });

  it("allows face-safe night duel Expression", () => {
    const assessment = assessSceneFaceSafety({
      environment: "snow clearing under moonlight",
      characters: [
        { role: "knight", visual: "armored knight in closed helmet holding sword" },
        {
          role: "white_walker",
          visual: "hooded ice warrior holding sword face hidden",
        },
      ],
      action: "two warriors facing each other with swords crossed at middle distance",
      composition: "wide shot two silhouettes facing each other",
    });
    expect(assessment.safety_status).toBe("allowed");
    expect(["hidden", "distant", "partial"]).toContain(
      assessment.inferredVisibility
    );
  });

  it("hard-rejects full-face scene cues on propose", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Close Face",
        summary: "s",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Close Face",
          rendererExpression: {
            environment: "snowy roadside",
            characters: [{ role: "boy", visual: "young boy" }],
            action: "close-up of boy's terrified face staring at the camera",
            composition: "tight face fill frame",
          },
        },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/full-face|Rule 6|face safety/i);
    }
  });

  it("marks high-risk without mitigation as requires_human_review", () => {
    const assessment = assessSceneFaceSafety({
      environment: "dark forest under moonlight",
      characters: [
        { role: "knight", visual: "knight holding sword" },
        { role: "walker", visual: "pale warrior holding ice blade" },
      ],
      action: "two warriors facing each other",
      composition: "two characters facing each other",
    });
    expect(assessment.safety_status).toBe("requires_human_review");
    expect(assessment.sceneRisk).toBe("high");
  });

  it("authorship adapt rewrites hand transfer and close dual framing", () => {
    const adapted = adaptSceneExpressionForLocalCapability({
      environment: "stone chamber",
      characters: [
        { role: "woman", visual: "winter wrap" },
        { role: "man", visual: "leather garb" },
      ],
      action: "woman handing parchment to man across table",
      composition: "two-shot framing figures from waist up indoors",
    });
    expect(adapted.action).toMatch(/letter on table/i);
    expect(adapted.action).not.toMatch(/handing/i);
    expect(adapted.composition).toMatch(/both figures fully visible/i);
    expect(adapted.composition).toMatch(/profiles or looking down/i);
    expect(adapted.action).toMatch(/left/i);
    expect(adapted.action).toMatch(/right/i);
    const safety = assessSceneFaceSafety(adapted);
    expect(safety.safety_status).toBe("allowed");
  });

  it("thins long Expression transport under Local blank threshold", () => {
    const prompt = rendererExpressionToPrompt({
      environment:
        "ancient godswood with dark waters and weirwood trees under overcast daylight and mist",
      characters: [
        {
          role: "Catelyn Stark",
          visual:
            "woman in southern-style noble gown holding raven scroll, dark gown with southern-cut grace, sealed letter",
        },
        {
          role: "Eddard Stark",
          visual:
            "man in dark fur-lined doublet holding Valyrian steel sword Ice, dark northern fur cloak, ancestral greatsword",
        },
      ],
      action:
        "sealed letter scroll resting on stone ledge between two figures, both looking down at letter, exactly two figures",
      composition:
        "medium-wide shot of two figures standing by stone wall with faces in profile, faces secondary, exactly 2 figures",
    });
    expect(prompt.length).toBeLessThan(520);
    expect(prompt).not.toMatch(/exactly two figures/i);
    expect(prompt).toMatch(/both figures fully visible/i);
  });

  it("remaps generic roles to Role names by order", () => {
    const remapped = remapGenericRolesToRoleNames(
      {
        environment: "godswood",
        characters: [
          { role: "woman", visual: "gown" },
          { role: "man", visual: "cloak" },
        ],
        action: "facing",
        composition: "wide",
      },
      ["Catelyn Stark", "Eddard Stark"]
    );
    expect(remapped.characters[0].role).toBe("Catelyn Stark");
    expect(remapped.characters[1].role).toBe("Eddard Stark");
  });

  it("sharpens godswood landmark and costume mutex", () => {
    const sharpened = sharpenExpressionAnchors({
      environment: "ancient forest with dark water and mist",
      characters: [
        {
          role: "Eddard Stark",
          visual:
            "dark northern tunic, heavy fur cloak, Valyrian steel sword Ice",
        },
        {
          role: "Catelyn Stark",
          visual: "southern noble gown, fur-trimmed winter cloak, letter scroll",
        },
      ],
      action: "two figures standing near dark pool",
      composition: "medium wide shot",
    });
    expect(sharpened.environment).toMatch(/weirwood face/i);
    expect(sharpened.environment).not.toMatch(/mist forest|ancient forest/i);
    expect(sharpened.characters[0].visual.toLowerCase()).toMatch(/ice/);
    expect(sharpened.characters[0].visual).not.toMatch(/gown/i);
    expect(sharpened.characters[1].visual).toMatch(/gown/i);
    expect(sharpened.characters[1].visual).not.toMatch(/fur-trimmed|fur mantle|heavy fur/i);
    expect(sharpened.characters[0].visual.split(",").length).toBeLessThanOrEqual(
      2
    );
    expect(sharpened.characters[1].visual.split(",").length).toBeLessThanOrEqual(
      2
    );
  });

  it("adapt dual-cast names left/right and strips exactly-N", () => {
    const adapted = adaptSceneExpressionForLocalCapability({
      environment: "Winterfell chamber",
      characters: [
        { role: "Eddard Stark", visual: "fur cloak" },
        { role: "Catelyn Stark", visual: "southern gown" },
      ],
      action: "letter on table, exactly two figures",
      composition: "medium wide shot, faces secondary, exactly 2 figures",
    });
    expect(adapted.action).not.toMatch(/exactly/i);
    expect(adapted.action).toMatch(/Eddard/i);
    expect(adapted.action).toMatch(/Catelyn/i);
    expect(adapted.action).toMatch(/left/i);
    expect(adapted.action).toMatch(/right/i);
    expect(adapted.composition).toMatch(/both figures fully visible/i);
    expect(adapted.environment).toMatch(/Winterfell|stone|table/i);
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
    expect(prompt).toContain("both figures fully visible");
    expect(prompt).toContain("profiles or looking down");
    expect(prompt).toContain("knight: armor, sword raised");
    expect(prompt).not.toContain("protects");
    expect(prompt).toContain("Frozen still");
    expect(prompt).toContain("No extra people");
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
