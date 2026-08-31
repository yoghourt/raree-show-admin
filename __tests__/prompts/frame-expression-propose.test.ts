import { describe, expect, it } from "vitest";

import {
  LOCAL_ACTION_MAX,
  LOCAL_VISUAL_MAX,
} from "@/lib/discovery/execution-projection";
import {
  buildFrameExpressionProposePrompt,
  captionProperNamePhrases,
  parseFrameExpressionProposal,
} from "@/lib/prompts/frame-expression-propose";

const VALID_EXPR = {
  environment: "Luoyang imperial hall, vacant dragon throne",
  characters: [
    {
      role: "Prince Bian",
      visual: "youthful visage, imperial crown, crimson robes, imperial scepter",
    },
  ],
  action:
    "empty dragon throne at center; Prince Bian standing at left holding imperial scepter",
  composition:
    "medium-wide shot, Prince Bian left of vacant throne, faces secondary",
  atmosphere: "court after a death",
  visualEmphasis: "empty throne and imperial seal, not faces",
};

describe("parseFrameExpressionProposal", () => {
  it("reads a bare rendererExpression object", () => {
    const out = parseFrameExpressionProposal(JSON.stringify(VALID_EXPR));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.environment).toMatch(/Luoyang/);
    expect(out.value.characters[0]?.role).toBe("Prince Bian");
  });

  it("unwraps { rendererExpression } wrappers and fences", () => {
    const wrapped = parseFrameExpressionProposal(
      JSON.stringify({ rendererExpression: VALID_EXPR })
    );
    expect(wrapped.ok).toBe(true);
    const fenced = parseFrameExpressionProposal(
      "```json\n" + JSON.stringify(VALID_EXPR) + "\n```"
    );
    expect(fenced.ok).toBe(true);
  });

  it("rejects stubs missing required fields", () => {
    const out = parseFrameExpressionProposal(
      JSON.stringify({ environment: "hall", characters: [] })
    );
    expect(out.ok).toBe(false);
  });

  it("packs overlong visual and action to Local execute budgets, keeping the start", () => {
    const longVisual =
      "kneeling in snow, stubble beard, pale eyes, rough black wool tunic, boiled leather doublet, heavy fur-lined black cloak, weathered young Night's Watch deserter";
    const longAction =
      "Lord Eddard Stark standing over kneeling Gared with raised sword; Bran Stark mounted on horse in background watching in profile from the far courtyard edge";
    expect(longVisual.length).toBeGreaterThan(LOCAL_VISUAL_MAX);
    expect(longAction.length).toBeGreaterThan(LOCAL_ACTION_MAX);

    const out = parseFrameExpressionProposal(
      JSON.stringify({
        environment: "Winterfell, snowy courtyard, stone walls",
        characters: [
          { role: "Gared", visual: longVisual },
          {
            role: "Bran Stark",
            visual:
              "mounted on horse far behind, small boy, dark brown hair, grey Stark cloak, watching, not kneeling, pale ivory skin, neat hair, fur-lined leather doublet",
          },
        ],
        action: longAction,
        composition:
          "medium-wide shot, figures placed side-to-side, faces secondary and partly in shadow",
      })
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.characters[0]?.visual.length).toBeLessThanOrEqual(
      LOCAL_VISUAL_MAX
    );
    expect(out.value.characters[0]?.visual).toMatch(/^kneeling in snow/);
    expect(out.value.characters[1]?.visual).toMatch(/^mounted on horse/);
    expect(out.value.action.length).toBeLessThanOrEqual(LOCAL_ACTION_MAX);
    expect(out.value.action).toMatch(/kneeling Gared/);
  });
});

describe("buildFrameExpressionProposePrompt", () => {
  it("lists caption-named agents and forbids substituting a letter/solar beat", () => {
    const p = buildFrameExpressionProposePrompt({
      workTitle: "A Game of Thrones",
      caption:
        "King Robert Baratheon is traveling north to offer Ned the position of Hand of the King, alongside a proposed marriage alliance between Prince Joffrey and Sansa Stark.",
      characterCues: [
        { name: "Catelyn Stark", visualIdentity: "COSTUME: northern dress." },
        {
          name: "Eddard Stark",
          visualIdentity:
            "weathered northern lord face, lined complexion, short dark brown hair, dark grey quilted leather doublet, heavy winter wool tunic, thick direwolf fur mantle, holding Ice, a massive Valyrian steel greatsword upright with both hands",
        },
        { name: "Robert Baratheon", visualIdentity: "COSTUME: crowned king." },
      ],
    });
    expect(p).toMatch(/King Robert Baratheon/);
    expect(p).toMatch(/Prince Joffrey/);
    expect(p).toMatch(/Sansa Stark/);
    expect(p).toMatch(/NOT a cast menu/);
    expect(p).toMatch(/raven parchment/);
    expect(p).toMatch(/kingsroad/);
    expect(p).toMatch(/Do NOT add other Work characters/);
    expect(p).toMatch(new RegExp(String(LOCAL_VISUAL_MAX)));
    expect(p).toMatch(/pose\/blocking/);
    expect(p).toMatch(/Creator production override/);
    expect(p).toMatch(/weathered northern lord face/);
    expect(p).not.toMatch(/Valyrian steel greatsword/);
  });

  it("makes caption the beat authority and allows replacing a contradicting draft", () => {
    const p = buildFrameExpressionProposePrompt({
      workTitle: "Romance of the Three Kingdoms",
      caption:
        "Following Emperor Ling's death, a vicious succession crisis erupts.",
      currentExpression: JSON.stringify({
        action: "Emperor Ling seated upon a grand throne next to Prince Bian",
      }),
      operatorNote: "灵帝已死，不要画活着的灵帝",
      characterCues: [
        { name: "Prince Bian", visualIdentity: "FACE: youthful. PROP: scepter." },
      ],
    });
    expect(p).toMatch(/Emperor Ling's death/);
    expect(p).toMatch(/REPLACE it/);
    expect(p).toMatch(/MUST NOT appear alive/);
    expect(p).toMatch(/Prince Bian/);
    expect(p).toMatch(/灵帝已死/);
  });
});

describe("captionProperNamePhrases", () => {
  it("extracts titled names and short names from a travel caption", () => {
    const names = captionProperNamePhrases(
      "King Robert Baratheon is traveling north to offer Ned the position of Hand of the King, alongside a proposed marriage alliance between Prince Joffrey and Sansa Stark."
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "King Robert Baratheon",
        "Ned",
        "Prince Joffrey",
        "Sansa Stark",
      ])
    );
    expect(names.join(" ")).not.toMatch(/\bHand\b/);
  });
});
