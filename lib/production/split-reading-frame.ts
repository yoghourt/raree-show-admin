/**
 * Production-time split of a multi-event Reading Frame caption
 * into N single-beat frames (Human confirms). Discovery lock is not required.
 */

import { draftSceneBeatsFromSummary } from "@/lib/discovery/split-scene-beats";
import { contentTokens } from "@/lib/discovery/granularity-gate/text";
import type { FrameProvenanceEntry } from "@/lib/rollout/scenes-server";
import type { SceneContextRecord } from "@/lib/scene-context/types";
import type { ReadingFrame } from "@/lib/types";

export type ProductionBeatDraft = {
  summary: string;
};

/**
 * Prefer sentence boundaries; if the caption is one long causal sentence,
 * split on prompting / while / then so Human starts with more than one row.
 */
export function draftProductionBeatsFromCaption(
  caption: string
): ProductionBeatDraft[] {
  const fromSentences = draftSceneBeatsFromSummary(caption).map((d) => ({
    summary: d.summary,
  }));
  if (fromSentences.length >= 2) return fromSentences;

  const parts = caption
    .split(/\s*(?:,\s*prompting\s+|,?\s+while\s+|,\s*then\s+|;)\s*/i)
    .map((s) => s.trim())
    .filter((s) => contentTokens(s).length >= 4);
  if (parts.length >= 2) {
    return parts.map((summary) => ({ summary }));
  }
  return fromSentences;
}

export function spliceFramesAtIndex(
  frames: ReadingFrame[],
  frameIndex: number,
  beats: ProductionBeatDraft[]
): ReadingFrame[] {
  if (frameIndex < 0 || frameIndex >= frames.length) {
    throw new Error(`帧索引越界：${frameIndex}（共 ${frames.length} 帧）`);
  }
  const cleaned = beats
    .map((b) => ({ url: "", caption: b.summary.trim() }))
    .filter((b) => b.caption.length > 0);
  if (cleaned.length < 2) {
    throw new Error("至少两条非空 beat");
  }
  return [
    ...frames.slice(0, frameIndex),
    ...cleaned,
    ...frames.slice(frameIndex + 1),
  ];
}

/** Later frames shift by insertedCount - 1. The split index is dropped. */
export function shiftIndexAfterSplit(
  index: number,
  splitAt: number,
  insertedCount: number
): number | null {
  if (index < splitAt) return index;
  if (index === splitAt) return null;
  return index + (insertedCount - 1);
}

export function reindexProvenanceAfterSplit(
  entries: FrameProvenanceEntry[],
  splitAt: number,
  insertedCount: number
): FrameProvenanceEntry[] {
  const out: FrameProvenanceEntry[] = [];
  for (const entry of entries) {
    const nextIndex = shiftIndexAfterSplit(
      entry.frameIndex,
      splitAt,
      insertedCount
    );
    if (nextIndex == null) continue;
    out.push({ ...entry, frameIndex: nextIndex });
  }
  return out;
}

export function reindexContextsAfterSplit(
  contexts: SceneContextRecord[],
  splitAt: number,
  insertedCount: number
): SceneContextRecord[] {
  const out: SceneContextRecord[] = [];
  for (const ctx of contexts) {
    const nextIndex = shiftIndexAfterSplit(
      ctx.projectsToFrameIndex,
      splitAt,
      insertedCount
    );
    if (nextIndex == null) continue;
    out.push({ ...ctx, projectsToFrameIndex: nextIndex });
  }
  return out;
}
