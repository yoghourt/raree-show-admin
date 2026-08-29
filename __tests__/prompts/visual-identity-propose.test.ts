import { describe, expect, it } from "vitest";

import {
  buildVisualIdentityProposePrompt,
  parseVisualIdentityProposal,
} from "@/lib/prompts/visual-identity-propose";

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
  });
});
