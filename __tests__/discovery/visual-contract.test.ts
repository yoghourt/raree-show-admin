/**
 * SPEC-DVE-001 / ADR-011 A3–A4 — Visual Intent + Renderer Expression contract
 */

import { describe, expect, it } from "vitest";

import { foldCharacterArchivesIntoExpression } from "@/lib/discovery/character-archive";
import { normalizeRawCandidate } from "@/lib/discovery/candidate-validate";
import {
  SD35_CAPABILITY,
  Z_IMAGE_TURBO_CAPABILITY,
} from "@/lib/ai/image/rendererCapability";
import {
  expressionToPrompt,
  LOCAL_PROMPT_BODY_MAX,
  projectExpressionForDeployment,
} from "@/lib/discovery/execution-projection";
import { FRAMES } from "../../scripts/evg-001-cross-work-visual/fixtures";
import {
  adaptSceneExpressionForLocalCapability,
  assessSceneFaceSafety,
  findForbiddenPhysicsCues,
  findRestrictedFullFaceSceneCues,
  FORBIDDEN_PHYSICS_PATTERN,
  FULL_FACE_SCENE_PATTERN,
  pinIdentityLocks,
  pinRelativeAgeContrast,
  promoteDistinctiveGarments,
  remapGenericRolesToRoleNames,
  sharpenExpressionAnchors,
} from "@/lib/discovery/expression-capability-rules";
import { buildFrameDraftPrompt, buildFrameNegativePrompt } from "@/lib/prompts/frame-draft";
import { parseFrameProvenance } from "@/lib/rollout/scenes-server";
import {
  MINIMAL_RENDERER_EXPRESSION,
  executableRendererExpression,
  isStubRendererExpression,
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
  // left/right + both roles so Local adapt keeps action (only forces composition).
  action:
    "knight left kneeling with sword raised, king right on throne, both fully visible",
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

  it("accepts optional atmosphere / threatPerception / visualEmphasis", () => {
    const result = parseRendererExpression({
      ...SAMPLE_EXPRESSION,
      lighting: "cold moonlight",
      atmosphere: "bitter hush",
      threatPerception: "unseen pressure in the fog",
      visualEmphasis: "spears and formation",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.atmosphere).toBe("bitter hush");
      expect(result.value.threatPerception).toBe("unseen pressure in the fog");
      expect(result.value.visualEmphasis).toBe("spears and formation");
      expect(result.value.lighting).toBe("cold moonlight");
    }
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
          summary: "Reader step draft",
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
          summary: "Reader step draft",
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
          summary: "Reader step draft",
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
          summary: "Reader step draft",
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
    expect(adapted.action).toMatch(/parchment/i);
    expect(adapted.action).not.toMatch(/handing/i);
    expect(adapted.action).not.toMatch(/\bletter\b/i);
    expect(adapted.composition).toMatch(/both visible/i);
    expect(adapted.composition).toMatch(/identity weapons in frame/i);
    expect(adapted.action).toMatch(/left/i);
    expect(adapted.action).toMatch(/right/i);
    const safety = assessSceneFaceSafety(adapted);
    expect(safety.safety_status).toBe("allowed");
  });

  it("thins long Expression transport under Local blank threshold", () => {
    const prompt = expressionToPrompt(
      {
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
        atmosphere: "grave hush before hard news",
      },
      "local"
    );
    expect(prompt.length).toBeLessThanOrEqual(LOCAL_PROMPT_BODY_MAX);
    expect(prompt).not.toMatch(/exactly two figures/i);
    expect(prompt).toMatch(/medium-wide shot of two figures/i);
    expect(prompt).not.toMatch(/Atmosphere:/i);
  });

  it("cloud projection preserves atmosphere and authored composition", () => {
    const expr = {
      ...SAMPLE_EXPRESSION,
      atmosphere: "tense loyalty under threat",
      threatPerception: "imminent violence",
      lighting: "ember key, faces in soft shadow",
    };
    const prompt = expressionToPrompt(expr, "cloud");
    expect(prompt).toMatch(/Atmosphere: tense loyalty/i);
    expect(prompt).toMatch(/Threat: imminent violence/i);
    expect(prompt).toMatch(/Lighting: ember key/i);
    expect(prompt).toContain("foreground knight, background king");
    expect(prompt).not.toMatch(/both figures fully visible/i);
    expect(prompt).toContain("Single narrative still");
  });

  it("propose persist keeps authored composition (no Local adapt overwrite)", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Patrol",
        summary: "s",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Patrol",
          summary: "Reader step draft",
          rendererExpression: {
            environment: "snow forest beyond the Wall",
            characters: [
              { role: "ranger lead", visual: "black cloak, spear" },
              { role: "ranger mate", visual: "black furs" },
            ],
            action:
              "ranger lead left, ranger mate right, both fully visible scanning trees",
            composition:
              "medium-wide story still, lead slightly forward, forest depth behind",
            atmosphere: "bitter cold hush",
          },
        },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const expr = result.candidate.fields.rendererExpression as {
        composition: string;
        atmosphere?: string;
      };
      expect(expr.composition).toContain("forest depth behind");
      expect(expr.composition).not.toMatch(
        /^medium wide shot, both figures fully visible/
      );
      expect(expr.atmosphere).toBe("bitter cold hush");
    }
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

  it("preserves authored location identity instead of substituting a place", () => {
    const sharpened = sharpenExpressionAnchors({
      environment: "Han military tent, campaign table, hanging maps",
      characters: [
        {
          role: "Guan Yu",
          visual:
            "Green Dragon Crescent Blade, red face, long beard, green robe, back-three-quarter",
        },
      ],
      action: "looking down at campaign maps on the table",
      composition: "medium wide shot",
    });
    expect(sharpened.environment).toMatch(/tent/i);
    expect(sharpened.environment).not.toMatch(/winterfell|stone chamber/i);
    expect(sharpened.characters[0].visual).toMatch(/crescent blade/i);
    expect(sharpened.characters[0].visual).toMatch(/red face/i);
    expect(sharpened.characters[0].visual).toMatch(/beard/i);
    expect(sharpened.characters[0].visual).not.toMatch(/back-three-quarter/i);
  });

  it("keeps named identity symbols over action phrases in the same visual budget", () => {
    const sharpened = sharpenExpressionAnchors({
      environment: "Han felt command tent, campaign map on wooden table",
      characters: [
        {
          role: "Guan Yu",
          visual:
            "Green Dragon Crescent Blade, red face, long beard, green robe, looking down at map",
        },
      ],
      action: "looking down at campaign maps on the table",
      composition: "medium wide shot",
    });
    const visual = sharpened.characters[0].visual;
    expect(visual).toMatch(/Green Dragon Crescent Blade/);
    expect(visual).toMatch(/red face/i);
    expect(visual).toMatch(/long beard/i);
    expect(visual).toMatch(/green robe/i);
    expect(visual).not.toMatch(/looking down/i);
    expect(visual).not.toMatch(/\b(sword|weapon)\b/i);
  });

  it("applies the same action-vs-identity ranking on a northern character", () => {
    const sharpened = sharpenExpressionAnchors({
      environment: "Winterfell solar, granite chamber, timber table",
      characters: [
        {
          role: "Eddard Stark",
          visual:
            "greatsword Ice, northern fur cloak, bearded, head bowed profile, looking down at letter",
        },
      ],
      action: "looking down at sealed letter on wooden table",
      composition: "medium wide shot",
    });
    const visual = sharpened.characters[0].visual;
    expect(visual).toMatch(/greatsword Ice/i);
    expect(visual).toMatch(/fur cloak/i);
    expect(visual).toMatch(/bearded/i);
    expect(visual).not.toMatch(/looking down/i);
    expect(visual).not.toMatch(/^(?:.*\b)?(?:sword|blade)\b(?!.*greatsword)/i);
  });

  it("does not rewrite a named map into a letter", () => {
    const adapted = adaptSceneExpressionForLocalCapability({
      environment: "Han command tent, campaign map on wooden table",
      characters: [
        { role: "Liu Bei", visual: "plain Han robe, twin swords" },
        { role: "Guan Yu", visual: "Green Dragon Crescent Blade, green robe" },
      ],
      action: "Liu Bei and Guan Yu looking down at a campaign map on the table",
      composition: "medium wide shot, faces secondary",
    });
    expect(adapted.environment).toMatch(/tent/i);
    expect(adapted.environment).toMatch(/map/i);
    expect(adapted.environment).not.toMatch(/winterfell/i);
    expect(adapted.action).toMatch(/map/i);
    expect(adapted.action).not.toMatch(/letter|parchment/i);
    expect(adapted.action).toMatch(/left/i);
    expect(adapted.action).toMatch(/right/i);
  });

  it("adapt dual-cast names left/right and strips exactly-N without changing place", () => {
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
    expect(adapted.action).toMatch(/letter/i);
    expect(adapted.composition).toMatch(/medium wide shot/i);
    expect(adapted.environment).toBe("Winterfell chamber");
  });

  it("does not replace a dual-cast story action with a placement-only stub", () => {
    const adapted = adaptSceneExpressionForLocalCapability({
      environment: "opulent imperial palace interior, ornate pillars and silk draperies",
      characters: [
        {
          role: "Yuan Shao",
          visual: "standing, swinging a heavy jian sword, decorated armor",
        },
        {
          role: "Cao Cao",
          visual: "standing, lunging forward with a drawn dao saber",
        },
      ],
      action:
        "Yuan Shao and Cao Cao storm the palace, both figures striking down fleeing eunuchs",
      composition: "medium wide shot, faces secondary, dynamic dual-cast framing",
    });
    expect(adapted.action).toMatch(/storm the palace/i);
    expect(adapted.action).toMatch(/eunuchs/i);
    expect(adapted.action).not.toMatch(
      /^(Yuan|Cao) left, (Yuan|Cao) right, both fully visible$/i
    );
    expect(adapted.action).toMatch(/left/i);
    expect(adapted.action).toMatch(/right/i);
    expect(adapted.composition).toMatch(/medium wide shot/i);
    expect(adapted.composition).toMatch(/dynamic dual-cast framing/i);
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
  it("joins expression fields without inventing meaning (local profile)", () => {
    const prompt = expressionToPrompt(SAMPLE_EXPRESSION, "local");
    expect(prompt).toContain("knight left kneeling");
    expect(prompt).toContain("castle hall");
    expect(prompt).toContain("foreground knight, background king");
    expect(prompt).toContain("armor, sword raised");
    expect(prompt).not.toMatch(/knight:/i);
    expect(prompt).not.toMatch(/\bAction:/);
    expect(prompt).not.toMatch(/\bFigures:/);
    expect(prompt).not.toMatch(/VISUAL LOCK/);
    expect(prompt).not.toContain("protects");
    expect(prompt).not.toMatch(/\byounger\b/i);
    expect(prompt).not.toMatch(/living human/i);
  });

  it("legacy rendererExpressionToPrompt still returns a prompt", () => {
    expect(rendererExpressionToPrompt(SAMPLE_EXPRESSION).length).toBeGreaterThan(
      20
    );
  });

  it("local projectExpressionForDeployment keeps authored dual-cast composition", () => {
    const projected = projectExpressionForDeployment(SAMPLE_EXPRESSION, "local");
    expect(projected.composition).toBe(SAMPLE_EXPRESSION.composition);
    const cloud = projectExpressionForDeployment(SAMPLE_EXPRESSION, "cloud");
    expect(cloud.composition).toBe(SAMPLE_EXPRESSION.composition);
  });

  it("local dual-cast still rewrites close two-shot framing", () => {
    const projected = projectExpressionForDeployment(
      {
        ...SAMPLE_EXPRESSION,
        composition: "tight two-shot, waist-up indoors",
      },
      "local"
    );
    expect(projected.composition).toMatch(/both visible/i);
    expect(projected.composition).toMatch(/identity weapons in frame/i);
  });

  it("pins relative youth and prefixes role names without a colon", () => {
    const expression = {
      environment: "snowy forest clearing",
      characters: [
        {
          role: "Jon Snow",
          visual:
            "standing left, holding a small dark direwolf pup, black cloak",
        },
        {
          role: "Lord Eddard",
          visual:
            "standing right, weathered northern face, dark beard with silver, thick fur cloak",
        },
      ],
      action:
        "Jon left holding a pup, Lord Eddard right listening, both fully visible",
      composition: "medium-wide, faces secondary",
    };
    const pinned = pinRelativeAgeContrast(expression);
    expect(pinned.characters[0]?.visual).toMatch(/younger/i);
    expect(pinned.characters[1]?.visual).toMatch(/weathered/i);
    expect(pinned.characters[0]?.visual).not.toMatch(/weathered/i);

    const prompt = expressionToPrompt(expression, "local");
    expect(prompt).toMatch(/Jon Snow standing left/);
    expect(prompt).toMatch(/Lord Eddard standing right/);
    expect(prompt).toMatch(/Jon Snow standing left[^.;]*younger/i);
    expect(prompt).toMatch(/Lord Eddard standing right[^.;]*weathered/i);
    expect(prompt).not.toMatch(/Jon Snow:/);
    expect(prompt).not.toMatch(/Lord Eddard:/);
    expect(prompt).not.toMatch(/VISUAL LOCK/);
    expect(prompt).not.toMatch(/\bWill:/);
    expect(prompt.indexOf("Jon left holding a pup")).toBeLessThan(
      prompt.indexOf("Jon Snow standing left")
    );
  });

  it("keeps living rangers human in a haunted frozen-bodies still", () => {
    const expression = {
      environment:
        "haunted forest north of the Wall, dense dark trees, pale snow-covered ground",
      action:
        "three rangers of the Night's Watch standing among frozen wildling bodies in a forest clearing",
      composition:
        "medium-wide shot, three figures grouped near dark trees, faces secondary",
      characters: [
        {
          role: "Will",
          visual:
            "standing left, weathered pale face, cropped brown hair, light stubble, all-black Night's Watch wool cloak, dark leather jerkin, fur collar, holding broken longsword hilt",
        },
        {
          role: "Gared",
          visual:
            "standing center, weathered young man, pale eyes, sharp jawline, stubble beard, rough black wool tunic, boiled leather",
        },
        {
          role: "Ser Waymar Royce",
          visual:
            "standing right, younger, no grey hair, no silver beard, young lord, nobleman armor, steel sword at side",
        },
      ],
    };
    const pinned = pinIdentityLocks(expression);
    const will = pinned.characters[0]?.visual ?? "";
    expect(will).toMatch(/living human/i);
    expect(will).toMatch(/cropped brown hair/i);
    expect(will).toMatch(/weathered living face/i);
    expect(will).not.toMatch(/pale face/i);
    expect(will).not.toMatch(/white hair|silver hair/i);
    expect(pinned.characters[1]?.visual).toMatch(/living human/i);
    expect(pinned.characters[2]?.visual).toMatch(/living human/i);
    expect(pinned.characters[2]?.visual).not.toMatch(/gaunt pale|dead face/i);

    const otherStill = pinIdentityLocks({
      environment: "dark forest at night",
      action:
        "high view from a thick branch, one small cloaked watcher above, one tall gaunt figure below",
      composition: "elevated shot from the branch looking down",
      characters: [
        { role: "Will", visual: "tiny on high branch, black wool cloak" },
        { role: "Other", visual: "tall gaunt pale among trunks below" },
      ],
    });
    expect(otherStill.characters[0]?.visual).toMatch(/living human/i);
    expect(otherStill.characters[1]?.visual).toMatch(/gaunt pale/i);
    expect(otherStill.characters[1]?.visual).not.toMatch(/living human/i);

    const prompt = expressionToPrompt(expression, "local");
    expect(prompt).toMatch(/Will standing left[^.;]*living human/i);
    expect(prompt).toMatch(/Will standing left[^.;]*cropped brown hair/i);
    expect(prompt).toMatch(/Night's Watch wool cloak/i);
    expect(prompt).toMatch(/nobleman armor/i);
    expect(prompt).toMatch(/boiled leather/i);
    expect(prompt).not.toMatch(/\bWill:/);
    expect(prompt).not.toMatch(/VISUAL LOCK/);

    const drafted = buildFrameDraftPrompt({
      caption:
        "Three rangers of the Night's Watch scout deep in the haunted forest.",
      rendererExpression: expression,
      projectionProfile: "local",
      workVisualConvention:
        "STYLE: painterly digital painting. ERA: medieval wool, fur, leather.",
    });
    expect(drafted).toMatch(/Night's Watch wool cloak/i);
    expect(drafted).toMatch(/nobleman armor/i);
    expect(drafted).not.toMatch(/younger,\s*\./);
    expect(drafted.length).toBeGreaterThan(700);
    expect(drafted.length).toBeLessThanOrEqual(
      Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars + 200
    );
  });

  it("keeps distinctive silhouettes when three figures share a cloak", () => {
    const expression = {
      environment: "Haunted forest beyond the Wall at falling night, deep snow",
      action:
        "Will, Gared, and Ser Waymar Royce standing in a bare snowy forest clearing",
      composition: "very wide shot, three small figures dwarfed by dark forest",
      characters: [
        {
          role: "Will",
          visual:
            "standing left, cropped brown hair, all-black Night's Watch wool cloak, dark leather jerkin, fur collar",
        },
        {
          role: "Gared",
          visual:
            "center, hooded black wool cloak, rough black wool tunic, boiled leather",
        },
        {
          role: "Ser Waymar Royce",
          visual:
            "standing right, younger, nobleman armor, black cloak, grey mail, sheathed steel sword",
        },
      ],
    };
    const pinned = promoteDistinctiveGarments(expression);
    const will = pinned.characters[0]?.visual ?? "";
    expect(will.indexOf("fur collar")).toBeLessThan(will.indexOf("wool cloak"));
    const waymar = pinned.characters[2]?.visual ?? "";
    expect(waymar.indexOf("nobleman armor")).toBeLessThan(waymar.indexOf("black cloak"));

    const prompt = expressionToPrompt(expression, "local");
    expect(prompt).toMatch(/different silhouettes/i);
    expect(prompt).toMatch(/not matching outfits/i);
    expect(prompt).toMatch(/fur collar/i);
    expect(prompt).toMatch(/nobleman armor/i);
    expect(prompt).toMatch(/hooded black wool cloak/i);
  });
});

describe("buildFrameDraftPrompt Expression-first", () => {
  it("uses thin Expression transport without long caption wrapper", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "legacy caption should not dominate",
      rendererExpression: SAMPLE_EXPRESSION,
      projectionProfile: "local",
    });
    expect(prompt).toContain("knight left kneeling");
    expect(prompt).not.toContain("legacy caption should not dominate");
    expect(prompt).not.toContain("Scene content (authoritative)");
    expect(prompt).not.toContain("Must match scene:");
    expect(prompt.split("knight left kneeling").length - 1).toBe(1);
  });

  it("injects work convention without replacing the Expression beat", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "legacy caption should not dominate",
      rendererExpression: SAMPLE_EXPRESSION,
      projectionProfile: "local",
      workVisualConvention:
        "ERA: medieval wool. FORBID: modern military camouflage.",
    });
    expect(prompt).toMatch(/medieval wool/);
    expect(prompt).not.toMatch(/Work look/);
    expect(prompt).not.toMatch(/VISUAL LOCK/);
    expect(prompt).not.toMatch(/\bERA\s*:/);
    expect(prompt).not.toMatch(/\bFORBID\s*:/);
    expect(prompt).toContain("knight left kneeling");
    expect(prompt.indexOf("knight left kneeling")).toBeLessThan(
      prompt.indexOf("medieval wool")
    );
    expect(prompt).not.toContain("legacy caption should not dominate");
  });

  it("keeps elevated two-figure camera and omits route-title plaque text", () => {
    const expression = {
      environment: "dark forest at night",
      action:
        "high view from a thick branch, one small cloaked watcher above, one tall gaunt figure below",
      composition: "elevated shot from the branch looking down",
      characters: [
        { role: "Will", visual: "tiny on high branch, black wool cloak" },
        { role: "Other", visual: "tall gaunt pale among trunks below" },
      ],
    };
    const prompt = buildFrameDraftPrompt({
      caption: "Will spots a creature from a tree.",
      routeTitle: "Haunting Beyond the Wall",
      rendererExpression: expression,
      projectionProfile: "local",
      workVisualConvention:
        "STYLE: painterly. ERA: wool, all-black cloaks. FORBID: modern military.",
    });
    expect(prompt).not.toMatch(/VISUAL LOCK/i);
    expect(prompt).toMatch(/elevated shot/i);
    expect(prompt).toMatch(/living perch/i);
    expect(prompt).not.toMatch(/fallen log/i);
    expect(prompt).toMatch(/different silhouettes/i);
    expect(prompt).not.toMatch(/both fully visible/i);
    expect(prompt).not.toMatch(/identity weapons in frame/i);
    expect(prompt).not.toContain("Haunting Beyond the Wall");
    expect(prompt).not.toMatch(/\bSTYLE\s*:/);
    expect(prompt).not.toMatch(/\bWill:/);
    expect(prompt).not.toMatch(/all-black cloaks/i);
    expect(prompt).toMatch(/tiny on high branch/);
    expect(prompt).toMatch(/\bWill tiny on high branch/);
    const neg = buildFrameNegativePrompt("Will spots a creature from a tree.", {
      castCount: 2,
      rendererExpression: expression,
    });
    expect(neg).toMatch(/fallen log perch/i);
    expect(neg).toMatch(/matching hooded cloaks/i);
  });

  it("keeps camouflage out of the Local positive and in negatives", () => {
    const expression = {
      environment: "Haunted Forest at night",
      action: "kneeling man, standing corpse, two figures only",
      composition: "medium-wide, two figures only",
      visualEmphasis: "gauntlets around the throat, no camouflage",
      characters: [
        { role: "Will", visual: "adult kneeling, black wool cloak" },
        {
          role: "Ser Waymar Royce",
          visual: "dark steel plate, no olive drab, pale dead face",
        },
      ],
    };
    const prompt = buildFrameDraftPrompt({
      caption: "Waymar rises.",
      rendererExpression: expression,
      projectionProfile: "local",
      workVisualConvention:
        "painterly digital painting, medieval wool, no modern military, no camouflage",
    });
    expect(prompt).toMatch(/black wool cloak/);
    expect(prompt).toMatch(/pale dead face/);
    expect(prompt).not.toMatch(/camouflage/i);
    expect(prompt).not.toMatch(/olive drab/i);
    expect(prompt).not.toMatch(/modern military/i);
    const neg = buildFrameNegativePrompt("Waymar rises.", {
      castCount: 2,
      rendererExpression: expression,
      workVisualConvention:
        "painterly digital painting, no modern military, no camouflage",
    });
    expect(neg).toMatch(/camouflage/i);
    expect(neg).toMatch(/olive drab/i);
    expect(neg).toMatch(/modern military/i);
  });

  it("keeps overlay-beat action and corpse identity instead of cutting at 96 chars", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "Waymar rises to choke Will.",
      rendererExpression: {
        environment: "Haunted Forest at night, snow, black enclosing trees",
        action:
          "two adult figures only: kneeling cloaked man, standing armored corpse leaning over him with both gauntlets clamped around his throat; broken hilt unused on the snow",
        composition: "medium-wide, two figures only, faces secondary",
        visualEmphasis: "gauntlets around the throat, hilt on the snow",
        characters: [
          {
            role: "Will",
            visual:
              "adult kneeling in snow, black wool cloak, empty hands, head pulled back",
          },
          {
            role: "Ser Waymar Royce",
            visual:
              "taller standing corpse, dark steel plate and mail, solid black wool cloth, pale dead face, glowing blue eyes, both gauntlets on the kneeling man's throat",
          },
        ],
      },
      projectionProfile: "local",
      workVisualConvention:
        "painterly digital painting, medieval wool, fur, leather",
    });
    expect(prompt).not.toMatch(/…/);
    expect(prompt).toMatch(/throat/i);
    expect(prompt).toMatch(/broken hilt/i);
    expect(prompt).toMatch(/standing corpse/i);
    expect(prompt).toMatch(/glowing blue eyes/i);
    expect(prompt).toMatch(/empty hands/i);
    expect(prompt.length).toBeLessThanOrEqual(
      Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars + 80
    );
  });

  it("Z-Image table keeps overlay action; sd-3.5 table still short-clips", () => {
    const expression = {
      environment: "Haunted Forest at night, snow, black enclosing trees",
      action:
        "two adult figures only: kneeling cloaked man, standing armored corpse leaning over him with both gauntlets clamped around his throat; broken hilt unused on the snow",
      composition: "medium-wide, two figures only, faces secondary",
      visualEmphasis: "gauntlets around the throat, hilt on the snow",
      characters: [
        {
          role: "Will",
          visual:
            "adult kneeling in snow, black wool cloak, empty hands, head pulled back",
        },
        {
          role: "Ser Waymar Royce",
          visual:
            "taller standing corpse, dark steel plate and mail, solid black wool cloth, pale dead face, glowing blue eyes, both gauntlets on the kneeling man's throat",
        },
      ],
    };
    const zImage = expressionToPrompt(
      expression,
      "local",
      Z_IMAGE_TURBO_CAPABILITY
    );
    const sd35 = expressionToPrompt(expression, "local", SD35_CAPABILITY);
    expect(zImage).toMatch(/throat/i);
    expect(zImage).toMatch(/broken hilt/i);
    expect(zImage.length).toBeLessThanOrEqual(
      Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars
    );
    expect(sd35.length).toBeLessThanOrEqual(SD35_CAPABILITY.promptBodyMaxChars);
    expect(sd35.length).toBeLessThan(zImage.length);
  });

  it("keeps operator revision with Expression", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "legacy\n\n[操作员修改意见] 加雨",
      rendererExpression: SAMPLE_EXPRESSION,
      projectionProfile: "local",
    });
    expect(prompt).toContain("OPERATOR OVERRIDE");
    expect(prompt).toContain("加雨");
    expect(prompt).toContain("knight left kneeling");
    expect(prompt.indexOf("OPERATOR OVERRIDE")).toBeLessThan(
      prompt.indexOf("knight left kneeling")
    );
    // Full note once only (front); no trailing duplicate.
    expect(prompt.split("加雨").length - 1).toBe(1);
    expect(prompt).not.toContain("Remember operator override");
  });

  it("falls back to caption when Expression absent", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "街垒夜战",
      projectionProfile: "local",
    });
    expect(prompt).toContain("街垒夜战");
    expect(prompt).toContain("Scene:");
    expect(prompt).not.toContain("Scene content (authoritative)");
    expect(prompt).not.toMatch(/VISUAL LOCK/);
    expect(prompt).toMatch(/cinematic|painterly/i);
    expect(prompt.length).toBeLessThanOrEqual(
      Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars
    );
  });

  it("falls back to caption when Expression is an empty-scene stub", () => {
    const prompt = buildFrameDraftPrompt({
      caption:
        "Liu Yan's recruitment notice brings together Liu Bei and Guan Yu in Zhuo County.",
      rendererExpression: {
        ...MINIMAL_RENDERER_EXPRESSION,
        environment: "Zhuo County",
        characters: [
          { role: "Liu Bei", visual: "character present" },
          { role: "Guan Yu", visual: "character present" },
        ],
      },
      projectionProfile: "local",
    });
    expect(prompt).toContain("blank unmarked board");
    expect(prompt).not.toMatch(/recruitment notice/i);
    expect(prompt).toContain("Scene:");
    expect(prompt).not.toMatch(/empty scene/i);
    expect(prompt).not.toContain("character present");
    expect(prompt.length).toBeLessThanOrEqual(
      Z_IMAGE_TURBO_CAPABILITY.promptBodyMaxChars
    );
  });

  it("keeps dense caption wrapper on cloud profile", () => {
    const prompt = buildFrameDraftPrompt({
      caption: "街垒夜战",
      projectionProfile: "cloud",
    });
    expect(prompt).toContain("Scene content (authoritative)");
    expect(prompt).toContain("Must match scene:");
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
          summary: "Reader step draft",
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

describe("stub Renderer Expression", () => {
  it("treats MINIMAL and empty action as stubs", () => {
    expect(isStubRendererExpression(MINIMAL_RENDERER_EXPRESSION)).toBe(true);
    expect(
      isStubRendererExpression({
        environment: "Zhuo County",
        characters: [{ role: "Liu Bei", visual: "character present" }],
        action: "empty scene",
        composition: "wide view",
      })
    ).toBe(true);
    expect(executableRendererExpression(MINIMAL_RENDERER_EXPRESSION)).toBeUndefined();
    expect(
      executableRendererExpression({
        environment: "castle hall",
        characters: [],
        action: "knight kneeling before the king",
        composition: "wide view",
      })
    ).toBeTruthy();
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
    expect(parsed[0]!.rendererExpression?.action).toContain("kneeling");
    expect(parsed[0]!.visualIntent?.purpose).toBe("establish tension");
  });

  it("omits empty-scene stub Expression from provenance", () => {
    const parsed = parseFrameProvenance([
      {
        sourceReviewId: "rev-stub",
        frameIndex: 0,
        rendererExpression: {
          environment: "Zhuo County",
          characters: [{ role: "Zhang Fei", visual: "character present" }],
          action: "empty scene",
          composition: "wide view",
        },
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.rendererExpression).toBeUndefined();
  });
});

describe("EVG-001-R3 identity slots on cross-work fixtures", () => {
  function projectFrame(id: string) {
    const frame = FRAMES.find((f) => f.id === id);
    if (!frame) throw new Error(`missing fixture ${id}`);
    const folded = foldCharacterArchivesIntoExpression(
      frame.expression,
      frame.roles.map((r) => ({ name: r.name, archive: r.archive }))
    );
    return projectExpressionForDeployment(folded, "local");
  }

  it("tk-campaign-document keeps Guan Yu identity over looking-down-at-map", () => {
    const projected = projectFrame("tk-campaign-document");
    const guanyu = projected.characters.find((c) => /guan/i.test(c.role));
    expect(guanyu).toBeTruthy();
    expect(guanyu!.visual).toMatch(/Green Dragon Crescent Blade/);
    expect(guanyu!.visual).toMatch(/red face/i);
    expect(guanyu!.visual).toMatch(/beard/i);
    expect(guanyu!.visual).toMatch(/green robe/i);
    expect(guanyu!.visual).not.toMatch(/looking down/i);
    expect(projected.environment).toMatch(/tent/i);
    expect(projected.environment).not.toMatch(/winterfell/i);
    expect(`${projected.environment} ${projected.action}`).toMatch(/map/i);
    expect(`${projected.environment} ${projected.action}`).not.toMatch(
      /letter|parchment/i
    );
    expect(projected.composition).toMatch(/tent still|two profiles/i);
  });

  it("as-indoor-counsel uses the same ranking without work-specific rules", () => {
    const projected = projectFrame("as-indoor-counsel");
    const ned = projected.characters.find((c) => /eddard/i.test(c.role));
    const catelyn = projected.characters.find((c) => /catelyn/i.test(c.role));
    expect(ned).toBeTruthy();
    expect(catelyn).toBeTruthy();
    expect(ned!.visual).toMatch(/fur cloak/i);
    expect(catelyn!.visual).toMatch(/gown/i);
    expect(`${projected.environment} ${projected.action}`).toMatch(/letter/i);
    expect(projected.environment).toMatch(/winterfell|solar|granite/i);
    expect(projected.environment).not.toMatch(/\bhan\b|peach|felt tent/i);
    expect(projected.composition).toMatch(/indoor still|two profiles/i);
  });
});
