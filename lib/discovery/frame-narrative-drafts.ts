/**
 * Discovery Frame Narrative drafts — unpack a Story into Reader steps.
 * Not Work Canon. Not Runtime caption until Human Confirm.
 */

import { randomUUID } from "crypto";

import { MAX_CANDIDATES_PER_TYPE } from "@/lib/discovery/constants";
import {
  contentTokens,
  headingBlocksFromSource,
  splitSentences,
} from "@/lib/discovery/granularity-gate/text";
import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
import type { StoryCandidateFields } from "@/lib/discovery/propose-types";
import { MINIMAL_RENDERER_EXPRESSION } from "@/lib/discovery/visual-contract";

export type RequiredSceneStepBundle = {
  storyCandidateId: string;
  storyTitle: string;
  steps: string[];
};

export function clausesFromStorySummary(summary: string): string[] {
  const sentences = splitSentences(summary);
  const out: string[] = [];
  for (const sentence of sentences) {
    if (contentTokens(sentence).length < 4) continue;
    if (sentence.length < 160) {
      out.push(sentence);
      continue;
    }
    const parts = sentence
      .split(
        /\s*(?:;|—|–)\s*|\s+before\s+|, (?:and then|and|then) |，/i
      )
      .map((p) => p.trim())
      .filter((p) => contentTokens(p).length >= 4);
    if (parts.length >= 2) out.push(...parts);
    else out.push(sentence);
  }
  return out;
}

export function requiredSceneStepsFromStories(
  stories: DiscoveryCandidate[],
  sourceText: string
): RequiredSceneStepBundle[] {
  const storyRows = stories.filter((c) => c.candidateType === "story");
  const headingBlocks = headingBlocksFromSource(sourceText);
  const bundles: RequiredSceneStepBundle[] = storyRows.map((story) => {
    const fields = story.fields as StoryCandidateFields;
    const steps = clausesFromStorySummary(
      fields.summary?.trim() || story.summary
    );
    return {
      storyCandidateId: story.candidateId,
      storyTitle: fields.title?.trim() || story.displayName,
      steps: steps.length > 0 ? steps : [fields.summary || story.displayName],
    };
  });

  if (bundles.length === 1 && headingBlocks.length >= 2) {
    bundles[0] = {
      ...bundles[0]!,
      steps: headingBlocks.map((h) => h.title).slice(0, MAX_CANDIDATES_PER_TYPE),
    };
  }

  return bundles.map((b) => ({
    ...b,
    steps: b.steps.slice(0, MAX_CANDIDATES_PER_TYPE),
  }));
}

export function expectedSceneCount(bundles: RequiredSceneStepBundle[]): number {
  return bundles.reduce((n, b) => n + b.steps.length, 0);
}

/** If the model invents a parent id, keep the Scene instead of dropping the batch. */
export function resolveParentStoryCandidateId(
  rawParentId: string | undefined,
  stories: DiscoveryCandidate[],
  sceneTitle = "",
  sceneSummary = ""
): string | null {
  const ids = stories
    .filter((c) => c.candidateType === "story")
    .map((c) => c.candidateId);
  if (ids.length === 0) return null;
  const raw = rawParentId?.trim() ?? "";
  if (raw && ids.includes(raw)) return raw;
  if (ids.length === 1) return ids[0]!;

  const hay = `${sceneTitle} ${sceneSummary}`.toLowerCase();
  for (const story of stories) {
    if (story.candidateType !== "story") continue;
    const title = (
      (story.fields as StoryCandidateFields).title || story.displayName
    ).toLowerCase();
    if (title && hay.includes(title)) return story.candidateId;
  }
  return ids[0]!;
}

export function formatRequiredSceneStepsBlock(
  bundles: RequiredSceneStepBundle[]
): string {
  if (bundles.length === 0) return "";
  const lines = bundles.flatMap((b) => [
    `Story "${b.storyTitle}" (parentStoryCandidateId=${b.storyCandidateId}) — emit EXACTLY one Scene per step:`,
    ...b.steps.map((step, i) => `  ${i + 1}. ${step}`),
  ]);
  return `\nREQUIRED Reader steps (do not merge; do not skip):\n${lines.join("\n")}\n`;
}

/** Numbered Source outline already is the Reader-step list — do not wait on the LLM to split. */
export function canDraftScenesFromSourceHeadings(
  stories: DiscoveryCandidate[],
  sourceText: string
): boolean {
  const storyCount = stories.filter((c) => c.candidateType === "story").length;
  return storyCount === 1 && headingBlocksFromSource(sourceText).length >= 2;
}

export function sceneCandidatesFromRequiredSteps(params: {
  workId: string;
  bundles: RequiredSceneStepBundle[];
  sourceText: string;
}): DiscoveryCandidate[] {
  const blocks = headingBlocksFromSource(params.sourceText);
  const out: DiscoveryCandidate[] = [];
  let order = 0;
  for (const bundle of params.bundles) {
    for (const step of bundle.steps) {
      if (out.length >= MAX_CANDIDATES_PER_TYPE) break;
      order += 1;
      const block = blocks.find((b) => b.title === step);
      const summary = (block?.body || step).trim();
      const title = step.trim();
      if (!title || !summary) continue;
      out.push({
        candidateId: randomUUID(),
        candidateType: "scene",
        workId: params.workId,
        displayName: title,
        summary,
        confidence: "green",
        evidence: [
          {
            sourceLabel: "Source",
            excerpt: summary.slice(0, 240),
          },
        ],
        fields: {
          parentStoryCandidateId: bundle.storyCandidateId,
          chapter_number: block?.index ?? order,
          title,
          summary,
          rendererExpression: { ...MINIMAL_RENDERER_EXPRESSION },
        },
      });
    }
  }
  return out;
}
