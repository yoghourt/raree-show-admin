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

Rule 6 — Face Safety (Creator scene_frame; NOT portrait):
Local scene frames often collapse small faces into uncanny / horror artifacts.
Goal: prevent immersion-breaking face presentation — NOT perfect faces or identity lock.
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

/** Few-shot for scene TYPE_EXAMPLES — minimal duel + face-safe (Rule 6). */
export const EXPRESSION_CAPABILITY_EXAMPLE: ExpressionLike = {
  environment: "snow clearing under moonlight",
  characters: [
    {
      role: "knight",
      visual: "armored knight in closed helmet holding sword",
    },
    {
      role: "white_walker",
      visual: "hooded ice warrior holding sword face hidden",
    },
  ],
  action: "two warriors facing each other with swords crossed at middle distance",
  composition: "wide shot two silhouettes facing each other",
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

/** Unambiguous unrestricted full-face scene requests — propose hard-gate. */
export const FULL_FACE_SCENE_PATTERN =
  /\b(close[\s-]?up|tight\s+face|face\s+fill(?:s|ing)?\s+frame|facing\s+the\s+camera|looking\s+at\s+the\s+camera|staring\s+at\s+the\s+camera|portrait\s+of\s+(?:the\s+)?(?:boy|girl|man|woman|face)|detailed\s+face|facial\s+close)\b/i;

const HIGH_RISK_SCENE_PATTERN =
  /\b(night|moonlight|moonlit|battlefield|battle\b|crowd|horde|army of|monster|creature|undead|white\s*walker|other\b|wight|helmet|heavy\s+armor|armou?red\s+host|blizzard|snowstorm|dark\s+forest|haunted)\b/i;

const SAFE_VISIBILITY_PATTERN =
  /\b(helmet|hood(?:ed)?|face\s+hidden|faces?\s+hidden|veil(?:ed)?|silhouette|from\s+behind|back\s+(?:view|turned)|facing\s+away|occiput|wide\s+shot|medium[\s-]?wide|reading\s+distance|middle\s+distance|faces?\s+secondary|profile|soft\s+shadow|face\s+in\s+(?:soft\s+)?shadow)\b/i;

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
