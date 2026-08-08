/**
 * IMPLEMENT-SCC-001-S1 — Scene Context runtime representation (semantic ownership).
 *
 * Persisted as scenes.scene_contexts_v1[] on the delivery Route host row.
 * Storage host ≠ ownership: Route remains delivery only (ADR-012 / SPEC-SCC-001).
 */

import type {
  RendererExpression,
  VisualIntent,
} from "@/lib/discovery/visual-contract";

export type SceneContextAppearance = {
  role: string;
  name?: string;
  visual?: string;
  /** Optional Work Character Archive ref — Archive identity remains Work-owned. */
  archiveTsid?: string;
};

export type SceneContextLocation = {
  environmentFromExpression: string;
  archiveTsid?: string;
  archiveName?: string;
};

export type SceneContextRecord = {
  contextId: string;
  workId: string;
  readingRouteTsid: string;
  storyDeliveryHint: {
    parentStorySourceReviewId: string;
    parentStoryTitle: string;
  };
  editorialAssociation: {
    editorialSceneSourceReviewId: string;
    associationKind: "editorial_scene_to_scene_context";
  };
  narrativeMoment: {
    title: string;
    summary: string | null;
    chapter_number: number;
    chapter_title: string | null;
  };
  characterAppearanceContext: SceneContextAppearance[];
  locationContext: SceneContextLocation;
  creationFacingVisualExpression: RendererExpression | null;
  readerFacingNarrativeContext: {
    beatSummary: string;
    emotion?: string;
    purpose?: string;
    relationship?: string | null;
  };
  /** Projection relation to Reading Frame index — not ownership transfer. */
  projectsToFrameIndex: number;
  createdAt: string;
  updatedAt: string;
  /** Audit companion — not Image Port input. */
  visualIntentAudit?: VisualIntent | null;
};
