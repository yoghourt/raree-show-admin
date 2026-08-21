/**
 * Reading Frame Narrative contract (RFN-001 + Discovery draft grant).
 *
 * Runtime authority: story_images_v2[].caption.
 * Discovery Scene.summary is the Human-confirmable DRAFT of that caption.
 * Story.summary is never Reader authority.
 */

import type { ReadingFrame } from "@/lib/types";

/** Confirmed Scene staging → caption draft (summary, else title). Not Story.summary. */
export function frameNarrativeDraftFromStaging(staging: {
  summary?: string | null;
  title?: string | null;
}): string {
  const summary = staging.summary?.trim() ?? "";
  if (summary) return summary;
  return staging.title?.trim() ?? "";
}

export function isReaderNarrativeFrame(frame: ReadingFrame): boolean {
  return Boolean(frame.caption?.trim());
}

export function readerNarrativeFrames(
  frames: ReadingFrame[] | null | undefined
): ReadingFrame[] {
  return (frames ?? []).filter(isReaderNarrativeFrame);
}

/** A Story/Route is eligible for Reader consumption iff ≥1 Frame Narrative exists. */
export function isReadingNarrativelyComplete(
  frames: ReadingFrame[] | null | undefined
): boolean {
  return readerNarrativeFrames(frames).length >= 1;
}

/**
 * Scene projection Frame slot.
 * - New slot: confirmed Frame Narrative draft (Human already accepted/edited it).
 * - Existing slot: preserve url + caption — never overwrite Human edits.
 */
export function projectFrameSlot(
  existing?: ReadingFrame | null,
  draftCaption?: string
): ReadingFrame {
  if (existing) {
    return {
      url: typeof existing.url === "string" ? existing.url : "",
      caption: typeof existing.caption === "string" ? existing.caption : "",
    };
  }
  return {
    url: "",
    caption: typeof draftCaption === "string" ? draftCaption : "",
  };
}
