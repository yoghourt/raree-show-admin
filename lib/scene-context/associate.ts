/**
 * IMPLEMENT-SCC-001-S1 / L2-A — Editorial Scene staging → Scene Context association.
 *
 * Appearance / location / narrative beat ownership lands on Scene Context.
 * Optional archive enrichment is Context-scoped (name match) — never Story Route membership.
 *
 * Discovery Rule 7: Expression.characters[].role is often the *display name*, while
 * Intent may use role="knight" + name="Ser Waymar Royce". Join must tolerate both.
 */

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  findExistingByName,
  findLocationByEnvironmentCue,
  normalizeEntityName,
} from "@/lib/discovery/entity-catalog-match";
import type {
  SceneContextAppearance,
  SceneContextLocation,
  SceneContextRecord,
} from "@/lib/scene-context/types";

export type SceneContextArchiveCatalog = {
  characters: Array<{ name: string; tsid: string }>;
  locations: Array<{ name: string; tsid: string }>;
};

function chapterNumber(value: number | string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 1;
}

function beatSummary(staging: AcceptedSceneCandidateStaging): string {
  const summary = staging.summary?.trim();
  if (summary) return summary;
  return staging.title.trim();
}

export function contextIdForEditorialScene(sourceReviewId: string): string {
  return `ctx_${sourceReviewId.trim()}`;
}

function namesEqual(a: string, b: string): boolean {
  const na = normalizeEntityName(a);
  const nb = normalizeEntityName(b);
  return Boolean(na) && na === nb;
}

/**
 * Align Intent character to Expression entry.
 * Prefer role===role; else Intent.name ≈ Expression.role (Rule 7 display-name roles).
 */
function findIntentCharacterForExpressionRole(
  intentCharacters:
    | Array<{ role: string; name?: string }>
    | undefined
    | null,
  expressionRole: string
): { role: string; name?: string } | undefined {
  if (!intentCharacters?.length) return undefined;
  const roleKey = expressionRole.trim();
  if (!roleKey) return undefined;

  const byRole = intentCharacters.find((ic) => namesEqual(ic.role, roleKey));
  if (byRole) return byRole;

  return intentCharacters.find((ic) => {
    const name = ic.name?.trim();
    return name ? namesEqual(name, roleKey) : false;
  });
}

function matchCharacterArchive(
  candidates: string[],
  archive?: SceneContextArchiveCatalog
): { name: string; tsid: string } | undefined {
  if (!archive?.characters.length) return undefined;
  for (const raw of candidates) {
    const name = raw.trim();
    if (!name) continue;
    const hit = findExistingByName(name, archive.characters);
    if (hit) return hit;
  }
  return undefined;
}

function buildAppearanceFromExpression(
  staging: AcceptedSceneCandidateStaging,
  archive?: SceneContextArchiveCatalog
): SceneContextAppearance[] {
  const intent = staging.visualIntent ?? null;
  const exprChars = staging.rendererExpression?.characters ?? [];

  if (exprChars.length > 0) {
    return exprChars.map((c) => {
      const intentChar = findIntentCharacterForExpressionRole(
        intent?.characters,
        c.role
      );
      const displayName =
        intentChar?.name?.trim() || c.role.trim() || undefined;
      const matched = matchCharacterArchive(
        [displayName ?? "", c.role, intentChar?.name ?? ""],
        archive
      );
      const name = matched?.name || displayName;
      return {
        role: c.role,
        ...(name ? { name } : {}),
        ...(c.visual ? { visual: c.visual } : {}),
        ...(matched ? { archiveTsid: matched.tsid } : {}),
      };
    });
  }

  // Expression cast empty — fall back to named Intent cast (same as aggregate preview).
  const intentChars = intent?.characters ?? [];
  return intentChars.flatMap((ic) => {
    const name = ic.name?.trim();
    if (!name) return [];
    const matched = matchCharacterArchive([name, ic.role], archive);
    return [
      {
        role: ic.role,
        name: matched?.name || name,
        ...(matched ? { archiveTsid: matched.tsid } : {}),
      },
    ];
  });
}

function buildLocationContext(
  staging: AcceptedSceneCandidateStaging,
  archive?: SceneContextArchiveCatalog
): SceneContextLocation {
  const environment = staging.rendererExpression?.environment || "";
  const locationContext: SceneContextLocation = {
    environmentFromExpression: environment,
  };
  if (!archive?.locations.length || !environment.trim()) {
    return locationContext;
  }

  const locMatch = findLocationByEnvironmentCue(
    environment,
    archive.locations
  );
  if (locMatch) {
    locationContext.archiveTsid = locMatch.tsid;
    locationContext.archiveName = locMatch.name;
  }
  return locationContext;
}

/**
 * Build Runtime-authoritative Scene Context from accepted Editorial Scene staging.
 * Human acceptance is assumed already complete (staging exists).
 *
 * L2-A: When `archive` is provided, match Expression/Intent names to Work Archive
 * for Context refs only — does not write Story/Route character_ids / location_id.
 */
export function associateStagingToSceneContext(
  staging: AcceptedSceneCandidateStaging,
  params: {
    readingRouteTsid: string;
    frameIndex: number;
    now?: string;
    archive?: SceneContextArchiveCatalog;
  }
): SceneContextRecord {
  const now = params.now ?? new Date().toISOString();
  const intent = staging.visualIntent ?? null;

  const appearance = buildAppearanceFromExpression(staging, params.archive);
  const locationContext = buildLocationContext(staging, params.archive);

  return {
    contextId: contextIdForEditorialScene(staging.sourceReviewId),
    workId: staging.workId,
    readingRouteTsid: params.readingRouteTsid,
    storyDeliveryHint: {
      parentStorySourceReviewId:
        staging.parentStorySourceReviewId?.trim() || "",
      parentStoryTitle: staging.parentStoryTitle?.trim() || "",
    },
    editorialAssociation: {
      editorialSceneSourceReviewId: staging.sourceReviewId,
      associationKind: "editorial_scene_to_scene_context",
    },
    narrativeMoment: {
      title: staging.title.trim(),
      summary: staging.summary?.trim() || null,
      chapter_number: chapterNumber(staging.chapter_number),
      chapter_title: staging.chapter_title?.trim() || null,
    },
    characterAppearanceContext: appearance,
    locationContext,
    creationFacingVisualExpression: staging.rendererExpression
      ? { ...staging.rendererExpression }
      : null,
    readerFacingNarrativeContext: {
      beatSummary: beatSummary(staging),
      ...(intent?.emotion ? { emotion: intent.emotion } : {}),
      ...(intent?.purpose ? { purpose: intent.purpose } : {}),
      relationship: intent?.relationship ?? null,
    },
    projectsToFrameIndex: params.frameIndex,
    createdAt: now,
    updatedAt: now,
    visualIntentAudit: intent,
  };
}

/** Upsert Context by editorial sourceReviewId. */
export function upsertSceneContext(
  contexts: SceneContextRecord[],
  next: SceneContextRecord
): SceneContextRecord[] {
  const key = next.editorialAssociation.editorialSceneSourceReviewId;
  const existing = contexts.find(
    (c) => c.editorialAssociation.editorialSceneSourceReviewId === key
  );
  if (!existing) return [...contexts, next];
  return contexts.map((c) =>
    c.editorialAssociation.editorialSceneSourceReviewId === key
      ? { ...next, createdAt: c.createdAt, updatedAt: next.updatedAt }
      : c
  );
}

export function removeSceneContextBySourceReviewId(
  contexts: SceneContextRecord[],
  sourceReviewId: string
): SceneContextRecord[] {
  const id = sourceReviewId.trim();
  return contexts.filter(
    (c) => c.editorialAssociation.editorialSceneSourceReviewId !== id
  );
}
