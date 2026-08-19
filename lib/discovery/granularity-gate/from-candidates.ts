import type {
  DiscoveryCandidate,
  SceneCandidateFields,
  StoryCandidateFields,
} from "@/lib/discovery/propose-types";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

import { runGranularityGate } from "./gate";
import type {
  FrameNode,
  GranularityGateResult,
  GranularityInput,
  GranularityLabels,
  StoryNode,
} from "./types";

export function narrativeSourceText(narrative: NarrativeInputBundle): string {
  const excerpts = [...narrative.excerpts]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((e) => e.text.trim())
    .filter(Boolean);
  const summary = narrative.operatorSummary?.trim() ?? "";
  return [summary, ...excerpts].filter(Boolean).join("\n");
}

function storyNode(candidate: DiscoveryCandidate): StoryNode | null {
  if (candidate.candidateType !== "story") return null;
  const fields = candidate.fields as StoryCandidateFields;
  return {
    id: candidate.candidateId,
    title: fields.title?.trim() || candidate.displayName,
    summary: fields.summary?.trim() || candidate.summary,
  };
}

function frameNode(candidate: DiscoveryCandidate): FrameNode | null {
  if (candidate.candidateType !== "scene") return null;
  const fields = candidate.fields as SceneCandidateFields;
  const caption =
    fields.summary?.trim() || candidate.summary.trim() || fields.title.trim();
  return {
    id: candidate.candidateId,
    parentStoryId: fields.parentStoryCandidateId,
    title: fields.title?.trim() || candidate.displayName,
    caption,
  };
}

export function candidatesToGranularityInput(
  narrative: NarrativeInputBundle,
  candidates: DiscoveryCandidate[],
  labels?: GranularityLabels
): GranularityInput {
  const stories = candidates.flatMap((c) => {
    const n = storyNode(c);
    return n ? [n] : [];
  });
  const frames = candidates.flatMap((c) => {
    const n = frameNode(c);
    return n ? [n] : [];
  });
  return {
    sourceText: narrativeSourceText(narrative),
    stories,
    frames,
    ...(labels ? { labels } : {}),
  };
}

export function evaluateGranularityForCandidates(
  narrative: NarrativeInputBundle,
  candidates: DiscoveryCandidate[],
  labels?: GranularityLabels
): GranularityGateResult {
  return runGranularityGate(
    candidatesToGranularityInput(narrative, candidates, labels)
  );
}
