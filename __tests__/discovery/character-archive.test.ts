/**
 * SPEC-CHAR-001 — Role Character Archive (MVP)
 */

import { describe, expect, it } from "vitest";

import {
  applyCharacterArchivesToSceneCandidate,
  normalizeRawCandidate,
} from "@/lib/discovery/candidate-validate";
import {
  CHARACTER_ARCHIVE_CUE_BUDGET,
  foldCharacterArchivesIntoExpression,
  parseCharacterArchive,
  selectActiveCharacterCues,
} from "@/lib/discovery/character-archive";
import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";

const NED_ARCHIVE = {
  visualSummary: "Northern lord shaped by honor and winter",
  costumeCues: [
    "dark northern fur cloak",
    "wool noble attire",
    "extra unused costume",
  ],
  propCues: ["ancestral greatsword", "extra unused prop"],
};

describe("parseCharacterArchive", () => {
  it("accepts Ned-shaped archive", () => {
    const result = parseCharacterArchive(NED_ARCHIVE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.costumeCues).toEqual([
        "dark northern fur cloak",
        "wool noble attire",
        "extra unused costume",
      ]);
      expect(result.value?.propCues).toEqual([
        "ancestral greatsword",
        "extra unused prop",
      ]);
      expect(result.value?.visualSummary).toContain("Northern lord");
    }
  });

  it("returns null for empty archive", () => {
    const result = parseCharacterArchive({ costumeCues: [], propCues: [] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("rejects face-ref / identity-transfer language", () => {
    const result = parseCharacterArchive({
      costumeCues: ["InstantID face lock"],
      propCues: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe("selectActiveCharacterCues (budget)", () => {
  it("caps costume ≤1, standing prop ≤1, and keeps Ned extras out", () => {
    const parsed = parseCharacterArchive(NED_ARCHIVE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.value) return;
    const active = selectActiveCharacterCues(parsed.value);
    expect(active.costumeCues).toHaveLength(
      CHARACTER_ARCHIVE_CUE_BUDGET.maxCostume
    );
    expect(active.propCues).toHaveLength(CHARACTER_ARCHIVE_CUE_BUDGET.maxProp);
    expect(active.activeCues.length).toBeLessThanOrEqual(
      CHARACTER_ARCHIVE_CUE_BUDGET.maxTotal
    );
    expect(active.activeCues).toContain("dark northern fur cloak");
    expect(active.activeCues).toContain("ancestral greatsword");
    expect(active.activeCues).not.toContain("extra unused costume");
    expect(active.activeCues).not.toContain("wool noble attire");
  });

  it("keeps Tier-1 identity cues and skips unused costume extras", () => {
    const parsed = parseCharacterArchive({
      identityCues: ["red face", "long beard", "Green Dragon Crescent Blade"],
      costumeCues: ["green battle robe", "extra unused costume"],
      propCues: [],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.value) return;
    const active = selectActiveCharacterCues(parsed.value);
    expect(active.identityCues).toEqual([
      "red face",
      "long beard",
      "Green Dragon Crescent Blade",
    ]);
    expect(active.costumeCues).toEqual(["green battle robe"]);
    expect(active.activeCues).toContain("red face");
    expect(active.activeCues).not.toContain("extra unused costume");
  });

  it("does not inject a letter into a scene that never names a document", () => {
    const parsed = parseCharacterArchive({
      costumeCues: ["southern noble gown"],
      propCues: ["sealed letter"],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.value) return;
    const active = selectActiveCharacterCues(
      parsed.value,
      CHARACTER_ARCHIVE_CUE_BUDGET,
      "grove dark pool two figures standing"
    );
    expect(active.propCues).not.toContain("sealed letter");
    expect(active.costumeCues).toContain("southern noble gown");
  });
});

describe("foldCharacterArchivesIntoExpression", () => {
  it("folds budgeted cues into matching role visual", () => {
    const expression = {
      environment: "godswood",
      characters: [
        { role: "Eddard Stark", visual: "bearded northern man standing" },
      ],
      action: "lord before weirwood",
      composition: "medium shot",
    };
    const folded = foldCharacterArchivesIntoExpression(expression, [
      {
        name: "Eddard Stark",
        archive: {
          costumeCues: ["dark northern fur cloak", "wool noble attire"],
          propCues: ["ancestral greatsword"],
        },
      },
    ]);
    expect(folded.characters[0].visual).toContain("dark northern fur cloak");
    expect(folded.characters[0].visual).toContain("ancestral greatsword");
    expect(folded.action).toBe(expression.action);
  });

  it("skips cues already present", () => {
    const expression = {
      environment: "hall",
      characters: [
        {
          role: "Eddard Stark",
          visual: "man in dark northern fur cloak",
        },
      ],
      action: "stands",
      composition: "wide",
    };
    const folded = foldCharacterArchivesIntoExpression(expression, [
      {
        name: "Eddard Stark",
        archive: {
          costumeCues: ["dark northern fur cloak"],
          propCues: ["ancestral greatsword"],
        },
      },
    ]);
    expect(folded.characters[0].visual).toContain("ancestral greatsword");
    expect(
      folded.characters[0].visual.match(/dark northern fur cloak/gi)?.length
    ).toBe(1);
  });
});

describe("normalizeRawCandidate + applyCharacterArchivesToSceneCandidate", () => {
  it("keeps characterArchive on character candidates", () => {
    const result = normalizeRawCandidate(
      {
        displayName: "Eddard Stark",
        summary: "Lord of Winterfell.",
        fields: {
          name: "Eddard Stark",
          characterArchive: {
            visualSummary: "Northern lord",
            costumeCues: ["dark northern fur cloak"],
            propCues: ["ancestral greatsword"],
          },
        },
      },
      "character",
      "work-1"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        (result.candidate.fields as { characterArchive?: { costumeCues: string[] } })
          .characterArchive?.costumeCues
      ).toContain("dark northern fur cloak");
    }
  });

  it("folds Role archive into scene Expression", () => {
    const character: DiscoveryCandidate = {
      candidateId: "char-1",
      candidateType: "character",
      workId: "work-1",
      displayName: "Eddard Stark",
      summary: "Lord",
      fields: {
        name: "Eddard Stark",
        characterArchive: {
          costumeCues: ["dark northern fur cloak"],
          propCues: ["ancestral greatsword"],
        },
      },
    };
    const scene: DiscoveryCandidate = {
      candidateId: "scene-1",
      candidateType: "scene",
      workId: "work-1",
      displayName: "Courtyard",
      summary: "Arrival",
      fields: {
        parentStoryCandidateId: "story-1",
        chapter_number: 1,
        title: "Courtyard",
        rendererExpression: {
          environment: "snowy courtyard",
          characters: [
            { role: "Eddard Stark", visual: "bearded northern man standing" },
          ],
          action: "stands",
          composition: "wide",
        },
      },
    };
    const folded = applyCharacterArchivesToSceneCandidate(scene, [character]);
    const visual = (
      folded.fields as {
        rendererExpression: { characters: { visual: string }[] };
      }
    ).rendererExpression.characters[0].visual;
    expect(visual).toContain("dark northern fur cloak");
    expect(visual).toContain("ancestral greatsword");
  });

  it("remaps generic woman/man roles then folds archive", () => {
    const characters: DiscoveryCandidate[] = [
      {
        candidateId: "char-c",
        candidateType: "character",
        workId: "work-1",
        displayName: "Catelyn Stark",
        summary: "Lady",
        fields: {
          name: "Catelyn Stark",
          characterArchive: {
            costumeCues: ["dark gown with southern-cut grace"],
            propCues: ["sealed letter"],
          },
        },
      },
      {
        candidateId: "char-n",
        candidateType: "character",
        workId: "work-1",
        displayName: "Eddard Stark",
        summary: "Lord",
        fields: {
          name: "Eddard Stark",
          characterArchive: {
            costumeCues: ["dark northern fur cloak"],
            propCues: ["ancestral greatsword"],
          },
        },
      },
    ];
    const scene: DiscoveryCandidate = {
      candidateId: "scene-1",
      candidateType: "scene",
      workId: "work-1",
      displayName: "Letter",
      summary: "News",
      fields: {
        parentStoryCandidateId: "story-1",
        chapter_number: 1,
        title: "Letter",
        rendererExpression: {
          environment: "stone chamber",
          characters: [
            { role: "woman", visual: "winter wrap standing" },
            { role: "man", visual: "leather garb standing" },
          ],
          action: "facing",
          composition: "medium wide",
        },
      },
    };
    const folded = applyCharacterArchivesToSceneCandidate(scene, characters);
    const cast = (
      folded.fields as {
        rendererExpression: { characters: { role: string; visual: string }[] };
      }
    ).rendererExpression.characters;
    expect(cast[0].role).toBe("Catelyn Stark");
    expect(cast[1].role).toBe("Eddard Stark");
    expect(cast[0].visual).toMatch(/gown|letter/i);
    expect(cast[1].visual).toMatch(/fur cloak|greatsword/i);
  });
});
