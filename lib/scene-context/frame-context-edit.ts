/**
 * IMPLEMENT-SCC-001-L4-A — Frame list reorder ↔ Scene Context index alignment.
 *
 * Appearance/location stay on Context; Frame sequence is story_images_v2 order.
 */

import type { ReadingFrame } from "@/lib/types";
import {
  findExistingByName,
  findLocationByEnvironmentCue,
} from "@/lib/discovery/entity-catalog-match";
import type {
  SceneContextAppearance,
  SceneContextRecord,
} from "@/lib/scene-context/types";

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
