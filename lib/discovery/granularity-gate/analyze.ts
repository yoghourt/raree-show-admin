import {
  contentTokens,
  coverageRatio,
  extractHeadings,
  extractProperNames,
  splitSentences,
} from "./text";
import type {
  FrameNode,
  GranularityAnalysis,
  GranularityInput,
  StoryFrameBundle,
  StoryNode,
} from "./types";

export function bundleByStory(input: GranularityInput): StoryFrameBundle[] {
  return input.stories.map((story) => ({
    story,
    frames: input.frames.filter((f) => f.parentStoryId === story.id),
  }));
}

export function concatenatedCaptions(frames: FrameNode[]): string {
  return frames.map((f) => f.caption).join(" ");
}

/**
 * Heuristic progression-unit count for a Story.
 * Uses sentence count of the Story summary when the Story has been collapsed
 * to a single Frame. Multiple Frames already express multiple units.
 *
 * This is topology-adjacent, not plot understanding.
 */
export function estimateProgressionUnits(
  story: StoryNode,
  frames: FrameNode[]
): number {
  if (frames.length >= 2) return frames.length;
  const sentences = splitSentences(story.summary).filter(
    (s) => contentTokens(s).length >= 4
  );
  return Math.max(frames.length, sentences.length, 1);
}

export function sharedProperNames(stories: StoryNode[]): string[] {
  if (stories.length < 2) return [];
  const perStory = stories.map((s) =>
    extractProperNames(`${s.title} ${s.summary}`)
  );
  const canonical = (name: string) => name.toLowerCase();
  const counts = new Map<string, { display: string; stories: Set<number> }>();

  perStory.forEach((names, storyIdx) => {
    for (const name of names) {
      const key = canonical(name);
      const existing = [...counts.entries()].find(
        ([k]) => k === key || k.includes(key) || key.includes(k)
      );
      if (existing) {
        existing[1].stories.add(storyIdx);
        if (name.length < existing[1].display.length) {
          existing[1].display = name;
        }
        continue;
      }
      counts.set(key, { display: name, stories: new Set([storyIdx]) });
    }
  });

  return [...counts.values()]
    .filter((v) => v.stories.size >= 2)
    .map((v) => v.display)
    .sort();
}

export function analyzeGranularity(input: GranularityInput): GranularityAnalysis {
  const headings = extractHeadings(input.sourceText);
  const bundles = bundleByStory(input);
  const singletonStoryCount = bundles.filter((b) => b.frames.length === 1).length;
  const storyCount = input.stories.length;
  return {
    headingCount: headings.length,
    headings,
    storyCount,
    frameCount: input.frames.length,
    singletonStoryCount,
    singletonStoryRatio: storyCount === 0 ? 0 : singletonStoryCount / storyCount,
    headingStoryCountDelta: Math.abs(headings.length - storyCount),
    sharedProperNamesAcrossStories: sharedProperNames(input.stories),
    bundles: bundles.map((b) => ({
      storyId: b.story.id,
      title: b.story.title,
      frameCount: b.frames.length,
      estimatedProgressionUnits: estimateProgressionUnits(b.story, b.frames),
    })),
  };
}

export function captionCorpus(frames: FrameNode[]): string {
  return concatenatedCaptions(frames);
}

export function uncoveredTurns(
  story: StoryNode,
  frames: FrameNode[],
  labeledTurns?: string[]
): string[] {
  const hay = `${captionCorpus(frames)}`;
  const candidates =
    labeledTurns && labeledTurns.length > 0
      ? labeledTurns
      : splitSentences(story.summary).filter((s) => contentTokens(s).length >= 5);
  return candidates.filter((turn) => coverageRatio(turn, hay) < 0.45);
}
