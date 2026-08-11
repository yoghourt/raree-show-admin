/**
 * IMPLEMENT-SCC-001-S1 / L2-A — Editorial Scene staging → Scene Context association.
 *
 * Appearance / location / narrative beat ownership lands on Scene Context.
 * Optional archive enrichment is Context-scoped (name match) — never Story Route membership.
 */

import type { AcceptedSceneCandidateStaging } from "@/lib/discovery/review-types";
import {
  findExistingByName,
  findLocationByEnvironmentCue,
} from "@/lib/discovery/entity-catalog-match";
import { MINIMAL_RENDERER_EXPRESSION } from "@/lib/discovery/visual-contract";

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
  const expr =
    staging.rendererExpression ??
    ({
      ...MINIMAL_RENDERER_EXPRESSION,
    } as typeof MINIMAL_RENDERER_EXPRESSION);

  const appearance: SceneContextAppearance[] = (expr.characters ?? []).map(
    (c) => {
      const intentChar = intent?.characters?.find(
        (ic) => ic.role.toLowerCase() === c.role.toLowerCase()
      );
      const name = intentChar?.name?.trim() || undefined;
      const matched =
        name && params.archive
          ? findExistingByName(name, params.archive.characters)
          : undefined;
      return {
        role: c.role,
        ...(name ? { name } : {}),
        ...(c.visual ? { visual: c.visual } : {}),
        ...(matched ? { archiveTsid: matched.tsid } : {}),
      };
    }
  );

  const environment = expr.environment || "";
  const locationContext: SceneContextLocation = {
    environmentFromExpression: environment,
  };
  if (params.archive?.locations.length && environment.trim()) {
    const locMatch = findLocationByEnvironmentCue(
      environment,
      params.archive.locations
    );
    if (locMatch) {
      locationContext.archiveTsid = locMatch.tsid;
      locationContext.archiveName = locMatch.name;
    }
  }

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
