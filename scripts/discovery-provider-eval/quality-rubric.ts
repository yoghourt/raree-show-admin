/**
 * Provisional quality rubric against fixture ground truth.
 * Not a substitute for full human panel — labeled provisional in the report.
 */

import type { DiscoveryCandidate } from "@/lib/discovery/propose-types";
import { FIXTURE_GROUND_TRUTH } from "./fixture";

function clampScore(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n * 10) / 10));
}

function haystack(candidates: DiscoveryCandidate[]): string {
  return candidates
    .map((c) => `${c.displayName} ${c.summary} ${JSON.stringify(c.fields)}`)
    .join(" ")
    .toLowerCase();
}

function hitRate(needles: readonly string[], text: string): number {
  if (needles.length === 0) return 0;
  let hits = 0;
  for (const n of needles) {
    if (text.includes(n.toLowerCase())) hits += 1;
  }
  return hits / needles.length;
}

export function scoreProvisionalQuality(candidates: DiscoveryCandidate[]): {
  character: number;
  location: number;
  story: number;
  overall: number;
} {
  const chars = candidates.filter((c) => c.candidateType === "character");
  const locs = candidates.filter((c) => c.candidateType === "location");
  const stories = candidates.filter((c) => c.candidateType === "story");
  const scenes = candidates.filter((c) => c.candidateType === "scene");

  const charText = haystack(chars);
  // Will + Gared + Waymar family
  const charHits = [
    charText.includes("will"),
    charText.includes("gared"),
    charText.includes("waymar") || charText.includes("royce"),
  ].filter(Boolean).length;
  const character = clampScore(1 + (charHits / 3) * 4);

  const locText = haystack(locs);
  const locHits = [
    locText.includes("wall"),
    FIXTURE_GROUND_TRUTH.locations.some((n) =>
      locText.includes(n.toLowerCase().replace("wall", "").trim())
    ) ||
      locText.includes("forest") ||
      locText.includes("haunt"),
  ].filter(Boolean).length;
  const location = clampScore(1 + (locHits / 2) * 4);

  const storyText = haystack([...stories, ...scenes]);
  const themeRate = hitRate(FIXTURE_GROUND_TRUTH.storyThemes, storyText);
  const hasStory = stories.length > 0 ? 1 : 0;
  const hasScene = scenes.length > 0 ? 1 : 0;
  const story = clampScore(1 + (themeRate * 2 + hasStory + hasScene) * (4 / 4));

  const overall = clampScore((character + location + story) / 3);
  return { character, location, story, overall };
}
