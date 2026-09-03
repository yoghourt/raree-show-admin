/**
 * ADR-011 A4 + A5 + cast consistency / Face Safety.
 *
 * Discovery authorship rules for Canonical Visual Expression — NOT a PromptOptimizer,
 * Planner, Adapter, or extra AI call.
 * Local blank-avoidance rewrites live in Execution Projection (execute-time).
 */

/** Local shape — avoid importing visual-contract (cycle with A4 checks). */
type ExpressionCharacter = { role: string; visual: string };
type ExpressionLike = {
  environment: string;
  characters: ExpressionCharacter[];
  action: string;
  composition: string;
};

/**
 * Injected into Discovery scene propose prompts.
 * Canonical Visual Expression authorship (ADR-011 A5) — not Local blank avoidance.
 */
export const EXPRESSION_CAPABILITY_RULES = `
Renderer Expression — Canonical Visual Expression authorship (required):
These rules apply ONLY to fields.rendererExpression (canonical visible form for image execution).
They MUST NOT change fields.title, fields.summary, displayName, or other Frame Narrative draft prose.
fields.summary is the Reader-step draft Human confirms into caption — keep the story turn, not still geometry.

Answer: if the best renderer existed, what should appear?
Discovery converts narrative meaning into visible geometry + optional narrative-visible cues.
MUST NOT add Planner / Adapter / PromptOptimizer layers.
MUST NOT shrink Expression to a weak Local model's prompt budget (Deployment Projection handles that).

Rule 1 — Required geometry:
Emit: environment; characters[{role, visual}]; action; composition.
character.visual = identity + visible prop/costume cues (keep readable, not quality-spam).
action = static visible clause (who/where/what is happening).
composition = placement / shot intent for required figures.
Optional when they improve the still: lighting, atmosphere, threatPerception, visualEmphasis, styleHints.

Rule 2 — Optional narrative-visible cues (encouraged when Intent supports them):
lighting = lighting intent (cold moonlight, ember key, etc.) — not model hyperparameters.
atmosphere = mood of the air/place (bitter hush, dread, isolation).
threatPerception = how threat should read visually (unseen fog pressure, inhuman scale).
visualEmphasis = narrative focus (formation, prop, scale contrast).
styleHints = stable style family matching THIS work only.
FORBIDDEN in styleHints: masterpiece, 8k, best quality, ultra detailed.
Intent narrow-fold (same propose call, no second AI): when visualIntent has emotion/purpose/
relationship/threat-like meaning, encode into atmosphere / visualEmphasis / threatPerception
and visible action — do not leave meaning only in Intent.

Rule 3 — Static geometry preferred (product continuity):
Prefer verbs/poses: standing, facing, holding, behind, near, fallen, pointing.
FORBIDDEN as motion/physics cues: shattering, lifting, hoisting, throwing, exploding,
mid-air collision/choke, flying debris, large anonymous crowds.
Prefer mid/wide with all required bodies over close-ups that drop a character.
Prefer 2 clear figures over anonymous crowds when the beat is a two-person relationship.
MUST NOT drop a caption-named hinge figure, victim, or third actor to force a two-shot.
Prefer flat left/right or front/back placement — avoid upper/lower tree stacking when possible.

Rule 4 — Abstract action expansion:
Abstract meaning (protect, fight, talk, threaten, betray, overwhelm, debate)
MUST NOT be the only renderer cue — convert to visible arrangement.
Bad: action "protects the king" / "fight" / "talk" / "threat".
Good: "knight standing in front of king, holding sword" + composition "knight foreground, king behind".
Bad: "two warriors fighting".
Good (opponents only): "figure on left holding a weapon, opponent on right holding a weapon, both facing each other".
Allies / same-side beats MUST NOT use facing-each-other or crossed blades.

Rule 5 — Cast consistency (action/composition ↔ characters[]):
Every explicit actor count or named role in action/composition MUST match characters[].
If action says "three rangers", characters[] MUST have three entries (one visual each).
Do NOT write "three …" while listing only two roles.
Bad: characters[ranger, commander] + action "three rangers examine frozen bodies".
Good: three character entries + action "three rangers examining frozen bodies".

Rule 6 — Face Safety (Creator scene_frame; NOT portrait):
Product ceiling: prevent immersion-breaking full-face scene presentation.
MUST NOT add portrait reference / InstantID / IP-Adapter instructions.
MUST NOT change reader-facing title/summary.

Allowed scene_frame face presentation (default ceiling = partial):
  hidden | back_view | distant | partial
Restricted by default:
  full (forward readable face filling meaningful frame area)

Creator default: face visibility <= partial.
HIGH-risk beats (night, battlefield, crowd, monster/creature, heavy armor, blizzard)
  MUST prefer hidden or distant — helmets, hoods, silhouettes, wide/medium-wide shots.
FORBIDDEN as default scene cues: close-up face, tight face fill, facing camera portrait framing.
Encode safety into characters[].visual + action + composition (no new required schema fields).
Bad: action "close-up of boy's terrified face staring at camera".
Good: "two figures looking down at dead wolf at reading distance" + hoods/profiles/wide shot.
Portrait rail (assetSlot=portrait) is OUT OF SCOPE for this rule — full faces remain allowed there.

Rule 7 — Role names in characters[].role (SPEC-CHAR-001):
characters[].role MUST be the Role display name from this Work's candidates.
FORBIDDEN as role labels: woman, man, lady, lord, girl, boy, person, figure (alone).
Proper names stay in reader title/summary; Expression role strings MUST match Role candidates
so Character Archive cues can fold by name.

Rule 8 — Dual-cast Face Safety composition intent:
When characters[].length >= 2, composition SHOULD include medium-wide (or wide) + faces secondary
(or profiles / reading distance). FORBIDDEN without mitigation: waist-up, bust shot,
tight two-shot, head-and-shoulders framing.

Rule 9 — Static object transfer (readable prop beats):
Do NOT use handing / passing / exchanging objects hand-to-hand as the sole cue.
Prefer static visible layout: the SAME named object on a surface;
figures looking at or standing near that object.
Bad: "person handing the object to another".
Good: "the named object on a table between two figures, both looking at it".
MUST keep the object's narrative identity (map stays map; letter stays letter).
Do NOT repeat "exactly N figures" in action (composition face-safety is enough).

Rule 10 — Location identity is invariant:
environment MUST name the authored place, architecture class, and materials.
Projection MAY shorten phrasing. Projection MUST NOT substitute a different place,
architecture class, or narrative setting.
Bad: rewrite a military tent into a stone chamber / castle hall.
Bad: replace one work's landmark with another work's landmark.
Good: keep "felt military tent, campaign table, hanging maps" as a tent.
Good: keep "castle solar, stone chamber, wooden table" as that solar.

Rule 11 — Identity salience + cast differentiation:
Tier 1 Character Identity Features (named weapon, face/body marks, unique silhouette)
MUST survive compression — they outrank generic costume and cinematic tokens.
Tier 2 supporting costume MAY fill remaining budget. Tier 3 generic appearance MAY drop.
Do NOT collapse every figure into the same costume.
Situational documents (letter, map, scroll) appear ONLY when the beat already names them.
Do NOT replace a narrative prop with a more familiar but different object.

Rule 12 — Dual-cast both visible (anti missing figure):
When characters[].length === 2, action MUST name both Roles with left/right placement
and keep any named narrative object.
composition MUST include: medium-wide + both figures fully visible + profiles or looking down.
FORBIDDEN: single centered hero portrait; one figure cropped out; facing-camera stare.
FORBIDDEN: inventing a landmark or prop the Canonical Expression did not name
(e.g. inserting a pool-and-sword layout into an unrelated interior).

Rule 13 — Relationship geometry + hinge cast (anti duel / anti missing third):
Caption relationship decides facing. Do not default two armed figures to a duel.
Allies / same side / storming together: side by side, facing the SAME direction or the same victims.
FORBIDDEN for allies: facing each other; blades crossed; swinging/lunging at one another.
Prefer a stopped still of the same beat (blades down, kneeling/fallen victims) over mid-swing physics.

When caption names a third person as the reason a blow stops (upon seeing X, adopted son, blocks, restrains):
that person MUST be in characters[] with blocking placement (in front / between).
FORBIDDEN: a two-person side-by-side debate that omits the hinge figure.
Convert "halts / stops execution" to static geometry: sword lowered, not striking.

Named extras the beat acts on (eunuchs struck down, officials cowering) MUST have characters[]
entries with static poses (kneeling, fallen, cowering). Do not leave them only in action prose.

A person named only as the source of a gift or order (on behalf of / sent by / by order of)
is off-stage unless the caption places them in the scene. Do not stand them in the still.

Named mounts and treasure (Red Hare, gold, jade) are props in action/visual — not extra people.

Bad: two generals swinging/lunging at each other (caption: they storm the palace together).
Good: two generals side by side, blades down at kneeling/fallen eunuchs, not at each other.
Bad: Ding Yuan pointing + Dong Zhuo with a sword; Lü Bu omitted (caption: halt because of Lü Bu).
Good: Ding Yuan left pointing, Lü Bu in front of him, Dong Zhuo right, execution sword lowered.

Rule 14 — Life-stage is identity (anti adult default):
Apparent age / life-stage is a Tier-1 identity cue, not mood or costume.
Title (Emperor, King, Empress, Prince, Lord) MUST NOT default to a mature bearded adult.
If Work archive or visual identity names child, boy, girl, youth, aged, or elder,
those tokens MUST appear in characters[].visual immediately after pose — they outrank
robes and "mournful features" and MUST survive Local compression.
Relative age across the still is identity. If one figure's visual has weathered /
silver beard / grey hair and another's does not, the unmarked figure MUST stay
younger. FORBIDDEN: moving grey hair or a weathered face onto the figure whose
visual lacks those tokens (son painted older than father; youth holding a prop
given the lord's silver beard).
FORBIDDEN: inventing grey beard, lined middle-aged face, or an adult mournful emperor
when looks mark that ruler as a child/youth, or when the beat elevates/installs a
named emperor whose looks do not say adult.
Bad: Emperor Xian as a grey-bearded adult on the throne (caption: Dong Zhuo elevates him).
Good: boy emperor about eight or nine, no beard, small seated figure; Dong Zhuo towering.

Rule 15 — Living vs undead is identity:
If a figure's visual does not name corpse / dead face / glowing / gaunt pale / wight,
that figure is living. Hair color (cropped brown hair, dark hair) is identity and MUST
survive Local compression — it outranks cloak filler.
"pale face" on a living figure means a fair weathered complexion, not an Other.
FORBIDDEN: painting a living figure as corpse-white, long white/silver hair, or undead
when the still is a haunted / frozen-bodies beat, or when another figure is the authored
undead. Frozen bodies on the ground are the dead — not a named living ranger.
If one figure is authored undead (gaunt pale, glowing, dead face) and another is not,
the unmarked figure MUST stay a living human.
Bad: three living rangers among frozen wildlings; leftmost ranger corpse-white with long
silver hair (an Other inserted into the patrol).
Good: three living humans in black; cropped brown hair stays brown; the dead stay on the snow.
`.trim();

/**
 * Complex physics / spectacle cues Local blank or collapse on (A4 + Rule 3).
 * Used by propose hard-gate + parse warnings — not an Adapter rewrite.
 */
export const FORBIDDEN_PHYSICS_PATTERN =
  /\b(lifts?|lifting|hoists?|hoisting|throws?|throwing|hurls?|hurling|shatters?|shattering|shattered|explodes?|exploding|exploded|flying debris|mid-?air(?:\s+choke)?|by (?:the )?throat|crowd of|dozens of|horde of)\b/i;

/** Abstract-only action cues (Rule 4) — propose soft signal via parse warnings path. */
export const ABSTRACT_ACTION_PATTERN =
  /^(protects?|comforts?|loves?|hates?|guards?|debates?|overwhelms?|fights?|talks?|threatens?|betrays?|threat|fight|talk|battle)\b/i;

const PLACEMENT_HINT_PATTERN =
  /\b(left|right|foreground|background|behind|beside|facing|center|centre|above|below|over|under|near|front)\b/i;

const WORD_COUNT: Record<string, number> = {
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  both: 2,
  pair: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

/** Figure nouns that make "three rangers" / "two warriors" count cues. */
const FIGURE_NOUN =
  /\b(?:rangers?|warriors?|knights?|figures?|characters?|men|women|people|soldiers?|scouts?|bodies)\b/i;

/**
 * Stated actor counts in action/composition when a figure noun is nearby.
 * Ignores authorship bias "exactly N figures" (Rule 9 transport cue).
 */
export function statedActorCountsInText(text: string): number[] {
  const lower = text
    .toLowerCase()
    .replace(/\bexactly\s+[1-6]\s+figures?\b/g, " ");
  const counts = new Set<number>();
  if (/\ba\s+pair\s+of\b/.test(lower) && FIGURE_NOUN.test(lower)) {
    counts.add(2);
  }
  for (const m of lower.matchAll(
    /\b([1-6])\s+(?:rangers?|warriors?|knights?|figures?|characters?|men|women|people|soldiers?|scouts?)\b/g
  )) {
    counts.add(Number(m[1]));
  }
  for (const m of lower.matchAll(
    /\b(one|two|three|four|five|six|both)\s+(?:rangers?|warriors?|knights?|figures?|characters?|men|women|people|soldiers?|scouts?)\b/g
  )) {
    const n = WORD_COUNT[m[1]!];
    if (n != null) counts.add(n);
  }
  if (/\bboth\b/.test(lower) && FIGURE_NOUN.test(lower)) counts.add(2);
  return [...counts];
}

/** First stated actor count, or null when none. */
export function statedActorCountInText(text: string): number | null {
  const counts = statedActorCountsInText(text);
  return counts[0] ?? null;
}

/**
 * Cast consistency errors (Rule 5).
 * Empty when every stated actor count matches characters[].length.
 */
export function findCastConsistencyErrors(
  expression: Pick<ExpressionLike, "action" | "composition" | "characters">
): string[] {
  const castLen = expression.characters?.length ?? 0;
  const blob = `${expression.action ?? ""} ${expression.composition ?? ""}`;
  const statedCounts = statedActorCountsInText(blob);
  const errors: string[] = [];

  for (const stated of statedCounts) {
    if (castLen > 0 && stated !== castLen) {
      errors.push(
        `action/composition states ${stated} actors but characters[] has ${castLen}`
      );
    }
  }

  return errors;
}

/** Few-shot for scene TYPE_EXAMPLES — duel + face-safe + optional atmosphere (A5). */
export const EXPRESSION_CAPABILITY_EXAMPLE: ExpressionLike & {
  atmosphere?: string;
  threatPerception?: string;
  lighting?: string;
} = {
  environment: "the place named in this caption",
  characters: [
    {
      role: "PersonA",
      visual: "standing left, look cues from this work",
    },
    {
      role: "PersonB",
      visual: "standing right, look cues from this work",
    },
  ],
  action: "both figures visible in this caption's still",
  composition: "medium-wide, faces secondary, two figures",
  lighting: "lighting named in this beat if any",
  atmosphere: "mood of this place",
  threatPerception: "threat as this caption states it",
};

/** Mock / courtyard beat — minimal static greeting + face-safe dual cast. */
export const EXPRESSION_COURTYARD_EXAMPLE: ExpressionLike = {
  environment: "Winterfell courtyard, snow, gate behind",
  characters: [
    {
      role: "Eddard Stark",
      visual: "northern fur cloak, greatsword Ice",
    },
    {
      role: "Robert Baratheon",
      visual: "crowned king, dark royal cloak",
    },
  ],
  action: "two nobles facing each other across courtyard",
  composition: "medium wide shot, faces secondary",
};

/** Generic role labels that block Character Archive name fold. */
export const GENERIC_EXPRESSION_ROLE_PATTERN =
  /^(woman|man|lady|lord|girl|boy|female|male|person|figure|king|queen)$/i;

/** Hand-to-hand object transfer — Local often collapses hands (Rule 9). */
export const HAND_TRANSFER_ACTION_PATTERN =
  /\b(handing|hands?\s+(?:over|to)|pass(?:es|ing)?\s+(?:a\s+|the\s+)?(?:letter|parchment|scroll|note)|giv(?:es|ing)\s+(?:a\s+|the\s+)?(?:letter|parchment|scroll)|exchang(?:es|ing)\s+(?:a\s+|the\s+)?(?:letter|parchment))\b/i;

const CLOSE_DUAL_FRAMING_PATTERN =
  /\b(waist[\s-]?up|bust\s+shot|tight\s+two[\s-]?shot|two[\s-]?shot|head[\s-]and[\s-]shoulders|from\s+the\s+waist)\b/i;

const DUAL_CAST_COMPOSITION_FALLBACK =
  "medium-wide, both visible, identity weapons in frame, profiles";

/** Elevated / high camera — do not flatten to a left/right ground standoff. */
const VERTICAL_CAMERA_PATTERN =
  /\b(elevat|high[- ]angle|over-?head|from above|dwarfed|from (?:a |the )?(?:branch|tree|wall|window|tower|rooftop))\b/i;

const TREE_PERCH_PATTERN =
  /\b(branch|bough|canopy|treetop|ironwood|(?:from|in|on) (?:a |the )?(?:\w+\s+)?tree)\b/i;

export function isVerticalTreeCamera(
  expression: Pick<ExpressionLike, "action" | "composition">
): boolean {
  const blob = `${expression.action ?? ""} ${expression.composition ?? ""}`;
  return VERTICAL_CAMERA_PATTERN.test(blob) && TREE_PERCH_PATTERN.test(blob);
}

function hardCapAtBoundary(text: string, maxLen: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const at = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(" "));
  return (at > maxLen * 0.4 ? cut.slice(0, at) : cut).trim();
}

/** Body / face marks that carry character identity (cross-work). */
const IDENTITY_BODY_PATTERN =
  /\b((?:red|black|pale|blue|green|painted)\s+face|long\s+beard|bristling\s+beard|\bbeard\b|\bgaunt\b|\bpale\b|auburn\s+hair|white\s+hair|grey hair|gray hair|no grey hair|no gray hair|silver beard|younger|youthful|beardless|weathered|living (?:human|man|woman|face)|(?:cropped|short|long)\s+(?:dark\s+)?(?:brown|black|red|auburn|blond|blonde|golden)\s+hair|(?:dark\s+)?(?:brown|black|red|blond|blonde|golden)\s+hair|\bstubble\b|topknot|closed\s+helm|\bscar(?:red)?\b)\b/i;

/** Authored elder/weathered marks — must not drift onto the other figure. */
export const WEATHERED_AGE_PATTERN =
  /\b(weathered|grey-streaked|gray-streaked|(?:dark\s+)?beard with silver|(?<!\bno\s)silver(?:ed)?\s+(?:in\s+(?:the\s+)?beard|beard)|white-haired|elderly|lined (?:face|complexion)|(?<!\bno\s)(?:grey|gray) hair)\b/i;

export const RELATIVE_YOUTH_PIN = "younger";

export const ADULT_FACE_LEAK_PATTERN =
  /\b(middle-?aged|lined (?:face|complexion)|old man|(?<!\bno\s)(?:(?:grey|gray)(?:-streaked)?\s+(?:goatee|beard|hair)|white beard|silver beard))\b/i;

/** Authored undead / Other marks — must not drift onto living figures. */
export const UNDEAD_VISUAL_PATTERN =
  /\b(glowing(?:\s+blue)?\s+eyes|dead face|pale dead|standing corpse|\bwight\b|white walker|undead|ice-blue|gaunt pale)\b/i;

/** Scene priors that paint a living extra as the undead beat. */
export const UNDEAD_SCENE_PATTERN =
  /\b(haunted|undead|\bwight\b|white walker|frozen (?:\w+\s+){0,3}bodies|among frozen|frozen to death)\b/i;

export const LIVING_PIN = "living human";

export const AUTHORED_HAIR_COLOR_PATTERN =
  /\b((?:cropped|short|long)\s+)?(?:dark\s+)?(?:brown|black|red|auburn|blond|blonde|golden)\s+hair\b/i;

const WHITE_HAIR_LEAK_PATTERN =
  /\b((?:long\s+)?(?:white|silver|platinum)\s+hair|white-haired)\b/i;

/** Costume class (Tier 2). */
const COSTUME_CUE_PATTERN =
  /\b(cloak|gown|tunic|fur|dress|armor|armour|robe|wrap|mantle|doublet|sandals|helm|shroud)\b/i;

/** Pose / camera / generic cinematic filler (Tier 3 — drop first). */
const TIER3_FILLER_PATTERN =
  /\b(back-?three-?quarter|cinematic|gritty|epic|dark fantasy|photoreal|attractive|handsome|beautiful|looking at camera)\b/i;

/** Weapon / named-object class (not a franchise list). */
const PROP_CLASS_PATTERN =
  /\b(blade|glaive|spear|halberd|greatsword|sword|bow|staff|tablet|letter|scroll|parchment|maps?|helm|crown|altar)\b/i;
const WEAPON_CLASS_PATTERN =
  /\b(blade|glaive|spear|halberd|greatsword|sword|bow|staff)\b/i;
const DOCUMENT_CLASS_PATTERN =
  /\b(letter|scroll|parchment|maps?|tablet)\b/i;
/** Pose / action phrases living inside character.visual — P3, below identity. */
const ACTION_PHRASE_PATTERN =
  /\b(looking|standing|seated|sitting|reaching|turning|reading|facing|walking|leaning|holding|bowed|profile)\b/i;

/** Beat-contact geometry — must outrank generic standing/costume when compressing. */
const BEAT_CONTACT_PATTERN =
  /\b(throat|neck|gauntlets?|hilt|corpse|glowing|dead face)\b/i;

/**
 * Execute-time length knobs for Local adapt (Deployment table).
 * Defaults match the Z-Image row so adapt does not pre-cut to sd-3.5.
 */
export type LocalAdaptBudgets = {
  visualMaxChars: number;
  actionMaxChars: number;
  envMaxChars: number;
  compositionMaxChars: number;
};

const DEFAULT_LOCAL_ADAPT_BUDGETS: LocalAdaptBudgets = {
  visualMaxChars: 400,
  actionMaxChars: 480,
  envMaxChars: 160,
  compositionMaxChars: 120,
};

function shortRoleLabel(role: string): string {
  const parts = role.trim().split(/\s+/).filter(Boolean);
  return parts[0] || role.trim();
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isNamedIdentityWeapon(part: string): boolean {
  return WEAPON_CLASS_PATTERN.test(part) && wordCount(part) >= 2;
}

/**
 * Shared identity-slot ranking (not work-specific):
 * P0 narrative anchors · P1 identity symbols · P2 supporting appearance ·
 * P3 action/pose · P4 generic cinematic.
 * Action phrases must not outrank P1 named weapons or body marks.
 */
function scoreVisualPart(part: string): number {
  if (BEAT_CONTACT_PATTERN.test(part)) return 110;
  if (
    TIER3_FILLER_PATTERN.test(part) &&
    !IDENTITY_BODY_PATTERN.test(part) &&
    !isNamedIdentityWeapon(part)
  ) {
    return 10;
  }
  if (IDENTITY_BODY_PATTERN.test(part)) return 100;
  if (isNamedIdentityWeapon(part)) return 98;
  if (ACTION_PHRASE_PATTERN.test(part)) return 22;
  if (DOCUMENT_CLASS_PATTERN.test(part)) return 92;
  if (COSTUME_CUE_PATTERN.test(part)) return 50;
  if (WEAPON_CLASS_PATTERN.test(part)) return 80;
  if (PROP_CLASS_PATTERN.test(part) && wordCount(part) >= 3) return 70;
  if (PROP_CLASS_PATTERN.test(part)) return 50;
  if (wordCount(part) >= 3) return 40;
  return 30;
}

function isDroppableVisualFiller(part: string): boolean {
  if (BEAT_CONTACT_PATTERN.test(part)) return false;
  if (IDENTITY_BODY_PATTERN.test(part)) return false;
  if (isNamedIdentityWeapon(part)) return false;
  if (TIER3_FILLER_PATTERN.test(part)) return true;
  if (ACTION_PHRASE_PATTERN.test(part)) return true;
  return false;
}

function pickSalientVisualParts(visual: string, maxLen: number): string {
  const parts = visual
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  const pose = parts[0]!;
  const rest = parts.slice(1).filter((p) => !isDroppableVisualFiller(p));
  const useful = [pose, ...rest];
  const joined = useful.join(", ");
  if (joined.length <= maxLen) return joined;

  const ranked = rest
    .map((part, index) => ({ part, index, score: scoreVisualPart(part) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: Array<{ part: string; index: number; score: number }> = [];
  for (const item of ranked) {
    const trial = [
      pose,
      ...[...selected, item]
        .sort((a, b) => a.index - b.index)
        .map((x) => x.part),
    ].join(", ");
    if (trial.length <= maxLen) selected.push(item);
  }
  const ordered = selected
    .sort((a, b) => a.index - b.index)
    .map((x) => x.part);
  return hardCapAtBoundary([pose, ...ordered].join(", "), maxLen);
}

/** Longest narrative object already named in action/environment — never invented. */
function namedNarrativeObject(action: string, environment: string): string | null {
  const blob = `${action} ${environment}`;
  const matches = [
    ...blob.matchAll(
      /\b((?:campaign\s+)?maps?|(?:sealed\s+)?(?:parchment\s+)?letters?|parchments?|scrolls?|\w+\s+blades?|\w+\s+spears?|greatswords?|\w+\s+swords?|blades?|spears?|swords?|tablets?|altars?)\b/gi
    ),
  ];
  if (matches.length === 0) return null;
  let best = matches[0]![0];
  for (const m of matches) {
    if (m[0].length > best.length) best = m[0];
  }
  return best.trim();
}

function rewriteHandTransferPreservingObject(action: string): string {
  const obj =
    namedNarrativeObject(action, "") ??
    action
      .match(
        /\b(?:handing|hands?\s+(?:over|to)|pass(?:es|ing)?|giv(?:es|ing)|exchang(?:es|ing))\s+(?:a\s+|the\s+)?([^,]+?)(?:\s+to\b|$)/i
      )?.[1]
      ?.trim();
  const name = obj && obj.length < 40 ? obj : "the named object";
  return `${name} resting on a surface, both looking at it`;
}

/**
 * Rule 10–12: preserve location identity; keep Tier-1 visual parts.
 * MUST NOT substitute a different place or architecture class.
 */
export function sharpenExpressionAnchors<T extends ExpressionLike>(
  expression: T,
  budgets: LocalAdaptBudgets = DEFAULT_LOCAL_ADAPT_BUDGETS
): T {
  const environment = hardCapAtBoundary(
    expression.environment ?? "",
    budgets.envMaxChars
  );
  const characters = (expression.characters ?? []).map((ch) => ({
    ...ch,
    visual: pickSalientVisualParts(ch.visual.trim(), budgets.visualMaxChars),
  }));
  return { ...expression, environment, characters };
}

/**
 * Local Execution Projection adapt (ADR-011 A5).
 * Apply at execute time via projectExpressionForDeployment("local").
 * MUST NOT overwrite persisted Canonical Expression at propose/validate.
 * MAY wrap (placement / face-safety / length). MUST NOT replace story action
 * with a placement-only stub — that invents a two-figure duel prior.
 */
export function adaptSceneExpressionForLocalCapability<T extends ExpressionLike>(
  expression: T,
  budgets: LocalAdaptBudgets = DEFAULT_LOCAL_ADAPT_BUDGETS
): T {
  const castLen = expression.characters?.length ?? 0;
  const chars = expression.characters ?? [];
  let action = (expression.action ?? "").trim();
  let composition = (expression.composition ?? "").trim();

  // Drop redundant cast-count stacks (LLM + adapt) — blanks Local when repeated.
  action = action
    .replace(/,?\s*exactly\s+(?:\d+|two|three)\s+figures?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();

  if (HAND_TRANSFER_ACTION_PATTERN.test(action)) {
    action = rewriteHandTransferPreservingObject(action);
  }

  if (castLen === 2) {
    const left = shortRoleLabel(chars[0]!.role);
    const right = shortRoleLabel(chars[1]!.role);
    const hasLateralPlacement =
      /\bleft\b/i.test(action) && /\bright\b/i.test(action);
    const verticalCamera = VERTICAL_CAMERA_PATTERN.test(
      `${action} ${composition}`
    );

    const overlayPlacement = /\b(leaning over|standing over|clamped|throat|over him|over her)\b/i.test(
      action
    );

    if (!verticalCamera && !overlayPlacement) {
      if (action && !hasLateralPlacement) {
        action = `${action}, ${left} left, ${right} right`;
      } else if (!action) {
        action = `${left} left, ${right} right`;
      }
      if (!/\bboth\b/i.test(action)) {
        action = `${action}, both fully visible`;
      }
    }

    // Keep authored camera (elevated / wide / dwarfed). Dual-profile fallback
    // only when composition is empty or a close two-shot Local cannot hold.
    if (!composition || CLOSE_DUAL_FRAMING_PATTERN.test(composition)) {
      composition = DUAL_CAST_COMPOSITION_FALLBACK;
    }
  } else if (castLen > 2) {
    composition = composition
      .replace(new RegExp(CLOSE_DUAL_FRAMING_PATTERN.source, "gi"), " ")
      .replace(/,?\s*exactly\s+(?:\d+|two|three)\s+figures?\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s,]+|[\s,]+$/g, "")
      .trim();
    if (!composition) {
      composition = "medium wide shot, faces secondary";
    } else {
      composition = hardCapAtBoundary(
        composition,
        budgets.compositionMaxChars
      );
    }
  }

  action = hardCapAtBoundary(action, budgets.actionMaxChars);

  return pinIdentityLocks(
    sharpenExpressionAnchors(
      {
        ...expression,
        action: action || expression.action,
        composition: composition || expression.composition,
      },
      budgets
    )
  );
}

/** Age, living/undead, and authored hair color — execute and propose persist. */
export function pinIdentityLocks<T extends ExpressionLike>(expression: T): T {
  return pinAuthoredHairColor(
    pinLivingCastAgainstUndeadPrior(pinRelativeAgeContrast(expression))
  );
}

/**
 * When one figure is authored weathered/silver and another is not, pin youth
 * on the unmarked figure so execute cannot swap the father's face onto the son.
 * Does not invent age when nobody in the still has weathered marks.
 */
export function pinRelativeAgeContrast<T extends ExpressionLike>(
  expression: T
): T {
  const chars = expression.characters ?? [];
  if (chars.length < 2) return expression;
  const weathered = chars.map((ch) => WEATHERED_AGE_PATTERN.test(ch.visual));
  const weatheredCount = weathered.filter(Boolean).length;
  if (weatheredCount === 0 || weatheredCount === chars.length) {
    return expression;
  }
  return {
    ...expression,
    characters: chars.map((ch, i) => {
      if (weathered[i]) return ch;
      if (/\byounger\b/i.test(ch.visual)) {
        return ch;
      }
      const parts = ch.visual
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter(
          (p) =>
            !ADULT_FACE_LEAK_PATTERN.test(p) && !WEATHERED_AGE_PATTERN.test(p)
        );
      const pose = parts[0] || "standing";
      const rest = parts.slice(1);
      return { ...ch, visual: [pose, RELATIVE_YOUTH_PIN, ...rest].join(", ") };
    }),
  };
}

function isUndeadVisual(visual: string): boolean {
  return UNDEAD_VISUAL_PATTERN.test(visual);
}

function sceneInvitesUndeadPrior<T extends ExpressionLike>(expression: T): boolean {
  return UNDEAD_SCENE_PATTERN.test(
    `${expression.environment ?? ""} ${expression.action ?? ""} ${expression.composition ?? ""}`
  );
}

function rewritePaleFaceOnLiving(visual: string): string {
  return visual
    .replace(/\bweathered pale face\b/gi, "weathered living face")
    .replace(/\bpale face\b/gi, "living human face");
}

function insertAfterPose(visual: string, token: string): string {
  if (new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(visual)) {
    return visual;
  }
  const parts = visual
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pose = parts[0] || "standing";
  return [pose, token, ...parts.slice(1)].join(", ");
}

function stripWhiteHairLeak(visual: string): string {
  return visual
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !WHITE_HAIR_LEAK_PATTERN.test(p))
    .join(", ");
}

/**
 * Keep living figures human when the still has an undead prior (haunted /
 * frozen bodies, or a peer authored as gaunt pale / dead).
 * Does not invent an undead extra, and does not rewrite authored undead visuals.
 */
export function pinLivingCastAgainstUndeadPrior<T extends ExpressionLike>(
  expression: T
): T {
  const chars = expression.characters ?? [];
  if (!chars.length) return expression;
  const undead = chars.map((ch) => isUndeadVisual(ch.visual));
  const undeadCount = undead.filter(Boolean).length;
  const haunted = sceneInvitesUndeadPrior(expression);
  if (undeadCount === chars.length) return expression;
  if (!haunted && undeadCount === 0) return expression;
  return {
    ...expression,
    characters: chars.map((ch, i) => {
      if (undead[i]) return ch;
      let visual = rewritePaleFaceOnLiving(ch.visual);
      visual = stripWhiteHairLeak(visual);
      if (!/\bliving human\b|\bliving man\b|\bliving woman\b/i.test(visual)) {
        visual = insertAfterPose(visual, LIVING_PIN);
      }
      return { ...ch, visual };
    }),
  };
}

/**
 * Authored hair color is identity. Keep it after pose and drop white/silver
 * hair that drifted onto a figure whose visual already names brown/dark/red hair.
 */
export function pinAuthoredHairColor<T extends ExpressionLike>(
  expression: T
): T {
  const chars = expression.characters ?? [];
  if (!chars.length) return expression;
  return {
    ...expression,
    characters: chars.map((ch) => {
      if (isUndeadVisual(ch.visual)) return ch;
      const hair = ch.visual.match(AUTHORED_HAIR_COLOR_PATTERN)?.[0];
      if (!hair) return ch;
      let visual = stripWhiteHairLeak(ch.visual);
      const withoutHair = visual
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((p) => !AUTHORED_HAIR_COLOR_PATTERN.test(p));
      const pose = withoutHair[0] || "standing";
      const rest = withoutHair.slice(1);
      visual = [pose, hair, ...rest].join(", ");
      return { ...ch, visual };
    }),
  };
}

export function findUndeadIdentityLeaks<T extends ExpressionLike>(
  expression: T
): string[] {
  const chars = expression.characters ?? [];
  const undeadCount = chars.filter((ch) => isUndeadVisual(ch.visual)).length;
  if (!sceneInvitesUndeadPrior(expression) && undeadCount === 0) return [];
  const errors: string[] = [];
  for (const ch of chars) {
    if (isUndeadVisual(ch.visual)) continue;
    if (WHITE_HAIR_LEAK_PATTERN.test(ch.visual)) {
      errors.push(
        `${ch.role}: white/silver hair leaked onto a living figure`
      );
    }
    if (/\b(wight|undead|white walker|dead face|gaunt pale)\b/i.test(ch.visual)) {
      errors.push(
        `${ch.role}: undead marks leaked onto a figure that is not the authored undead`
      );
    }
  }
  return errors;
}

/**
 * When Expression uses generic roles, remap to Role names by order
 * so Character Archive fold can match (propose should already use names).
 */
export function remapGenericRolesToRoleNames<T extends ExpressionLike>(
  expression: T,
  roleNames: string[]
): T {
  const names = roleNames.map((n) => n.trim()).filter(Boolean);
  const chars = expression.characters ?? [];
  if (!names.length || !chars.length || chars.length !== names.length) {
    return expression;
  }
  const genericCount = chars.filter((c) =>
    GENERIC_EXPRESSION_ROLE_PATTERN.test(c.role.trim())
  ).length;
  if (genericCount < Math.ceil(chars.length / 2)) {
    return expression;
  }
  return {
    ...expression,
    characters: chars.map((ch, i) => ({
      ...ch,
      role: names[i] ?? ch.role,
    })),
  };
}

export function findForbiddenPhysicsCues(
  expression: Pick<ExpressionLike, "action" | "composition" | "characters">
): string[] {
  const blobs: string[] = [
    expression.action ?? "",
    expression.composition ?? "",
    ...(expression.characters ?? []).map((c) => `${c.role} ${c.visual}`),
  ];
  const hits = new Set<string>();
  for (const blob of blobs) {
    const match = blob.match(FORBIDDEN_PHYSICS_PATTERN);
    if (match?.[0]) hits.add(match[0].toLowerCase());
  }
  return [...hits];
}

/** Soft check: multi-cast SHOULD name placement. */
export function missingMultiCharacterPlacement(
  expression: Pick<ExpressionLike, "characters" | "composition" | "action">
): boolean {
  if ((expression.characters?.length ?? 0) < 2) return false;
  const spatial = `${expression.composition} ${expression.action}`;
  return !PLACEMENT_HINT_PATTERN.test(spatial);
}

/** True when action is abstract-only / over-compressed (Rule 4). */
export function isAbstractOnlyAction(action: string): boolean {
  const trimmed = action.trim();
  if (!trimmed) return true;
  if (ABSTRACT_ACTION_PATTERN.test(trimmed) && trimmed.split(/\s+/).length <= 3) {
    return true;
  }
  return false;
}

// --- Rule 6: Face Safety (scene_frame) ------------------------------------

export type FaceVisibilityMode =
  | "hidden"
  | "back_view"
  | "distant"
  | "partial"
  | "full"
  | "unknown";

export type SceneFaceRisk = "high" | "medium" | "low";

/**
 * Policy result for Creator scene_frame Face Safety.
 * Portrait generation MUST NOT use this gate.
 */
export type FaceSafetyStatus =
  | "allowed"
  | "requires_human_review"
  | "restricted";

export type SceneFaceSafetyAssessment = {
  safety_status: FaceSafetyStatus;
  /** Primary machine reason code */
  reason: string;
  reasons: string[];
  inferredVisibility: FaceVisibilityMode;
  sceneRisk: SceneFaceRisk;
  requiresExplicitOverride: boolean;
};

/**
 * Unambiguous unrestricted full-face scene requests — propose hard-gate.
 * Negative phrasing ("not close-up", "no close-up") MUST NOT match.
 */
export const FULL_FACE_SCENE_PATTERN =
  /(?<!\bnot\s)(?<!\bno\s)\b(close[\s-]?up|tight\s+face|face\s+fill(?:s|ing)?\s+frame|facing\s+the\s+camera|looking\s+at\s+the\s+camera|staring\s+at\s+the\s+camera|portrait\s+of\s+(?:the\s+)?(?:boy|girl|man|woman|face)|detailed\s+face|facial\s+close)\b/i;

const HIGH_RISK_SCENE_PATTERN =
  /\b(night|moonlight|moonlit|battlefield|battle\b|crowd|horde|army of|monster|creature|undead|white\s*walker|other\b|wight|helmet|heavy\s+armor|armou?red\s+host|blizzard|snowstorm|dark\s+forest|haunted)\b/i;

const SAFE_VISIBILITY_PATTERN =
  /\b(helmet|hood(?:ed)?|face\s+hidden|faces?\s+hidden|veil(?:ed)?|silhouette|from\s+behind|back\s+(?:view|turned)|facing\s+away|occiput|wide\s+shot|medium[\s-]?wide|reading\s+distance|middle\s+distance|faces?\s+secondary|profile|profiles|looking\s+down|both\s+figures\s+fully\s+visible|soft\s+shadow|face\s+in\s+(?:soft\s+)?shadow)\b/i;

const PARTIAL_VISIBILITY_PATTERN =
  /\b(profile|three[\s-]?quarter|¾|partial(?:ly)?\s+(?:visible|obscured)|face\s+turned)\b/i;

function expressionTextBlob(
  expression: Pick<
    ExpressionLike,
    "environment" | "action" | "composition" | "characters"
  >
): string {
  return [
    expression.environment ?? "",
    expression.action ?? "",
    expression.composition ?? "",
    ...(expression.characters ?? []).map((c) => `${c.role} ${c.visual}`),
  ].join(" ");
}

export function classifySceneFaceRisk(
  expression: Pick<
    ExpressionLike,
    "environment" | "action" | "composition" | "characters"
  >
): SceneFaceRisk {
  const blob = expressionTextBlob(expression);
  if (HIGH_RISK_SCENE_PATTERN.test(blob)) return "high";
  const cast = expression.characters?.length ?? 0;
  if (cast >= 2) return "medium";
  if (cast === 0) return "low";
  return "medium";
}

export function inferFaceVisibility(
  expression: Pick<
    ExpressionLike,
    "environment" | "action" | "composition" | "characters"
  >
): FaceVisibilityMode {
  const blob = expressionTextBlob(expression);
  if ((expression.characters?.length ?? 0) === 0) return "distant";
  if (FULL_FACE_SCENE_PATTERN.test(blob)) return "full";
  if (
    /\b(helmet|hood(?:ed)?|face\s+hidden|faces?\s+hidden|silhouette|from\s+behind|back\s+(?:view|turned)|facing\s+away)\b/i.test(
      blob
    )
  ) {
    if (/\b(from\s+behind|back\s+(?:view|turned)|facing\s+away)\b/i.test(blob)) {
      return "back_view";
    }
    return "hidden";
  }
  if (
    /\b(wide\s+shot|medium[\s-]?wide|reading\s+distance|middle\s+distance|faces?\s+secondary)\b/i.test(
      blob
    )
  ) {
    return "distant";
  }
  if (PARTIAL_VISIBILITY_PATTERN.test(blob) || SAFE_VISIBILITY_PATTERN.test(blob)) {
    return "partial";
  }
  return "unknown";
}

/**
 * Hard-gate cues for propose: unrestricted full-face scene Expression.
 * Does NOT apply to portrait assetSlot.
 */
export function findRestrictedFullFaceSceneCues(
  expression: Pick<
    ExpressionLike,
    "environment" | "action" | "composition" | "characters"
  >
): string[] {
  if ((expression.characters?.length ?? 0) === 0) return [];
  const blob = expressionTextBlob(expression);
  const match = blob.match(FULL_FACE_SCENE_PATTERN);
  return match?.[0] ? [match[0].toLowerCase()] : [];
}

/**
 * Assess Creator scene_frame Face Safety against Rule 6.
 * Portrait path MUST NOT call this for blocking.
 */
export function assessSceneFaceSafety(
  expression: Pick<
    ExpressionLike,
    "environment" | "action" | "composition" | "characters"
  >,
  options?: { explicitOverride?: boolean }
): SceneFaceSafetyAssessment {
  const castLen = expression.characters?.length ?? 0;
  if (castLen === 0) {
    return {
      safety_status: "allowed",
      reason: "no_cast_landscape",
      reasons: ["empty characters[] — face policy N/A"],
      inferredVisibility: "distant",
      sceneRisk: "low",
      requiresExplicitOverride: false,
    };
  }

  const sceneRisk = classifySceneFaceRisk(expression);
  const inferredVisibility = inferFaceVisibility(expression);
  const fullCues = findRestrictedFullFaceSceneCues(expression);
  const blob = expressionTextBlob(expression);
  const hasSafeCue = SAFE_VISIBILITY_PATTERN.test(blob);
  const reasons: string[] = [];

  if (fullCues.length) {
    reasons.push(`full_face_cue:${fullCues.join(",")}`);
  }
  if (sceneRisk === "high" && !hasSafeCue && inferredVisibility !== "hidden") {
    reasons.push("high_risk_without_face_mitigation");
  }
  if (inferredVisibility === "full") {
    reasons.push("inferred_visibility_full");
  }
  if (
    inferredVisibility === "unknown" &&
    sceneRisk !== "low" &&
    !hasSafeCue
  ) {
    reasons.push("ambiguous_face_presentation");
  }

  const override = options?.explicitOverride === true;

  // Unambiguous full-face request
  if (fullCues.length || inferredVisibility === "full") {
    if (override) {
      return {
        safety_status: "requires_human_review",
        reason: "full_face_scene_expression_override",
        reasons: [...reasons, "explicit_override"],
        inferredVisibility: "full",
        sceneRisk,
        requiresExplicitOverride: false,
      };
    }
    return {
      safety_status: "restricted",
      reason: "full_face_scene_expression",
      reasons,
      inferredVisibility: "full",
      sceneRisk,
      requiresExplicitOverride: true,
    };
  }

  // HIGH risk without mitigation → human review (generation may still run)
  if (sceneRisk === "high" && !hasSafeCue) {
    return {
      safety_status: "requires_human_review",
      reason: "high_risk_scene_face_exposure",
      reasons:
        reasons.length > 0 ? reasons : ["high_risk_scene_face_exposure"],
      inferredVisibility,
      sceneRisk,
      requiresExplicitOverride: false,
    };
  }

  if (inferredVisibility === "unknown" && sceneRisk === "medium") {
    return {
      safety_status: "requires_human_review",
      reason: "ambiguous_face_presentation",
      reasons:
        reasons.length > 0 ? reasons : ["ambiguous_face_presentation"],
      inferredVisibility,
      sceneRisk,
      requiresExplicitOverride: false,
    };
  }

  return {
    safety_status: "allowed",
    reason: "within_scene_face_ceiling",
    reasons: reasons.length ? reasons : ["face_visibility_within_partial_ceiling"],
    inferredVisibility:
      inferredVisibility === "unknown" ? "partial" : inferredVisibility,
    sceneRisk,
    requiresExplicitOverride: false,
  };
}
