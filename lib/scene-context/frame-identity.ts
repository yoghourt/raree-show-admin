import type { FrameProvenanceEntry } from "@/lib/rollout/scenes-server";

export type ProvenanceRef = {
  sourceReviewId: string;
  frameIndex: number;
};

export function swapIndexMap(
  indexA: number,
  indexB: number
): (frameIndex: number) => number | null {
  return (frameIndex: number) => {
    if (frameIndex === indexA) return indexB;
    if (frameIndex === indexB) return indexA;
    return frameIndex;
  };
}

export function removeIndexMap(
  removed: number
): (frameIndex: number) => number | null {
  return (frameIndex: number) => {
    if (frameIndex === removed) return null;
    if (frameIndex > removed) return frameIndex - 1;
    return frameIndex;
  };
}

/** Keep creator fields. Drop entries whose index maps to null. Order by the new index. */
export function remapProvenance<T extends { frameIndex: number }>(
  entries: T[],
  mapIndex: (frameIndex: number) => number | null
): T[] {
  const next: T[] = [];
  for (const entry of entries) {
    const frameIndex = mapIndex(entry.frameIndex);
    if (frameIndex == null) continue;
    next.push({ ...entry, frameIndex });
  }
  next.sort((a, b) => a.frameIndex - b.frameIndex);
  return next;
}

export function isPositionalBijection(
  frameCount: number,
  entries: Array<{ frameIndex: number; sourceReviewId: string }>
): boolean {
  if (entries.length !== frameCount) return false;
  const seen = new Set<string>();
  for (let index = 0; index < frameCount; index += 1) {
    const entry = entries[index];
    if (!entry || entry.frameIndex !== index) return false;
    const id = entry.sourceReviewId.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

export function provenanceFromIdentity(
  identity: Array<string | null>,
  expected: FrameProvenanceEntry[]
): FrameProvenanceEntry[] {
  const byId = new Map(expected.map((entry) => [entry.sourceReviewId, entry]));
  return identity.map((rawId, frameIndex) => {
    const id = rawId?.trim() ?? "";
    if (!id) {
      return { sourceReviewId: "", frameIndex };
    }
    const previous = byId.get(id);
    if (!previous) {
      throw new Error("frame_structure_invariant");
    }
    return { ...previous, sourceReviewId: id, frameIndex };
  });
}
