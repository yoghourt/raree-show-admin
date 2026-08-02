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
  /** Stable clothing / silhouette cues */
  costumeCues: string[];
  /** Iconic props / symbols (stable, not one-off scene props invented at render) */
  propCues: string[];
};

/** Cue budget when folding archive → Expression (spike + Local minimality). */
export const CHARACTER_ARCHIVE_CUE_BUDGET = {
  maxCostume: 1,
  maxProp: 1,
  /** costume + prop combined hard cap — keep Local prompts short */
  maxTotal: 2,
} as const;

export type ActiveCharacterCues = {
  costumeCues: string[];
  propCues: string[];
  /** Flattened list for Expression visual join (≤ maxTotal) */
  activeCues: string[];
};

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
  const costumeCues = normalizeCueList(rec.costumeCues, 6);
  const propCues = normalizeCueList(rec.propCues, 4);
  const visualSummary = trimCue(rec.visualSummary) ?? undefined;

  if (costumeCues.length === 0 && propCues.length === 0 && !visualSummary) {
    return { ok: true, value: null };
  }

  // Forbid camera / face-ref / temporary state tokens in archive
  const blob = JSON.stringify({ visualSummary, costumeCues, propCues }).toLowerCase();
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
      costumeCues,
      propCues,
    },
  };
}

/** Select budgeted cues for one Role in a scene Expression. */
export function selectActiveCharacterCues(
  archive: CharacterArchive | null | undefined,
  budget = CHARACTER_ARCHIVE_CUE_BUDGET
): ActiveCharacterCues {
  if (!archive) {
    return { costumeCues: [], propCues: [], activeCues: [] };
  }
  const costumeCues = archive.costumeCues.slice(0, budget.maxCostume);
  const propCues = archive.propCues.slice(0, budget.maxProp);
  // Prop first for Local salience (Ice / letter before cloak pile).
  const activeCues = [...propCues, ...costumeCues].slice(0, budget.maxTotal);
  return {
    costumeCues: activeCues.filter((c) => costumeCues.includes(c)),
    propCues: activeCues.filter((c) => propCues.includes(c)),
    activeCues,
  };
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

  const characters = expression.characters.map((ch) => {
    const archive =
      byName.get(roleKey(ch.role)) ??
      // allow "Ned Stark" role vs archive name match on last token / includes
      [...byName.entries()].find(
        ([key]) =>
          roleKey(ch.role).includes(key) || key.includes(roleKey(ch.role))
      )?.[1];

    if (!archive) return ch;

    const active = selectActiveCharacterCues(archive);
    if (active.activeCues.length === 0) return ch;

    const visualLower = ch.visual.toLowerCase();
    const missing = active.activeCues.filter(
      (cue) => !visualLower.includes(cue.toLowerCase().slice(0, 12))
    );
    if (missing.length === 0) return ch;

    const fragment = missing.join(", ");
    const visual = `${ch.visual.trim()}, ${fragment}`.trim();
    // Keep visual short for Local (long stacks → blank white)
    if (visual.length <= 80) return { ...ch, visual };
    const cut = visual.slice(0, 80);
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
  { "visualSummary"?: string, "costumeCues": string[], "propCues": string[] }

Archive = STABLE visual identity only (clothing style, iconic props, silhouette symbols).
FORBIDDEN in characterArchive: current scene action, emotion, camera, close-up, face-ref, InstantID, LoRA.
Author up to a few costumeCues / propCues; Discovery will budget when folding into scene Expression
(costume ≤1, prop ≤1, total ≤2). Prefer short English phrases.
`.trim();

/** Propose prompt block for scene type when Role archives are available. */
export const CHARACTER_ARCHIVE_SCENE_FOLD_RULES = `
Role Character Archive → Expression (SPEC-CHAR-001):
characters[].role MUST equal Role names listed below (e.g. "Eddard Stark") — never "woman"/"man".
When Role archives are listed below, select ONLY budgeted stable cues into
rendererExpression.characters[].visual (costume ≤1, prop ≤1, total ≤2 per figure).
Put the iconic PROP first in visual when present (e.g. "greatsword Ice, northern fur cloak").
Differentiate Roles — do NOT dress everyone in the same fur cloak.
Costume mutex: Catelyn = southern gown (no heavy fur mantle); Ned = northern fur/tunic (no gown).
Letter/scroll only on beats that need the message; godswood beats prefer Ice + weirwood face.
Dual-cast action MUST place both Roles left/right and say both fully visible.
Godswood environment MUST be: pale weirwood face carved in white bark, dark pool.
Letter beats: sealed parchment letter only — no sand/terrain map.
Do NOT dump full archive lists. Do NOT put archive into visualIntent.
Do NOT add portrait references. Face Safety Rule 6 still applies to scene_frame.
For dual-cast: composition short — medium-wide + faces secondary only.
Prefer static props (letter on table) over hand-to-hand transfer.
Renderer receives Expression only — never Character Archive objects.
`.trim();
