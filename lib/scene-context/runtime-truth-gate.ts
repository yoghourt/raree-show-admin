/**
 * IMPLEMENT-SCC-001-S1 — Runtime Truth Gate (acceptance evidence).
 * L3-C: Route membership columns dropped — gate no longer compares Route cast fields.
 */

import type { ReadingFrame } from "@/lib/types";

import type { SceneContextRecord } from "@/lib/scene-context/types";

export type RuntimeTruthGateResult = {
  ok: boolean;
  failures: string[];
};

/**
 * Prove Context / Frame / Route ownership separation for a projected slice.
 */
export function assertRuntimeTruthGate(params: {
  context: SceneContextRecord;
  frame: ReadingFrame;
}): RuntimeTruthGateResult {
  const failures: string[] = [];
  const { context, frame } = params;

  if (!context.narrativeMoment.title.trim()) {
    failures.push("context_missing:narrativeMoment");
  }
  if (!context.readerFacingNarrativeContext.beatSummary.trim()) {
    failures.push("context_missing:readerFacingNarrativeContext");
  }
  if (
    context.characterAppearanceContext.length === 0 &&
    !(context.creationFacingVisualExpression?.characters?.length ?? 0)
  ) {
    // Appearance may be empty for environment-only beats — allow, but location/env should exist
    if (!context.locationContext.environmentFromExpression.trim()) {
      failures.push("context_missing:appearance_or_location");
    }
  }

  const frameKeys = Object.keys(frame).sort();
  if (
    frameKeys.length !== 2 ||
    frameKeys[0] !== "caption" ||
    frameKeys[1] !== "url"
  ) {
    failures.push("frame_not_representation_only");
  }

  if ("characterIds" in (frame as object) || "locationId" in (frame as object)) {
    failures.push("frame_owns_archive_fields");
  }

  if (
    context.editorialAssociation.editorialSceneSourceReviewId ===
    context.contextId
  ) {
    failures.push("identity_collapse:editorial_scene_eq_context");
  }
  if (context.contextId === params.context.readingRouteTsid) {
    failures.push("identity_collapse:context_eq_route");
  }
  if (
    context.contextId ===
    context.storyDeliveryHint.parentStorySourceReviewId
  ) {
    failures.push("identity_collapse:context_eq_story");
  }

  return { ok: failures.length === 0, failures };
}
