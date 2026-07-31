/**
 * ADR-011 A4 + Expression Minimality + cast consistency.
 *
 * ExpressionCapabilityConstraints for Discovery authorship — NOT a PromptOptimizer,
 * Planner, Adapter, or extra AI call. Local-first: minimum sufficient visible geometry.
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
 * Spike evidence: more Expression detail ≠ better Local rendering.
 */
export const EXPRESSION_CAPABILITY_RULES = `
Renderer Expression — Local capability constraints (required):
These rules apply ONLY to fields.rendererExpression (image execution input).
They MUST NOT change fields.title, fields.summary, displayName, or other reader-facing prose
(those become frame caption for readers and MUST keep proper names when the narrative supports them).

Discovery converts narrative meaning into MINIMUM SUFFICIENT visible geometry inside rendererExpression.
Goal: consistent readable narrative visualization — NOT maximum prompt completeness.
MUST NOT add Planner / Adapter / PromptOptimizer layers.

Rule 1 — Minimal required geometry (default payload):
Emit ONLY: environment; characters[{role, visual}]; action; composition.
character.visual = short identity + ONE visible object/prop (e.g. "armored knight holding sword").
action = one short static visible clause.
composition = placement of required figures (e.g. "two characters facing each other").
Do NOT add information unless it improves reader understanding of who/where/what is visible.

Rule 2 — Remove non-essential modifiers:
Do NOT generate by default: lighting, styleHints, cinematic wording, quality tokens,
or stacks of decorative adjectives.
Reason: extra constraints raise Local blank / failure rate (minimality spike).

Rule 3 — Static geometry preferred:
Prefer verbs/poses: standing, facing, holding, behind, near, fallen, pointing.
FORBIDDEN as motion/physics cues: shattering, lifting, hoisting, throwing, exploding,
mid-air collision/choke, flying debris, large anonymous crowds.
Prefer mid/wide with all required bodies over close-ups that drop a character.
Prefer 2 clear figures over crowds when the beat is a relationship.
Prefer flat left/right or front/back placement — avoid upper/lower tree stacking when possible
(Local weak on vertical multi-figure geometry; see capability profile finding).

Rule 4 — Abstract action expansion:
Abstract meaning (protect, fight, talk, threaten, betray, overwhelm, debate)
MUST NOT be the only renderer cue — convert to visible arrangement.
Bad: action "protects the king" / "fight" / "talk" / "threat".
Good: "knight standing in front of king, holding sword" + composition "knight foreground, king behind".
Bad: "two warriors fighting".
Good: "knight on left holding steel sword, enemy on right holding ice sword, both facing each other".

Rule 5 — Cast consistency (action/composition ↔ characters[]):
Every explicit actor count or named role in action/composition MUST match characters[].
If action says "three rangers", characters[] MUST have three entries (one visual each).
Do NOT write "three …" while listing only two roles.
Bad: characters[ranger, commander] + action "three rangers examine frozen bodies".
Good: three character entries + action "three rangers examining frozen bodies".
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
 * Stated actor count in action/composition when a figure noun is nearby.
 * Returns null when no explicit count cue.
 */
export function statedActorCountInText(text: string): number | null {
  const lower = text.toLowerCase();
  // "a pair of …"
  if (/\ba\s+pair\s+of\b/.test(lower) && FIGURE_NOUN.test(lower)) return 2;
  // digit: "3 rangers", "2 figures"
  const digit = lower.match(
    /\b([1-6])\s+(?:rangers?|warriors?|knights?|figures?|characters?|men|women|people|soldiers?|scouts?)\b/
  );
  if (digit) return Number(digit[1]);
  // word: "three rangers", "both warriors", "two characters"
  const word = lower.match(
    /\b(one|two|three|four|five|six|both)\s+(?:rangers?|warriors?|knights?|figures?|characters?|men|women|people|soldiers?|scouts?)\b/
  );
  if (word) return WORD_COUNT[word[1]!] ?? null;
  if (/\bboth\b/.test(lower) && FIGURE_NOUN.test(lower)) return 2;
  return null;
}

/**
 * Cast consistency errors (Rule 5).
 * Empty when stated actor count in action/composition matches characters[].length.
 */
export function findCastConsistencyErrors(
  expression: Pick<ExpressionLike, "action" | "composition" | "characters">
): string[] {
  const castLen = expression.characters?.length ?? 0;
  const blob = `${expression.action ?? ""} ${expression.composition ?? ""}`;
  const stated = statedActorCountInText(blob);
  const errors: string[] = [];

  if (stated !== null && castLen > 0 && stated !== castLen) {
    errors.push(
      `action/composition states ${stated} actors but characters[] has ${castLen}`
    );
  }

  return errors;
}

/** Few-shot for scene TYPE_EXAMPLES — minimal sufficient duel geometry. */
export const EXPRESSION_CAPABILITY_EXAMPLE: ExpressionLike = {
  environment: "snow clearing",
  characters: [
    {
      role: "knight",
      visual: "armored knight holding sword",
    },
    {
      role: "white_walker",
      visual: "ice warrior holding sword",
    },
  ],
  action: "two warriors facing each other with swords crossed",
  composition: "two characters facing each other",
};

/** Mock / courtyard beat — minimal static greeting. */
export const EXPRESSION_COURTYARD_EXAMPLE: ExpressionLike = {
  environment: "snowy courtyard",
  characters: [
    {
      role: "lord",
      visual: "noble in fur cloak standing",
    },
    {
      role: "king",
      visual: "crowned king standing",
    },
  ],
  action: "lord and king facing each other",
  composition: "lord on left, king on right",
};

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
