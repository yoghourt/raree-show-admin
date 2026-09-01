import { describe, expect, it } from "vitest";

import {
  AVATAR_APPEARANCE_MAX_CHARS,
  packVisualIdentityForPortrait,
} from "@/lib/prompts/avatar";
import {
  buildVisualIdentityProposePrompt,
  characterArchiveFromLabeledIdentity,
  parseVisualIdentityProposal,
} from "@/lib/prompts/visual-identity-propose";

const LONG_SUMMARY_FIRST = `SUMMARY: astute young military commander of Wei, pragmatic and sharp-eyed, extra court politics that must not consume the portrait budget.
FACE: determined sharp eyes, chiseled jawline, neat dark hair tied back in a high topknot, subtle natural skin texture with pores.
COSTUME: functional dark leather and steel-plated lamellar shoulder guards over a deep green military tunic, practical bronze-trimmed belt.
PROP: rolled military strategy bamboo scroll held in hand.
STYLE: semi-realistic digital painting, textured painterly brushwork, cinematic character concept art, detailed fabric and metal materials.`;

describe("parseVisualIdentityProposal", () => {
  it("keeps labeled lines and drops preamble", () => {
    const raw = `Sure, here you go:
FACE: ruddy bronze complexion, long beard.
COSTUME: green battle robe.
PROP: Green Dragon Crescent Blade.
STYLE: semi-realistic digital painting.`;
    const out = parseVisualIdentityProposal(raw);
    expect(out).toMatch(/^FACE:/m);
    expect(out).not.toMatch(/Sure/);
    expect(out).toContain("green battle robe");
  });

  it("unwraps fenced and JSON shapes", () => {
    expect(
      parseVisualIdentityProposal(
        '```text\nFACE: dark complexion, bushy beard.\nCOSTUME: black robe.\n```'
      )
    ).toContain("FACE:");
    expect(
      parseVisualIdentityProposal(
        JSON.stringify({
          FACE: "ruddy skin",
          COSTUME: "green robe",
          PROP: "crescent blade",
        })
      )
    ).toMatch(/FACE:.*ruddy skin/s);
  });

  it("packs overlong SUMMARY-first proposals into the Local execute budget", () => {
    const out = parseVisualIdentityProposal(LONG_SUMMARY_FIRST);
    expect(out.length).toBeLessThanOrEqual(AVATAR_APPEARANCE_MAX_CHARS);
    expect(out).toMatch(/^FACE:/m);
    expect(out).toMatch(/COSTUME:/);
    expect(out).toMatch(/PROP:/);
    expect(out).toMatch(/bamboo|scroll/i);
    expect(out.indexOf("FACE:")).toBeLessThan(out.indexOf("PROP:"));
  });
});

describe("characterArchiveFromLabeledIdentity", () => {
  it("maps FACE/COSTUME/PROP lines into archive cues", () => {
    const archive = characterArchiveFromLabeledIdentity(
      "FACE: ruddy bronze complexion, long beard.\nCOSTUME: green battle robe.\nPROP: Green Dragon Crescent Blade.\nSTYLE: painterly digital painting."
    );
    expect(archive).not.toBeNull();
    expect(archive?.identityCues).toEqual(
      expect.arrayContaining(["ruddy bronze complexion", "long beard"])
    );
    expect(archive?.costumeCues).toEqual(
      expect.arrayContaining(["green battle robe"])
    );
    expect(archive?.propCues).toEqual(
      expect.arrayContaining(["Green Dragon Crescent Blade"])
    );
  });
});

describe("packVisualIdentityForPortrait", () => {
  it("does not left-clip PROP when FACE is verbose", () => {
    const packed = packVisualIdentityForPortrait(LONG_SUMMARY_FIRST);
    expect(packed.length).toBeLessThanOrEqual(AVATAR_APPEARANCE_MAX_CHARS);
    expect(packed).toMatch(/PROP:/);
    expect(packed).toMatch(/bamboo|scroll/i);
  });
});

describe("buildVisualIdentityProposePrompt", () => {
  it("includes operator note and forbids bare red-face instruction", () => {
    const p = buildVisualIdentityProposePrompt({
      name: "Guan Yu",
      operatorNote: "avoid nianhua",
      currentVisualIdentity: "FACE: red face.",
    });
    expect(p).toMatch(/Guan Yu/);
    expect(p).toMatch(/avoid nianhua/);
    expect(p).toMatch(/NEVER bare "red face"/);
    expect(p).toMatch(/IGNORE age\/look/);
    expect(p).toMatch(/generic youthful idol/);
  });

  it("requires output within the Local execute budget and omits SUMMARY", () => {
    const p = buildVisualIdentityProposePrompt({ name: "Cao Cao" });
    expect(p).toContain(String(AVATAR_APPEARANCE_MAX_CHARS));
    expect(p).not.toMatch(/~800/);
    expect(p).toMatch(/Omit SUMMARY/);
    expect(p).toMatch(/FACE: …/);
  });
});
