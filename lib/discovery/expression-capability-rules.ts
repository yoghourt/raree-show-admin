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
styleHints = stable style family only (e.g. "desaturated dark fantasy illustration").
FORBIDDEN in styleHints: masterpiece, 8k, best quality, ultra detailed.
Intent narrow-fold (same propose call, no second AI): when visualIntent has emotion/purpose/
relationship/threat-like meaning, encode into atmosphere / visualEmphasis / threatPerception
and visible action — do not leave meaning only in Intent.

Rule 3 — Static geometry preferred (product continuity):
Prefer verbs/poses: standing, facing, holding, behind, near, fallen, pointing.
FORBIDDEN as motion/physics cues: shattering, lifting, hoisting, throwing, exploding,
mid-air collision/choke, flying debris, large anonymous crowds.
Prefer mid/wide with all required bodies over close-ups that drop a character.
Prefer 2 clear figures over crowds when the beat is a relationship.
Prefer flat left/right or front/back placement — avoid upper/lower tree stacking when possible.

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
characters[].role MUST be the Role display name (e.g. "Eddard Stark", "Catelyn Stark").
FORBIDDEN as role labels: woman, man, lady, lord, girl, boy, person, figure (alone).
Proper names stay in reader title/summary; Expression role strings MUST match Role candidates
so Character Archive cues can fold by name.

Rule 8 — Dual-cast Face Safety composition intent:
When characters[].length >= 2, composition SHOULD include medium-wide (or wide) + faces secondary
(or profiles / reading distance). FORBIDDEN without mitigation: waist-up, bust shot,
tight two-shot, head-and-shoulders framing.

Rule 9 — Static object transfer (readable prop beats):
Do NOT use handing / passing / exchanging letters or props hand-to-hand as the sole cue.
Prefer static visible layout: object on table / on ground / resting against tree;
figures looking at or standing near the object.
Bad: "woman handing parchment to man".
Good: "sealed letter on wooden table between two figures, both looking at letter".
Do NOT repeat "exactly N figures" in action (composition face-safety is enough).

Rule 10 — Hard scene anchors (short, specific):
environment MUST name ONE concrete landmark, ≤ ~12 words.
Bad: "ancient forest with dark water and mist".
Good: "Winterfell godswood, pale carved weirwood by dark pool".
Good: "Winterfell solar, stone chamber, wooden table".
FORBIDDEN: generic fog forest / anonymous stone room without place cue.

Rule 11 — Prop salience + cast differentiation:
Each character.visual = costume cue + at most ONE iconic prop (keep clear nouns).
Iconic props (Ice, sealed letter) MUST be the clearest noun in that visual — not buried
under three clothing adjectives.
Do NOT give every figure the same fur-cloak look.
Letter/scroll appears ONLY on the beat that needs it (not every dual-cast frame).
Differentiate Roles: e.g. Ned = northern fur + greatsword Ice; Catelyn = southern gown
(letter only when she bears news).
Costume mutex: Catelyn MUST NOT wear heavy fur mantle; Ned MUST NOT wear southern gown.
Letter beats: "sealed parchment letter only" — FORBIDDEN sand/terrain/map props.

Rule 12 — Dual-cast both visible (anti missing figure):
When characters[].length === 2, action MUST name both Roles with left/right placement
(e.g. "Eddard left by pool with Ice, Catelyn right standing, both fully visible").
composition MUST include: medium-wide + both figures fully visible + profiles or looking down.
FORBIDDEN: single centered hero portrait; one figure cropped out; facing-camera stare.
Godswood env MUST be exclusive landmark: "pale weirwood face carved in white bark, dark pool"
(do not dilute with generic mist forest).
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
  environment: "Haunted Forest clearing under moonlight",
  characters: [
    {
      role: "Waymar Royce",
      visual: "steel sword, closed helm armor",
    },
    {
      role: "White Walker",
      visual: "ice sword, hooded pale figure",
    },
  ],
  action: "two warriors facing each other, swords crossed at middle distance",
  composition: "wide shot, faces secondary, two silhouettes",
  lighting: "cold moonlight, pale rim on ice blade",
  atmosphere: "supernatural cold, wrong stillness",
  threatPerception: "inhuman opponent; lethal scale",
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

function hardCapAtBoundary(text: string, maxLen: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const at = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(" "));
  return (at > maxLen * 0.4 ? cut.slice(0, at) : cut).trim();
}

const PROP_CUE_PATTERN =
  /\b(ice|greatsword|sword|letter|scroll|parchment|raven)\b/i;
const COSTUME_CUE_PATTERN =
  /\b(cloak|gown|tunic|fur|dress|armor|armour|robe|wrap|mantle|doublet)\b/i;
const HEAVY_FUR_PATTERN =
  /\b(fur[\s-]?(?:trimmed\s+)?(?:winter\s+)?(?:cloak|mantle)|heavy\s+fur|fur\s+mantle|shaggy\s+fur)\b/i;
const SOUTHERN_GOWN_PATTERN = /\b(southern[\s-]?(style\s+)?|noble\s+)?gown\b|\bdress\b/i;

function shortRoleLabel(role: string): string {
  const parts = role.trim().split(/\s+/).filter(Boolean);
  return parts[0] || role.trim();
}

function roleMentions(text: string, role: string): boolean {
  const full = role.trim().toLowerCase();
  const first = shortRoleLabel(role).toLowerCase();
  const t = text.toLowerCase();
  return (full.length > 2 && t.includes(full)) || (first.length > 2 && t.includes(first));
}

function cleanupVisualList(visual: string): string {
  return visual
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function applyCostumeMutex(role: string, visual: string): string {
  let v = visual;
  if (/catelyn/i.test(role)) {
    v = v.replace(HEAVY_FUR_PATTERN, "");
    v = cleanupVisualList(v);
    if (!SOUTHERN_GOWN_PATTERN.test(v)) {
      v = v ? `${v}, southern noble gown` : "southern noble gown";
    }
  } else if (/eddard|\bned\b/i.test(role)) {
    v = v.replace(SOUTHERN_GOWN_PATTERN, "");
    v = cleanupVisualList(v);
    if (!/\b(fur|tunic|mantle|cloak|doublet)\b/i.test(v) && !PROP_CUE_PATTERN.test(v)) {
      v = v ? `${v}, northern fur cloak` : "northern fur cloak";
    }
  }
  return cleanupVisualList(v);
}

function pickSalientVisualParts(visual: string): string {
  const parts = visual
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return hardCapAtBoundary(parts.join(", "), 56);
  const prop = parts.find((p) => PROP_CUE_PATTERN.test(p));
  const costume = parts.find((p) => p !== prop && COSTUME_CUE_PATTERN.test(p));
  const keep: string[] = [];
  if (prop) keep.push(prop);
  if (costume) keep.push(costume);
  for (const p of parts) {
    if (keep.length >= 2) break;
    if (!keep.includes(p)) keep.push(p);
  }
  return hardCapAtBoundary(keep.join(", "), 56);
}

/**
 * Rule 10–12: landmark exclusivity, prop salience, costume mutex.
 */
export function sharpenExpressionAnchors<T extends ExpressionLike>(
  expression: T
): T {
  let environment = hardCapAtBoundary(expression.environment ?? "", 64);
  const actionBlob = `${expression.action ?? ""} ${expression.composition ?? ""}`;
  const placeBlob = `${environment} ${actionBlob}`;

  if (/\b(godswood|weirwood|heart\s*tree|dark\s+pool)\b/i.test(placeBlob)) {
    // Exclusive landmark — do not dilute with generic forest mist.
    environment = "pale weirwood face carved in white bark, dark pool";
  } else if (
    /\bwinterfell\b/i.test(placeBlob) &&
    !/\b(stone chamber|solar|great hall|courtyard)\b/i.test(environment)
  ) {
    environment = hardCapAtBoundary(
      `Winterfell stone chamber, wooden table`,
      64
    );
  } else if (
    /\b(chamber|solar|table|letter|parchment|scroll)\b/i.test(placeBlob) &&
    !/\b(stone chamber|solar|wooden table)\b/i.test(environment)
  ) {
    environment = hardCapAtBoundary("Winterfell stone chamber, wooden table", 64);
  }

  const characters = (expression.characters ?? []).map((ch) => {
    const muted = applyCostumeMutex(ch.role, ch.visual.trim());
    return { ...ch, visual: pickSalientVisualParts(muted) };
  });

  return { ...expression, environment, characters };
}

/**
 * Local Execution Projection adapt (ADR-011 A5).
 * Apply at execute time via projectExpressionForDeployment("local").
 * MUST NOT overwrite persisted Canonical Expression at propose/validate.
 * Applies Rules 8–12 for Local face-safety + landmark/prop blank avoidance.
 */
export function adaptSceneExpressionForLocalCapability<T extends ExpressionLike>(
  expression: T
): T {
  const castLen = expression.characters?.length ?? 0;
  const chars = expression.characters ?? [];
  let action = (expression.action ?? "").trim();
  let composition = (expression.composition ?? "").trim();

  // Drop redundant cast-count stacks (LLM + adapt) — blanks Local when repeated.
  action = action
    .replace(/,?\s*exactly\s+(?:\d+|two|three)\s+figures?\b/gi, "")
    .replace(/\b(sand|terrain)\s+map\b/gi, "sealed parchment letter")
    .replace(/\bmap\b/gi, "letter")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();

  if (HAND_TRANSFER_ACTION_PATTERN.test(action)) {
    action =
      "sealed parchment letter on wooden table, both looking down at letter";
  }

  if (castLen === 2) {
    const left = shortRoleLabel(chars[0]!.role);
    const right = shortRoleLabel(chars[1]!.role);
    const namesBoth =
      roleMentions(action, chars[0]!.role) &&
      roleMentions(action, chars[1]!.role);
    const hasPlacement = /\bleft\b/i.test(action) && /\bright\b/i.test(action);

    if (!namesBoth || !hasPlacement) {
      if (/\b(letter|scroll|parchment)\b/i.test(action)) {
        action = `sealed parchment letter on table, ${left} left, ${right} right, both looking down`;
      } else if (
        /\b(godswood|weirwood|pool|ice|sword)\b/i.test(
          `${action} ${expression.environment ?? ""}`
        )
      ) {
        action = `${left} left by pool with sword, ${right} right standing, both fully visible`;
      } else {
        action = `${left} left, ${right} right, both fully visible`;
      }
    } else if (!/\bboth\b/i.test(action)) {
      action = `${action}, both fully visible`;
    }

    composition =
      "medium wide shot, both figures fully visible, profiles or looking down";
  } else if (castLen > 2) {
    composition = composition
      .replace(new RegExp(CLOSE_DUAL_FRAMING_PATTERN.source, "gi"), " ")
      .replace(/,?\s*exactly\s+(?:\d+|two|three)\s+figures?\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s,]+|[\s,]+$/g, "")
      .trim();
    if (
      composition.length > 72 ||
      !/\bmedium[\s-]?wide\b|\bwide\s+shot\b/i.test(composition)
    ) {
      composition = "medium wide shot, faces secondary";
    }
  }

  action = hardCapAtBoundary(action, 110);

  return sharpenExpressionAnchors({
    ...expression,
    action: action || expression.action,
    composition: composition || expression.composition,
  });
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
