/**
 * IMPLEMENT-SCC-001-S1 — parse / serialize scenes.scene_contexts_v1
 */

import {
  parseRendererExpression,
  parseVisualIntent,
} from "@/lib/discovery/visual-contract";

import type { SceneContextRecord } from "@/lib/scene-context/types";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function parseSceneContextsV1(raw: unknown): SceneContextRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: SceneContextRecord[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const contextId = asString(rec.contextId);
    const workId = asString(rec.workId);
    const readingRouteTsid = asString(rec.readingRouteTsid);
    const projectsToFrameIndex = asNumber(rec.projectsToFrameIndex);
    const createdAt = asString(rec.createdAt);
    const updatedAt = asString(rec.updatedAt);
    if (
      !contextId ||
      !workId ||
      !readingRouteTsid ||
      projectsToFrameIndex === undefined ||
      !createdAt ||
      !updatedAt
    ) {
      continue;
    }

    const editorial = rec.editorialAssociation;
    const storyHint = rec.storyDeliveryHint;
    const narrative = rec.narrativeMoment;
    const reader = rec.readerFacingNarrativeContext;
    const location = rec.locationContext;
    if (
      !editorial ||
      typeof editorial !== "object" ||
      !storyHint ||
      typeof storyHint !== "object" ||
      !narrative ||
      typeof narrative !== "object" ||
      !reader ||
      typeof reader !== "object" ||
      !location ||
      typeof location !== "object"
    ) {
      continue;
    }

    const ed = editorial as Record<string, unknown>;
    const sh = storyHint as Record<string, unknown>;
    const nm = narrative as Record<string, unknown>;
    const rf = reader as Record<string, unknown>;
    const loc = location as Record<string, unknown>;

    const editorialSceneSourceReviewId = asString(
      ed.editorialSceneSourceReviewId
    );
    const beatSummary = asString(rf.beatSummary);
    const title = asString(nm.title);
    const chapter_number = asNumber(nm.chapter_number);
    if (
      !editorialSceneSourceReviewId ||
      !beatSummary ||
      !title ||
      chapter_number === undefined
    ) {
      continue;
    }

    const appearancesRaw = Array.isArray(rec.characterAppearanceContext)
      ? rec.characterAppearanceContext
      : [];
    const characterAppearanceContext = appearancesRaw.flatMap((a) => {
      if (!a || typeof a !== "object") return [];
      const ar = a as Record<string, unknown>;
      const role = asString(ar.role);
      if (!role) return [];
      return [
        {
          role,
          ...(asString(ar.name) ? { name: asString(ar.name) } : {}),
          ...(asString(ar.visual) ? { visual: asString(ar.visual) } : {}),
          ...(asString(ar.archiveTsid)
            ? { archiveTsid: asString(ar.archiveTsid) }
            : {}),
        },
      ];
    });

    let creationFacingVisualExpression: SceneContextRecord["creationFacingVisualExpression"] =
      null;
    if (rec.creationFacingVisualExpression != null) {
      const parsed = parseRendererExpression(rec.creationFacingVisualExpression);
      if (parsed.ok) creationFacingVisualExpression = parsed.value;
    }

    let visualIntentAudit: SceneContextRecord["visualIntentAudit"];
    if ("visualIntentAudit" in rec) {
      const intent = parseVisualIntent(rec.visualIntentAudit);
      if (intent.ok) visualIntentAudit = intent.value;
    }

    out.push({
      contextId,
      workId,
      readingRouteTsid,
      storyDeliveryHint: {
        parentStorySourceReviewId:
          asString(sh.parentStorySourceReviewId) || "",
        parentStoryTitle: asString(sh.parentStoryTitle) || "",
      },
      editorialAssociation: {
        editorialSceneSourceReviewId,
        associationKind: "editorial_scene_to_scene_context",
      },
      narrativeMoment: {
        title,
        summary: asString(nm.summary) || null,
        chapter_number,
        chapter_title: asString(nm.chapter_title) || null,
      },
      characterAppearanceContext,
      locationContext: {
        environmentFromExpression:
          asString(loc.environmentFromExpression) || "",
        ...(asString(loc.archiveTsid)
          ? { archiveTsid: asString(loc.archiveTsid) }
          : {}),
        ...(asString(loc.archiveName)
          ? { archiveName: asString(loc.archiveName) }
          : {}),
      },
      creationFacingVisualExpression,
      readerFacingNarrativeContext: {
        beatSummary,
        ...(asString(rf.emotion) ? { emotion: asString(rf.emotion) } : {}),
        ...(asString(rf.purpose) ? { purpose: asString(rf.purpose) } : {}),
        relationship:
          rf.relationship === null
            ? null
            : asString(rf.relationship) ?? null,
      },
      projectsToFrameIndex,
      createdAt,
      updatedAt,
      ...(visualIntentAudit !== undefined
        ? { visualIntentAudit }
        : {}),
    });
  }

  return out;
}
