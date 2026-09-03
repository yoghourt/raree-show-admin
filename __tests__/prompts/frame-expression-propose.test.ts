import { describe, expect, it } from "vitest";

import {
  LOCAL_ACTION_MAX,
  packActionNamingCast,
} from "@/lib/discovery/execution-projection";
import { SD35_CAPABILITY } from "@/lib/ai/image/rendererCapability";
import {
  applyCharacterLifeStageLooks,
  buildFrameExpressionProposePrompt,
  captionAgencyOnlyNames,
  captionOnStageNames,
  captionProperNamePhrases,
  costumeLookFromIdentity,
  findLifeStageContradictions,
  lifeStageLookFromIdentity,
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

  it("persists the full authored visual and action (no Local pack at propose)", () => {
    const longVisual =
      "kneeling in snow, stubble beard, pale eyes, rough black wool tunic, boiled leather doublet, heavy fur-lined black cloak, weathered young Night's Watch deserter";
    const longAction =
      "Lord Eddard Stark standing over kneeling Gared with raised sword; Bran Stark mounted on horse in background watching in profile from the far courtyard edge";
    expect(longVisual.length).toBeGreaterThan(SD35_CAPABILITY.visualMaxChars);
    expect(longAction.length).toBeGreaterThan(SD35_CAPABILITY.actionMaxChars);

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
    expect(out.value.characters[0]?.visual).toBe(longVisual);
    expect(out.value.characters[1]?.visual).toMatch(/^mounted on horse/);
    expect(out.value.action).toBe(longAction);
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
    expect(p).toMatch(/Rule 13/);
    expect(p).toMatch(/not at each other/);
    expect(p).toMatch(/hinge/);
    expect(p).toMatch(/storm the palace/);
    expect(p).toMatch(/Lü Bu/);
    expect(p).toMatch(/Caption-named groups/);
    expect(p).toMatch(/MUST NOT stand in the still/);
    expect(p).toMatch(/Red Hare/);
    expect(p).toMatch(/off-stage/);
    expect(p).toMatch(/ending on a bare name/);
    expect(p).toMatch(/Do NOT add other Work characters/);
    expect(p).toMatch(/pose\/blocking/);
    expect(p).not.toMatch(/Local execute budget/);
    expect(p).not.toMatch(/visual ≤ 80/);
    expect(p).toMatch(/weathered northern lord face/);
    expect(p).toMatch(/Rule 14/);
    expect(p).toMatch(/boy emperor about nine/);
    expect(p).toMatch(/grey goatee/);
    expect(p).toMatch(/Relative age/);
    expect(p).toMatch(/unmarked figure MUST stay younger/);
    expect(p).toMatch(/Rule 15/);
    expect(p).toMatch(/Living vs undead/);
    expect(p).toMatch(/three living humans in black/);
    expect(p).toMatch(/Rule 16/);
    expect(p).toMatch(/Wardrobe is identity/);
    expect(p).toMatch(/same distinctive silhouettes as looks/);
  });

  it("lists life-stage from Work looks as a must-keep identity cue", () => {
    const p = buildFrameExpressionProposePrompt({
      workTitle: "Romance of the Three Kingdoms",
      caption: "Dong Zhuo elevates Emperor Xian and seizes absolute power.",
      characterCues: [
        {
          name: "Emperor Xian",
          visualIdentity: "FACE: child emperor, boy about nine. COSTUME: imperial robes.",
        },
      ],
    });
    expect(p).toMatch(/Life-stage \/ apparent age/);
    expect(p).toMatch(/Emperor Xian: child emperor, no beard/);
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

  it("injects this work's visual convention when set", () => {
    const p = buildFrameExpressionProposePrompt({
      workTitle: "A Game of Thrones",
      caption: "Will sees the Others in the woods.",
      visualConvention:
        "ERA: medieval wool, fur. FORBID: modern military camouflage.",
    });
    expect(p).toMatch(/Work look/);
    expect(p).toMatch(/medieval wool/);
    expect(p).toMatch(/modern military/);
    expect(p).toMatch(/caption beat still win/);
  });
});

describe("life-stage identity", () => {
  it("extracts a child look and folds it after pose", () => {
    expect(
      lifeStageLookFromIdentity("FACE: child emperor, boy about nine.")
    ).toBe("child emperor, no beard");

    const folded = applyCharacterLifeStageLooks(
      {
        environment: "imperial throne room",
        characters: [
          {
            role: "Emperor Xian",
            visual:
              "seated on throne, mournful features, opulent imperial robes, grey goatee",
          },
        ],
        action: "Dong Zhuo towers; Emperor Xian seated",
        composition: "medium-wide",
      },
      [
        {
          name: "Emperor Xian",
          visualIdentity: "FACE: child emperor about nine.",
        },
      ]
    );
    expect(folded.characters[0]?.visual).toMatch(/^seated on throne/i);
    expect(folded.characters[0]?.visual).toMatch(/child emperor/i);
    expect(folded.characters[0]?.visual).not.toMatch(/grey goatee/i);
  });

  it("flags an adult face against child looks", () => {
    const errors = findLifeStageContradictions(
      {
        environment: "hall",
        characters: [
          {
            role: "Emperor Xian",
            visual: "seated, middle-aged, grey goatee, imperial robes",
          },
        ],
        action: "seated",
        composition: "wide",
      },
      [{ name: "Emperor Xian", visualIdentity: "FACE: child emperor." }]
    );
    expect(errors.join(" ")).toMatch(/adult face/i);
  });

  it("pins relative youth when a peer is weathered", () => {
    const folded = applyCharacterLifeStageLooks(
      {
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
        action: "Jon holds a pup and urges Ned",
        composition: "medium-wide",
      },
      [
        {
          name: "Jon Snow",
          visualIdentity: "FACE: long face, dark hair. COSTUME: black cloak.",
        },
        {
          name: "Lord Eddard",
          visualIdentity:
            "FACE: weathered northern lord, dark beard with silver.",
        },
      ]
    );
    expect(folded.characters[0]?.visual).toMatch(/^standing left/i);
    expect(folded.characters[0]?.visual).toMatch(/younger/i);
    expect(folded.characters[0]?.visual).not.toMatch(/weathered/i);
    expect(folded.characters[1]?.visual).toMatch(/weathered/i);
    expect(folded.characters[1]?.visual).toMatch(/dark beard with silver/i);
  });

  it("flags grey/weathered leaking onto the unmarked figure", () => {
    const errors = findLifeStageContradictions(
      {
        environment: "snow",
        characters: [
          {
            role: "Jon Snow",
            visual: "standing left, holding a pup, grey beard, black cloak",
          },
          {
            role: "Lord Eddard",
            visual: "standing right, weathered northern face, thick fur cloak",
          },
        ],
        action: "Jon urges Ned",
        composition: "medium-wide",
      },
      []
    );
    expect(errors.join(" ")).toMatch(/leaked/i);
    expect(errors.join(" ")).toMatch(/Jon Snow/);
  });

  it("pins living rangers and keeps cropped brown hair in a haunted still", () => {
    const folded = applyCharacterLifeStageLooks(
      {
        environment: "haunted forest north of the Wall",
        characters: [
          {
            role: "Will",
            visual:
              "standing left, weathered pale face, cropped brown hair, all-black cloak",
          },
          {
            role: "Gared",
            visual: "standing center, weathered young man, pale eyes, black wool",
          },
          {
            role: "Ser Waymar Royce",
            visual: "standing right, younger, no grey hair, nobleman armor",
          },
        ],
        action: "three rangers standing among frozen wildling bodies",
        composition: "medium-wide",
      },
      []
    );
    expect(folded.characters[0]?.visual).toMatch(/living human/i);
    expect(folded.characters[0]?.visual).toMatch(/cropped brown hair/i);
    expect(folded.characters[0]?.visual).toMatch(/weathered living face/i);
    expect(folded.characters[0]?.visual).not.toMatch(/pale face/i);
  });

  it("flags white hair leaking onto a living ranger with authored brown hair", () => {
    const errors = findLifeStageContradictions(
      {
        environment: "haunted forest north of the Wall",
        characters: [
          {
            role: "Will",
            visual:
              "standing left, cropped brown hair, long white hair, black cloak",
          },
          {
            role: "Gared",
            visual: "standing center, black wool",
          },
        ],
        action: "standing among frozen wildling bodies",
        composition: "medium-wide",
      },
      []
    );
    expect(errors.join(" ")).toMatch(/white\/silver hair leaked/i);
  });

  it("strips a matching cloak from armor/mail looks that do not wear a cloak", () => {
    expect(
      costumeLookFromIdentity("FACE: young lord.\nCOSTUME: nobleman armor, grey mail.")
    ).toMatch(/nobleman armor/i);

    const folded = applyCharacterLifeStageLooks(
      {
        environment: "bare snowy clearing",
        characters: [
          {
            role: "Will",
            visual: "standing left, all-black Night's Watch wool cloak, fur collar",
          },
          {
            role: "Ser Waymar Royce",
            visual: "standing right, black cloak, nobleman armor",
          },
        ],
        action: "standing in empty snow",
        composition: "wide",
      },
      [
        {
          name: "Will",
          visualIdentity: "COSTUME: all-black Night's Watch wool cloak, fur collar.",
        },
        {
          name: "Ser Waymar Royce",
          visualIdentity: "COSTUME: nobleman armor, grey mail.",
        },
      ]
    );
    expect(folded.characters[0]?.visual).toMatch(/wool cloak/i);
    expect(folded.characters[1]?.visual).toMatch(/nobleman armor/i);
    expect(folded.characters[1]?.visual).toMatch(/grey mail/i);
    expect(folded.characters[1]?.visual).not.toMatch(/black cloak/i);
  });

  it("flags a matching cloak leaked onto armor/mail looks", () => {
    const errors = findLifeStageContradictions(
      {
        environment: "snow",
        characters: [
          {
            role: "Will",
            visual: "standing left, all-black wool cloak",
          },
          {
            role: "Ser Waymar Royce",
            visual: "standing right, black cloak, plate",
          },
        ],
        action: "standing",
        composition: "wide",
      },
      [
        { name: "Will", visualIdentity: "COSTUME: black wool cloak." },
        {
          name: "Ser Waymar Royce",
          visualIdentity: "COSTUME: nobleman armor, grey mail.",
        },
      ]
    );
    expect(errors.join(" ")).toMatch(/matching cloak leaked/i);
    expect(errors.join(" ")).toMatch(/Ser Waymar Royce/);
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

  it("does not treat sentence-initial verbs or generic Emperor as cast", () => {
    const names = captionProperNamePhrases(
      "Backed by Lü Bu, Dong Zhuo demands the deposition of the Emperor at a second assembly."
    );
    expect(names).toEqual(expect.arrayContaining(["Lü Bu", "Dong Zhuo"]));
    expect(names).not.toEqual(expect.arrayContaining(["Backed"]));
    expect(names).not.toEqual(expect.arrayContaining(["Emperor"]));
  });
});

describe("captionAgencyOnlyNames / captionOnStageNames", () => {
  const caption =
    "Enticed by Li Su bearing the legendary Red Hare horse, gold, pearls, and jade on behalf of Dong Zhuo, the mercenary Lü Bu agrees to switch sides.";

  it("keeps the messenger and the tempted on stage, not the off-stage principal", () => {
    expect(captionAgencyOnlyNames(caption)).toEqual(
      expect.arrayContaining(["Dong Zhuo"])
    );
    const onStage = captionOnStageNames(caption);
    expect(onStage).toEqual(expect.arrayContaining(["Li Su", "Lü Bu"]));
    expect(onStage).not.toEqual(expect.arrayContaining(["Dong Zhuo"]));
    expect(onStage).not.toEqual(expect.arrayContaining(["Enticed"]));
  });
});

describe("packActionNamingCast", () => {
  it("fills a trailing bare role with the first visual pose", () => {
    const packed = packActionNamingCast(
      "Li Su stands left presenting the Red Hare horse and treasure chests of gold and jade; Lü Bu",
      [
        {
          role: "Li Su",
          visual: "standing on left, holding reins of Red Hare horse",
        },
        {
          role: "Lü Bu",
          visual: "standing center, looking intently at the horse",
        },
      ],
      LOCAL_ACTION_MAX
    );
    expect(packed).toMatch(/Lü Bu/i);
    expect(packed).toMatch(/standing center/i);
    expect(packed).not.toMatch(/;\s*Lü Bu\s*$/i);
    expect(packed.length).toBeLessThanOrEqual(LOCAL_ACTION_MAX);
  });
});

describe("parseFrameExpressionProposal trailing action", () => {
  it("persists the authored trailing bare name (execute repairs, not persist)", () => {
    const action =
      "Li Su stands left presenting the Red Hare horse and treasure chests of gold and jade; Lü Bu";
    const out = parseFrameExpressionProposal(
      JSON.stringify({
        environment: "military camp courtyard at night, torch posts",
        characters: [
          {
            role: "Li Su",
            visual: "standing on left, holding reins of Red Hare horse",
          },
          {
            role: "Lü Bu",
            visual: "standing center, looking intently at the horse",
          },
        ],
        action,
        composition: "medium-wide shot, both fully visible, faces secondary",
      })
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.action).toBe(action);
  });
});
