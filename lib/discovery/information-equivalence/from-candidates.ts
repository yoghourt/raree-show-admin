import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
import type { SceneCandidateFields } from "@/lib/discovery/propose-types";

import type { IeFrame } from "./types";

function sceneCaption(candidate: DiscoveryCandidate): string {
  if (candidate.candidateType !== "scene") return "";
  const fields = candidate.fields as SceneCandidateFields;
  return (
    fields.summary?.trim() ||
    candidate.summary.trim() ||
    fields.title.trim()
  );
}

export function framesForStoryCandidate(
  storyCandidateId: string,
  candidates: DiscoveryCandidate[]
): IeFrame[] {
  return candidates
    .filter((c) => {
      if (c.candidateType !== "scene") return false;
      const fields = c.fields as SceneCandidateFields;
      return fields.parentStoryCandidateId === storyCandidateId;
    })
    .map((c) => ({
      id: c.candidateId,
      caption: sceneCaption(c),
    }));
}
