/**
 * IMPLEMENT-SCC-001-L2-C — Propose → Scene Context candidate signals.
 *
 * Improves appearance/location cue quality on Editorial Scene candidates.
 * Does NOT create Story/Route membership or Runtime-authoritative Context.
 */

import { normalizeEntityName } from "@/lib/discovery/entity-catalog-match";
import type { SceneCandidateFields } from "@/lib/discovery/propose-types";
import type {
  RendererExpression,
  VisualIntent,
  VisualIntentCharacter,
} from "@/lib/discovery/visual-contract";

/** Prompt block for Scene Propose (Context-candidate framing). */
export const SCENE_CONTEXT_CANDIDATE_PROPOSE_RULES = `
Scene Context candidate signals (IMPLEMENT-SCC-001-L2-C / SPEC-SCC-001 §5):
- Appearance, location, and narrative beat cues on a Scene are Scene Context *candidates*
  for this Editorial Scene moment — NOT Story membership and NOT Reading Route fields.
- parentStoryCandidateId is Editorial hierarchy only (which Story the Scene belongs under).
  It MUST NOT imply that Work-batch characters/locations are owned by that Story.
- When rendererExpression.characters is non-empty, visualIntent.characters SHOULD list the
  same cast with role + name grounded in the narrative (and Work character candidates when listed).
- Prefer environment strings that match Work location names when the prose supports a named place.
- MUST NOT emit Story/Route ownership fields (characterIds, locationId) on any candidate.
- Landscape / empty-cast scenes remain valid (characters MAY be []).
- Discovery output remains proposals only — Human Accept + Projection establish Runtime Context.
`.trim();

export function assessSceneContextCandidateSignals(
  fields: Pick<SceneCandidateFields, "visualIntent" | "rendererExpression">
): string[] {
  const warnings: string[] = [];
  const expr = fields.rendererExpression;
  const intent = fields.visualIntent ?? null;
  const exprCast = expr?.characters ?? [];
  if (exprCast.length === 0) return warnings;

  const intentChars = intent?.characters ?? [];
  if (intentChars.length === 0) {
    warnings.push(
      "scene Context candidate: Expression cast present but visualIntent.characters missing — prefer named Intent cast for Context cues"
    );
    return warnings;
  }

  const unnamed = intentChars.filter((c) => !c.name?.trim());
  if (unnamed.length > 0) {
    warnings.push(
      `scene Context candidate: ${unnamed.length} Intent cast item(s) lack name — prefer narrative names for Context appearance refs`
    );
  }

  const env = expr.environment?.trim() ?? "";
  if (!env) {
    warnings.push(
      "scene Context candidate: rendererExpression.environment empty — location context cue missing"
    );
  }

  return warnings;
}

function matchArchiveName(
  role: string,
  visual: string | undefined,
  archiveNames: string[]
): string | undefined {
  const visualKey = (visual ?? "").toLowerCase();
  for (const name of archiveNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    if (visualKey.includes(trimmed.toLowerCase())) return trimmed;
  }
  const roleKey = normalizeEntityName(role);
  return archiveNames.find((n) => normalizeEntityName(n) === roleKey);
}

/**
 * Additive normalize: seed Intent cast from Expression roles; fill names from
 * Work character candidate names when grounded in Expression.visual or role match.
 * Never invents Story characterIds / locationId.
 */
export function normalizeSceneContextCandidateSignals(
  fields: SceneCandidateFields,
  characterCandidateNames: string[] = []
): SceneCandidateFields {
  const expr = fields.rendererExpression;
  const archiveNames = characterCandidateNames
    .map((n) => n.trim())
    .filter(Boolean);

  let intent: VisualIntent | null | undefined = fields.visualIntent
    ? { ...fields.visualIntent }
    : null;

  const exprCast = expr.characters ?? [];
  let intentChars: VisualIntentCharacter[] = [
    ...(intent?.characters ?? []),
  ];

  if (exprCast.length > 0 && intentChars.length === 0) {
    intentChars = exprCast.map((c) => {
      const role = c.role.trim();
      const matched = matchArchiveName(role, c.visual, archiveNames);
      return matched ? { role, name: matched } : { role };
    });
  } else if (intentChars.length > 0) {
    intentChars = intentChars.map((ic) => {
      if (ic.name?.trim()) {
        return { role: ic.role, name: ic.name.trim() };
      }
      const exprPeer = exprCast.find(
        (ec) =>
          normalizeEntityName(ec.role) === normalizeEntityName(ic.role)
      );
      const matched = matchArchiveName(
        ic.role,
        exprPeer?.visual,
        archiveNames
      );
      return matched ? { role: ic.role, name: matched } : { role: ic.role };
    });
  }

  if (intentChars.length > 0) {
    intent = {
      ...(intent ?? {}),
      characters: intentChars,
    };
  }

  return {
    ...fields,
    ...(intent ? { visualIntent: intent } : {}),
    rendererExpression: expr as RendererExpression,
  };
}
