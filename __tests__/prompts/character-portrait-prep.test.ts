import { describe, expect, it } from "vitest";

import { AVATAR_APPEARANCE_MAX_CHARS } from "@/lib/prompts/avatar";
import {
  buildPortraitPrepProposePrompt,
  parsePortraitPrepProposal,
} from "@/lib/prompts/character-portrait-prep";

describe("parsePortraitPrepProposal", () => {
  it("reads JSON description + labeled identity", () => {
    const out = parsePortraitPrepProposal(
      JSON.stringify({
        description: "Chancellor of Wei who seizes the Han court.",
        visualIdentity:
          "FACE: thin middle-aged face, sparse pointed goatee.\nCOSTUME: dark ministerial robe.\nPROP: short bronze sword.\nSTYLE: painterly digital painting.",
      })
    );
    expect(out?.description).toMatch(/Chancellor of Wei/);
    expect(out?.visualIdentity).toMatch(/^FACE:/m);
    expect(out?.visualIdentity).toMatch(/PROP:/);
  });

  it("assembles FACE/COSTUME/PROP when visualIdentity key is split", () => {
    const out = parsePortraitPrepProposal(
      JSON.stringify({
        description: "Sworn brother of Liu Bei.",
        FACE: "ruddy bronze complexion, long beard",
        COSTUME: "green battle robe",
        PROP: "Green Dragon Crescent Blade",
        STYLE: "painterly digital painting",
      })
    );
    expect(out?.description).toBe("Sworn brother of Liu Bei.");
    expect(out?.visualIdentity).toContain("green battle robe");
    expect(out!.visualIdentity.length).toBeLessThanOrEqual(
      AVATAR_APPEARANCE_MAX_CHARS
    );
  });

  it("returns null when either side is missing", () => {
    expect(parsePortraitPrepProposal('{"description":"only bio"}')).toBeNull();
    expect(parsePortraitPrepProposal('{"FACE":"beard"}')).toBeNull();
  });
});

describe("buildPortraitPrepProposePrompt", () => {
  it("asks to rewrite polluted bios and ignore young FACE", () => {
    const p = buildPortraitPrepProposePrompt({
      name: "Cao Cao",
      workTitle: "Romance of the Three Kingdoms",
      description: "Astute young military commander.",
    });
    expect(p).toMatch(/Cao Cao/);
    expect(p).toMatch(/Astute young military commander/);
    expect(p).toMatch(/rewrite it/);
    expect(p).toMatch(/FORBIDDEN: age/);
    expect(p).toMatch(/Chancellor of Wei/);
    expect(p).not.toMatch(/~800/);
  });
});
