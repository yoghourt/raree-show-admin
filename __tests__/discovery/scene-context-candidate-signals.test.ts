/**
 * IMPLEMENT-SCC-001-L2-C — Propose → Context candidate signals
 */

import { describe, expect, it } from "vitest";

import {
  applyCharacterArchivesToSceneCandidate,
  normalizeRawCandidate,
} from "@/lib/discovery/candidate-validate";
import { buildProposePrompt } from "@/lib/discovery/propose-service";
import {
  assessSceneContextCandidateSignals,
  normalizeSceneContextCandidateSignals,
  SCENE_CONTEXT_CANDIDATE_PROPOSE_RULES,
} from "@/lib/discovery/scene-context-candidate-signals";
import { aggregateStoryRelatedFromSceneStagings } from "@/lib/scene-context/aggregate-story-refs";
import type { NarrativeInputBundle } from "@/lib/discovery/types";
import { EXCERPT_BUNDLE_MIN_PROSE } from "@/lib/discovery/constants";

function makeProse(length: number): string {
  const unit = "Narrative prose sentence. ";
  let out = "";
  while (out.length < length) out += unit;
  return out.slice(0, length);
}

const narrative: NarrativeInputBundle = {
  excerpts: [{ text: makeProse(EXCERPT_BUNDLE_MIN_PROSE), orderIndex: 0 }],
  operatorSummary: null,
  inputMode: "excerpt_bundle",
  summaryAttested: false,
};

describe("L2-C Scene Propose prompt", () => {
  it("includes Context-candidate wording and forbids membership fields", () => {
    const prompt = buildProposePrompt({
      workTitle: "Test Work",
      narrative,
      candidateType: "scene",
      storyCandidates: [
        {
          candidateId: "story-1",
          candidateType: "story",
          workId: "work-1",
          displayName: "Arc",
          summary: "s",
          fields: { title: "Arc", summary: "s" },
        },
      ],
    });

    expect(prompt).toContain(SCENE_CONTEXT_CANDIDATE_PROPOSE_RULES.slice(0, 40));
    expect(prompt).toContain("Scene Context candidate signals");
    expect(prompt).toContain("NOT Story membership");
    expect(prompt).toContain("characterIds");
    expect(prompt).toContain("locationId");
    expect(prompt).toContain("hierarchy only");
    expect(prompt).toContain("visualIntent.characters");
  });
});

describe("normalizeSceneContextCandidateSignals", () => {
  it("seeds Intent cast and fills names from character candidates", () => {
    const normalized = normalizeSceneContextCandidateSignals(
      {
        parentStoryCandidateId: "story-1",
        chapter_number: 1,
        title: "Courtyard",
        summary: "Arya draws a blade in the courtyard",
        rendererExpression: {
          environment: "Winterfell courtyard",
          characters: [
            { role: "assassin", visual: "Arya Stark in a hooded cloak" },
          ],
          action: "draws blade",
          composition: "close",
        },
      },
      ["Arya Stark", "Fantine"]
    );

    expect(normalized.visualIntent?.characters).toEqual([
      { role: "assassin", name: "Arya Stark" },
    ]);

    const warnings = assessSceneContextCandidateSignals(normalized);
    expect(warnings).toEqual([]);
  });

  it("warns when Expression cast has no named Intent", () => {
    const warnings = assessSceneContextCandidateSignals({
      visualIntent: null,
      rendererExpression: {
        environment: "hall",
        characters: [{ role: "guard", visual: "cloaked" }],
        action: "stands",
        composition: "wide",
      },
    });
    expect(warnings.some((w) => w.includes("visualIntent.characters missing"))).toBe(
      true
    );
  });
});

describe("L2-C non-membership + signal quality", () => {
  it("rejects Story ownership fields on scene propose", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Courtyard",
        summary: "s",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Courtyard",
          summary: "Household greets the king",
          characterIds: ["char_x"],
          locationId: "loc_y",
          rendererExpression: {
            environment: "courtyard",
            characters: [],
            action: "stands",
            composition: "wide",
          },
        },
      },
      "scene",
      "work-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/characterIds|locationId/);
    }
  });

  it("rejects characterIds on story propose (no Route membership generation)", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Arc",
        summary: "s",
        fields: {
          title: "Arc",
          summary: "Summary",
          characterIds: ["char_x"],
        },
      },
      "story",
      "work-1"
    );
    expect(result.ok).toBe(false);
  });

  it("post-step densifies Intent names for Context aggregate without Story membership", () => {
    const sceneResult = normalizeRawCandidate(
      {
        displayName: "Strike",
        summary: "Arya strikes",
        fields: {
          parentStoryCandidateId: "story-1",
          chapter_number: 1,
          title: "Strike",
          summary: "Arya strikes in the courtyard",
          rendererExpression: {
            environment: "Winterfell courtyard",
            characters: [
              { role: "assassin", visual: "Arya Stark hooded in snow" },
            ],
            action: "draws blade",
            composition: "close",
          },
        },
      },
      "scene",
      "work-1"
    );
    expect(sceneResult.ok).toBe(true);
    if (!sceneResult.ok) return;

    const character = {
      candidateId: "char-1",
      candidateType: "character" as const,
      workId: "work-1",
      displayName: "Arya Stark",
      summary: "s",
      fields: {
        name: "Arya Stark",
        characterArchive: {
          visualSummary: "small hooded figure",
          costumeCues: ["hooded cloak"],
          propCues: ["thin blade"],
        },
      },
    };

    const densified = applyCharacterArchivesToSceneCandidate(
      sceneResult.candidate,
      [character]
    );
    const fields = densified.fields as {
      visualIntent?: { characters?: Array<{ name?: string }> };
      characterIds?: unknown;
      locationId?: unknown;
    };
    expect(fields.visualIntent?.characters?.[0]?.name).toBe("Arya Stark");
    expect(fields.characterIds).toBeUndefined();
    expect(fields.locationId).toBeUndefined();

    const agg = aggregateStoryRelatedFromSceneStagings([
      {
        workId: "work-1",
        sourceReviewId: "rev-scene",
        parentStorySourceReviewId: "rev-story-a",
        chapter_number: 1,
        title: "Strike",
        visualIntent: fields.visualIntent as never,
        rendererExpression: densified.fields.rendererExpression as never,
        acceptedAt: "2026-08-08T00:00:00.000Z",
      },
    ]);
    expect(agg.characters.map((c) => c.name)).toContain("Arya Stark");
  });
});
