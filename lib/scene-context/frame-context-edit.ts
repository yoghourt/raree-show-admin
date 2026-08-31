/**
 * IMPLEMENT-SCC-001-L4-A — Frame list reorder ↔ Scene Context index alignment.
 *
 * Appearance/location stay on Context; Frame sequence is story_images_v2 order.
 */

import { GENERIC_EXPRESSION_ROLE_PATTERN } from "@/lib/discovery/expression-capability-rules";
import type { RendererExpression } from "@/lib/discovery/visual-contract";
import type { ReadingFrame } from "@/lib/types";
import {
  findExistingByName,
  findLocationByEnvironmentCue,
  normalizeEntityName,
} from "@/lib/discovery/entity-catalog-match";
import type {
  SceneContextAppearance,
  SceneContextRecord,
} from "@/lib/scene-context/types";

const ROLE_TITLE_PREFIX =
  /^(king|queen|prince|princess|lord|lady|ser|emperor|empress)\s+/i;

/**
 * Match Expression.characters[].role (Rule 7: usually a Work character name)
 * to the Work Archive. Exact name first; else unique given-name / token subset.
 * Ambiguous cues (Jon → Jon Snow vs Jon Arryn) return undefined.
 */
export function findArchiveCharacterByRoleCue<
  T extends { name: string; tsid: string },
>(role: string, catalog: T[]): T | undefined {
  const exact = findExistingByName(role, catalog);
  if (exact) return exact;

  const stripped = normalizeEntityName(role).replace(ROLE_TITLE_PREFIX, "");
  if (!stripped) return undefined;
  const strippedExact = catalog.find(
    (item) => normalizeEntityName(item.name) === stripped
  );
  if (strippedExact) return strippedExact;

  const cueTokens = stripped.split(" ").filter((t) => t.length >= 2);
  if (!cueTokens.length) return undefined;

  if (cueTokens.length >= 2) {
    const subsetHits = catalog.filter((item) => {
      const nameTokens = new Set(normalizeEntityName(item.name).split(" "));
      return cueTokens.every((t) => nameTokens.has(t));
    });
    if (subsetHits.length === 1) return subsetHits[0];
  }

  const given = cueTokens[0]!;
  const givenHits = catalog.filter((item) => {
    const nameTokens = normalizeEntityName(item.name).split(" ");
    return nameTokens[0] === given || nameTokens.includes(given);
  });
  if (givenHits.length === 1) return givenHits[0];
  return undefined;
}

/**
 * Replace-frame 出场人物 from Expression.characters.
 * Generic extras (man/woman/…) are skipped; unmatched named roles are omitted
 * so the picker only shows Archive-backed appearances.
 */
export function appearancesFromExpressionCharacters(
  characters: RendererExpression["characters"],
  archive: Array<{ tsid: string; name: string }>
): SceneContextAppearance[] {
  const out: SceneContextAppearance[] = [];
  const seen = new Set<string>();
  for (const ch of characters) {
    const role = ch.role.trim();
    if (!role || GENERIC_EXPRESSION_ROLE_PATTERN.test(role)) continue;
    const hit = findArchiveCharacterByRoleCue(role, archive);
    if (!hit || seen.has(hit.tsid)) continue;
    seen.add(hit.tsid);
    out.push({
      role: "character",
      name: hit.name,
      archiveTsid: hit.tsid,
      ...(ch.visual.trim() ? { visual: ch.visual.trim() } : {}),
    });
  }
  return out;
}

/** Ensure Context exists, then replace that frame's appearance from Expression. */
export function syncFrameContextAppearanceFromExpression(params: {
  workId: string;
  readingRouteTsid: string;
  frameIndex: number;
  frame: ReadingFrame;
  contexts: SceneContextRecord[];
  routeTitle: string;
  chapter_number: number;
  chapter_title: string | null;
  expression: RendererExpression;
  archiveCharacters: Array<{ tsid: string; name: string }>;
  now?: string;
}): SceneContextRecord[] {
  const now = params.now ?? new Date().toISOString();
  const withContext = ensureContextForFrame({
    workId: params.workId,
    readingRouteTsid: params.readingRouteTsid,
    frameIndex: params.frameIndex,
    frame: params.frame,
    contexts: params.contexts,
    routeTitle: params.routeTitle,
    chapter_number: params.chapter_number,
    chapter_title: params.chapter_title,
    now,
  });
  const ctx = contextAtFrameIndex(withContext, params.frameIndex);
  if (!ctx) return params.contexts;
  return upsertContextById(withContext, {
    ...ctx,
    characterAppearanceContext: appearancesFromExpressionCharacters(
      params.expression.characters,
      params.archiveCharacters
    ),
    updatedAt: now,
  });
}

export function contextAtFrameIndex(
  contexts: SceneContextRecord[],
  frameIndex: number
): SceneContextRecord | undefined {
  return contexts.find((c) => c.projectsToFrameIndex === frameIndex);
}

/** Swap two frames and remap Context projectsToFrameIndex. */
export function swapFramesWithContexts(
  frames: ReadingFrame[],
  contexts: SceneContextRecord[],
  indexA: number,
  indexB: number
): { frames: ReadingFrame[]; contexts: SceneContextRecord[] } {
  if (
    indexA === indexB ||
    indexA < 0 ||
    indexB < 0 ||
    indexA >= frames.length ||
    indexB >= frames.length
  ) {
    return { frames, contexts };
  }
  const nextFrames = [...frames];
  [nextFrames[indexA], nextFrames[indexB]] = [
    nextFrames[indexB]!,
    nextFrames[indexA]!,
  ];
  const nextContexts = contexts.map((c) => {
    let idx = c.projectsToFrameIndex;
    if (idx === indexA) idx = indexB;
    else if (idx === indexB) idx = indexA;
    return idx === c.projectsToFrameIndex
      ? c
      : { ...c, projectsToFrameIndex: idx, updatedAt: new Date().toISOString() };
  });
  return { frames: nextFrames, contexts: nextContexts };
}

/** Remove frame at index; drop Contexts at that index; decrement higher indices. */
export function removeFrameWithContexts(
  frames: ReadingFrame[],
  contexts: SceneContextRecord[],
  index: number
): { frames: ReadingFrame[]; contexts: SceneContextRecord[] } {
  if (index < 0 || index >= frames.length) {
    return { frames, contexts };
  }
  const nextFrames = frames.filter((_, i) => i !== index);
  const nextContexts = contexts
    .filter((c) => c.projectsToFrameIndex !== index)
    .map((c) =>
      c.projectsToFrameIndex > index
        ? {
            ...c,
            projectsToFrameIndex: c.projectsToFrameIndex - 1,
            updatedAt: new Date().toISOString(),
          }
        : c
    );
  return { frames: nextFrames, contexts: nextContexts };
}

export function upsertContextById(
  contexts: SceneContextRecord[],
  next: SceneContextRecord
): SceneContextRecord[] {
  const existing = contexts.find((c) => c.contextId === next.contextId);
  if (!existing) return [...contexts, next];
  return contexts.map((c) =>
    c.contextId === next.contextId
      ? { ...next, createdAt: c.createdAt, updatedAt: next.updatedAt }
      : c
  );
}

/** Admin-created minimal Context for a frame when none exists. */
export function ensureContextForFrame(params: {
  workId: string;
  readingRouteTsid: string;
  frameIndex: number;
  frame: ReadingFrame;
  contexts: SceneContextRecord[];
  routeTitle: string;
  chapter_number: number;
  chapter_title: string | null;
  now?: string;
}): SceneContextRecord[] {
  const existing = contextAtFrameIndex(params.contexts, params.frameIndex);
  if (existing) return params.contexts;

  const now = params.now ?? new Date().toISOString();
  const caption = params.frame.caption.trim();
  const title = caption || `画面 ${params.frameIndex + 1}`;
  const editorialId = `admin_${params.readingRouteTsid}_${params.frameIndex}_${now}`;
  const record: SceneContextRecord = {
    contextId: `ctx_${editorialId}`,
    workId: params.workId,
    readingRouteTsid: params.readingRouteTsid,
    storyDeliveryHint: {
      parentStorySourceReviewId: "",
      parentStoryTitle: params.routeTitle.trim(),
    },
    editorialAssociation: {
      editorialSceneSourceReviewId: editorialId,
      associationKind: "editorial_scene_to_scene_context",
    },
    narrativeMoment: {
      title,
      summary: caption || null,
      chapter_number: params.chapter_number,
      chapter_title: params.chapter_title,
    },
    characterAppearanceContext: [],
    locationContext: { environmentFromExpression: "" },
    creationFacingVisualExpression: null,
    readerFacingNarrativeContext: { beatSummary: caption || title },
    projectsToFrameIndex: params.frameIndex,
    createdAt: now,
    updatedAt: now,
  };
  return [...params.contexts, record];
}

/** Patch Context appearance from Archive character tsids (ownership stays on Context). */
export function appearancesFromCharacterTsids(
  tsids: string[],
  characters: Array<{ tsid: string; name: string }>
): SceneContextAppearance[] {
  const out: SceneContextAppearance[] = [];
  for (const tsid of tsids) {
    const hit = characters.find((c) => c.tsid === tsid);
    if (!hit) continue;
    out.push({
      role: "character",
      name: hit.name,
      archiveTsid: hit.tsid,
    });
  }
  return out;
}

/**
 * Fill missing archiveTsid / archiveName from Work Archive by name cues.
 * Used when associate wrote name-only appearance (Role 7 mismatch debt) so
 * FrameContextDrawer pickers are not empty after write.
 * Returns null when nothing changes.
 */
export function enrichContextArchiveRefsFromWork(
  context: SceneContextRecord,
  archive: {
    characters: Array<{ tsid: string; name: string }>;
    locations: Array<{ tsid: string; name: string }>;
  }
): SceneContextRecord | null {
  let changed = false;

  const characterAppearanceContext = context.characterAppearanceContext.map(
    (a) => {
      if (a.archiveTsid?.trim()) return a;
      const cue = a.name?.trim() || a.role?.trim() || "";
      if (!cue) return a;
      const hit = findExistingByName(cue, archive.characters);
      if (!hit) return a;
      changed = true;
      return {
        ...a,
        name: a.name?.trim() || hit.name,
        archiveTsid: hit.tsid,
      };
    }
  );

  let locationContext = context.locationContext;
  if (!locationContext.archiveTsid?.trim()) {
    const cue =
      locationContext.archiveName?.trim() ||
      locationContext.environmentFromExpression.trim();
    if (cue) {
      const hit = findLocationByEnvironmentCue(cue, archive.locations);
      if (hit) {
        changed = true;
        locationContext = {
          ...locationContext,
          archiveTsid: hit.tsid,
          archiveName: hit.name,
        };
      }
    }
  }

  if (!changed) return null;
  return {
    ...context,
    characterAppearanceContext,
    locationContext,
    updatedAt: new Date().toISOString(),
  };
}

export function rewriteContextsReadingRouteTsid(
  contexts: SceneContextRecord[],
  readingRouteTsid: string
): SceneContextRecord[] {
  return contexts.map((c) =>
    c.readingRouteTsid === readingRouteTsid
      ? c
      : { ...c, readingRouteTsid, updatedAt: new Date().toISOString() }
  );
}
