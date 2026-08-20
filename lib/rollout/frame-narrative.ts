/**
 * IMPLEMENT-RFN-001 — Reading Frame Narrative contract.
 *
 * caption = Frame Narrative = Reader text authority.
 * Scene.summary / Story.summary / Discovery MUST NOT fill or replace it.
 */

import type { ReadingFrame } from "@/lib/types";

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
 * - New slot: empty Frame Narrative (Human authors caption later).
 * - Existing slot: preserve url + caption — never copy Scene.summary, never overwrite.
 */
export function projectFrameSlot(
  existing?: ReadingFrame | null
): ReadingFrame {
  if (existing) {
    return {
      url: typeof existing.url === "string" ? existing.url : "",
      caption: typeof existing.caption === "string" ? existing.caption : "",
    };
  }
  return { url: "", caption: "" };
}
