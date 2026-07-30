/**
 * Shared Discovery provider-eval fixture — identical NarrativeInputBundle for all arms.
 * Do not change between providers (evaluation protocol).
 */

import { EXCERPT_BUNDLE_MIN_PROSE } from "@/lib/discovery/constants";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

export const EVAL_WORK_ID = "discovery-provider-eval-work";
export const EVAL_WORK_TITLE = "A Song of Ice and Fire — Prologue (eval fixture)";

/** Chinese AGoT-prologue-style excerpt (≥512). Ground truth known for rubric. */
export function buildZhPrologueNarrative(
  minLen = EXCERPT_BUNDLE_MIN_PROSE
): NarrativeInputBundle {
  const unit = [
    "三名守夜人——经验丰富的年轻老兵威尔、谨慎的老兵盖雷德，以及年轻骑士威玛·罗伊斯——",
    "正深入绝境长城以北的鬼影森林执行巡逻任务。",
    "他们发现一处被遗弃的野人营地，尸体却在转眼间消失。",
    "威玛坚持追查，却在林间遭遇异鬼；决斗后他倒下，又重新站起，已成尸鬼。",
    "威尔目睹这一切后逃回长城，心中只剩恐惧与誓言。",
  ].join("");
  let out = "";
  while (out.length < minLen) {
    out += unit + "\n";
  }
  const text = out.slice(0, Math.max(minLen, unit.length));
  return {
    excerpts: [{ text, orderIndex: 0 }],
    operatorSummary: null,
    inputMode: "excerpt_bundle",
    summaryAttested: false,
  };
}

/** Expected entities for provisional quality rubric (English canonical). */
export const FIXTURE_GROUND_TRUTH = {
  characters: ["Will", "Gared", "Waymar Royce", "Waymar"],
  locations: ["Wall", "Haunted Forest", "Ghost Forest", "Shadow Forest"],
  storyThemes: ["patrol", "wight", "Other", "White Walker", "Night"],
} as const;
