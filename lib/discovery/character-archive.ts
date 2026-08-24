/**
 * SPEC-CHAR-001 — Role Character Archive (MVP)
 *
 * Character Archive belongs to Role (Discovery character candidate).
 * Discovery selects budgeted cues into Renderer Expression.
 * Renderer MUST NOT consume Character Archive directly.
 */

export type CharacterArchive = {
  /** Stable visual thesis — narrative meaning, not scene action */
  visualSummary?: string;
  /** Tier 1 — high-pointing identity (body marks, named weapons). */
  identityCues?: string[];
  /** Tier 2 — clothing / silhouette cues */
  costumeCues: string[];
  /** Narrative props (weapons travel; documents only when the beat names them) */
  propCues: string[];
};

/** Cue budget when folding archive → Expression. */
export const CHARACTER_ARCHIVE_CUE_BUDGET = {
  maxIdentity: 3,
  maxCostume: 1,
  maxProp: 1,
  /** identity + costume + prop hard cap */
  maxTotal: 4,
} as const;

export type ActiveCharacterCues = {
  identityCues: string[];
  costumeCues: string[];
  propCues: string[];
  /** Flattened list for Expression visual join (≤ maxTotal) */
  activeCues: string[];
};

const SITUATIONAL_DOCUMENT_PATTERN =
  /\b(letter|scroll|parchment|maps?|message)\b/i;
const STANDING_IDENTITY_PROP_PATTERN =
  /\b(blade|glaive|spear|halberd|greatsword|sword|bow|staff|tablet|helm|crown)\b/i;

function trimCue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().replace(/\s+/g, " ");
  if (!t || t.length > 80) return null;
  return t;
}

function normalizeCueList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const cue = trimCue(item);
    if (!cue) continue;
    const key = cue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cue);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Parse Role Character Archive from propose/JSON.
 * Empty costume+prop → null (omit). Invalid shape → errors.
 */
export function parseCharacterArchive(raw: unknown):
  | { ok: true; value: CharacterArchive | null }
  | { ok: false; errors: string[] } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["characterArchive must be an object"] };
  }
  const rec = raw as Record<string, unknown>;

  // Authored lists may be longer; store up to a reasonable authoring cap.
  const identityCues = normalizeCueList(rec.identityCues, 6);
  const costumeCues = normalizeCueList(rec.costumeCues, 6);
  const propCues = normalizeCueList(rec.propCues, 4);
  const visualSummary = trimCue(rec.visualSummary) ?? undefined;

  if (
    costumeCues.length === 0 &&
    propCues.length === 0 &&
    identityCues.length === 0 &&
    !visualSummary
  ) {
    return { ok: true, value: null };
  }

  // Forbid camera / face-ref / temporary state tokens in archive
  const blob = JSON.stringify({
    visualSummary,
    identityCues,
    costumeCues,
    propCues,
  }).toLowerCase();
  if (
    /\b(close-?up|facing the camera|instantid|ip-?adapter|lora|reference image|ref_images)\b/i.test(
      blob
    )
  ) {
    return {
      ok: false,
      errors: [
        "characterArchive must not include camera, face-ref, or identity-transfer cues",
      ],
    };
  }

  return {
    ok: true,
    value: {
      ...(visualSummary ? { visualSummary } : {}),
      ...(identityCues.length ? { identityCues } : {}),
      costumeCues,
      propCues,
    },
  };
}

/** Select budgeted cues for one Role in a scene Expression. */
export function selectActiveCharacterCues(
  archive: CharacterArchive | null | undefined,
  budget = CHARACTER_ARCHIVE_CUE_BUDGET,
  sceneBlob = ""
): ActiveCharacterCues {
  if (!archive) {
    return { identityCues: [], costumeCues: [], propCues: [], activeCues: [] };
  }
  const identityCues = (archive.identityCues ?? []).slice(0, budget.maxIdentity);
  const costumeCues = archive.costumeCues.slice(0, budget.maxCostume);
  const propCues = archive.propCues
    .slice(0, budget.maxProp)
    .filter((prop) => shouldFoldPropCue(prop, sceneBlob));
  const activeCues = [...identityCues, ...propCues, ...costumeCues].slice(
    0,
    budget.maxTotal
  );
  return {
    identityCues: activeCues.filter((c) => identityCues.includes(c)),
    costumeCues: activeCues.filter((c) => costumeCues.includes(c)),
    propCues: activeCues.filter((c) => propCues.includes(c)),
    activeCues,
  };
}

function shouldFoldPropCue(prop: string, sceneBlob: string): boolean {
  if (!prop) return false;
  if (sceneBlob.toLowerCase().includes(prop.toLowerCase().slice(0, 12))) {
    return true;
  }
  if (SITUATIONAL_DOCUMENT_PATTERN.test(prop)) {
    return SITUATIONAL_DOCUMENT_PATTERN.test(sceneBlob);
  }
  return STANDING_IDENTITY_PROP_PATTERN.test(prop);
}

/**
 * Join active cues into a short visual string fragment.
 * Does not invent scene action or camera language.
 */
export function formatActiveCuesForVisual(active: ActiveCharacterCues): string {
  return active.activeCues.join(", ");
}

type ExpressionCharacter = { role: string; visual: string };
type ExpressionLike = {
  environment: string;
  characters: ExpressionCharacter[];
  action: string;
  composition: string;
  lighting?: string;
  styleHints?: string;
};

export type RoleArchiveRef = {
  /** Role display / fields.name */
  name: string;
  archive: CharacterArchive;
};

function roleKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Fold budgeted archive cues into Expression characters[].visual.
 * Matches by role string ≈ Role name (case-insensitive).
 * Skips cues already present in visual. Does not change action/composition.
 */
export function foldCharacterArchivesIntoExpression<T extends ExpressionLike>(
  expression: T,
  roles: RoleArchiveRef[]
): T {
  if (!expression.characters?.length || roles.length === 0) {
    return expression;
  }
  const byName = new Map(
    roles.map((r) => [roleKey(r.name), r.archive] as const)
  );

  const sceneBlob = [
    expression.environment,
    expression.action,
    expression.composition,
    ...expression.characters.map((c) => `${c.role} ${c.visual}`),
  ].join(" ");

  const characters = expression.characters.map((ch) => {
    const archive =
      byName.get(roleKey(ch.role)) ??
      [...byName.entries()].find(
        ([key]) =>
          roleKey(ch.role).includes(key) || key.includes(roleKey(ch.role))
      )?.[1];

    if (!archive) return ch;

    const active = selectActiveCharacterCues(archive, CHARACTER_ARCHIVE_CUE_BUDGET, sceneBlob);
    if (active.activeCues.length === 0) return ch;

    const visualLower = ch.visual.toLowerCase();
    const missing = active.activeCues.filter(
      (cue) => !visualLower.includes(cue.toLowerCase().slice(0, 12))
    );
    if (missing.length === 0) return ch;

    const fragment = missing.join(", ");
    const visual = `${ch.visual.trim()}, ${fragment}`.trim();
    if (visual.length <= 120) return { ...ch, visual };
    const cut = visual.slice(0, 120);
    const at = cut.lastIndexOf(",");
    const capped = (at > 40 ? cut.slice(0, at) : cut).trim();
    return { ...ch, visual: capped };
  });

  return { ...expression, characters };
}

/** Propose prompt block for character type (SPEC-CHAR-001). */
export const CHARACTER_ARCHIVE_PROPOSE_RULES = `
Role Character Archive (SPEC-CHAR-001 — optional on character candidates):
Character Archive belongs to Role (this character candidate). It is NOT an independent entity.
fields.characterArchive MAY be present:
  { "visualSummary"?: string, "identityCues"?: string[], "costumeCues": string[], "propCues": string[] }

Archive = STABLE visual identity only (body marks, iconic props, clothing, silhouette).
FORBIDDEN in characterArchive: current scene action, emotion, camera, close-up, face-ref, InstantID, LoRA.
identityCues = Tier 1 (face/body marks + named weapons). costumeCues = Tier 2 clothing.
Discovery budgets: identity ≤3, costume ≤1, prop ≤1, total ≤4. Prefer short English phrases.
Situational documents (letter/map/scroll) are props, not standing identity.
`.trim();

/** Propose prompt block for scene type when Role archives are available. */
export const CHARACTER_ARCHIVE_SCENE_FOLD_RULES = `
Role Character Archive → Expression (SPEC-CHAR-001):
characters[].role MUST equal Role names listed below — never "woman"/"man".
When Role archives are listed below, select budgeted stable cues into
rendererExpression.characters[].visual
(identity ≤3, costume ≤1, situational prop ≤1, total ≤4 per figure).
Tier 1 identity cues (body marks, named weapons) MUST appear in visual.
Differentiate Roles — do NOT dress every figure in the same costume class.
Situational documents (letter/map/scroll) only when this beat already names them.
Standing identity weapons travel with the Role across beats.
Dual-cast action MUST place both Roles left/right and say both fully visible.
Keep the authored location identity — do not substitute a different place.
Do NOT dump full archive lists. Do NOT put archive into visualIntent.
Do NOT add portrait references. Face Safety Rule 6 still applies to scene_frame.
For dual-cast: composition short — medium-wide + faces secondary only.
Prefer static named objects on a surface over hand-to-hand transfer.
Renderer receives Expression only — never Character Archive objects.
`.trim();
