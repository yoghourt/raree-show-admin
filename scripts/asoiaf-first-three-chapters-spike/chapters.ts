/**
 * Copyright-safe paraphrases for AGoT opening (not verbatim book text).
 * Used only as NarrativeInputBundle for Discovery propose.
 */

import { EXCERPT_BUNDLE_MIN_PROSE } from "@/lib/discovery/constants";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

export const WORK_ID = "asoiaf-first-three-chapters-spike";
export const WORK_TITLE =
  "A Song of Ice and Fire — First Three Chapters (internal spike)";

export type ChapterSpec = {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  /** Short English label for findings */
  label: string;
  /** Chinese paraphrase units (will be padded to min prose length) */
  units: string[];
};

/**
 * AGoT opening reading order:
 * 1 Prologue · 2 Bran I · 3 Catelyn I
 */
export const CHAPTERS: ChapterSpec[] = [
  {
    id: "ch-prologue",
    chapterNumber: 1,
    chapterTitle: "Prologue",
    label: "Prologue — Night's Watch north of the Wall",
    units: [
      "三名守夜人——威尔、盖雷德与年轻骑士威玛·罗伊斯——在绝境长城以北的鬼影森林巡逻。",
      "他们找到一处看似废弃的野人营地，尸体却转眼消失，寒意与不安笼罩林间。",
      "威玛坚持追查，在月光下的树林里遭遇异鬼；决斗之后他倒下，又重新站起，已成尸鬼。",
      "威尔目睹这一切后逃回长城，只剩恐惧与誓言。",
    ],
  },
  {
    id: "ch-bran-1",
    chapterNumber: 2,
    chapterTitle: "Bran I",
    label: "Bran I — Deserter and direwolf pups",
    units: [
      "布兰随父亲艾德·史塔克与兄长们骑马出城，在冰天雪地的刑场观看处决逃兵。",
      "行刑后，孩子们在路边发现死去的母冰原狼与几只尚能存活的幼崽。",
      "琼恩提出按孩子人数收养狼崽；布兰也得到一只属于自己的幼狼。",
      "寒冷的北方旷野、家族与幼狼的相遇，成为这一章的核心画面。",
    ],
  },
  {
    id: "ch-catelyn-1",
    chapterNumber: 3,
    chapterTitle: "Catelyn I",
    label: "Catelyn I — Godswood with Ned",
    units: [
      "凯特琳走进临冬城神木林，找到坐在心树下的艾德·史塔克。",
      "两人在安静的神木林中交谈南境消息与家族责任，气氛凝重。",
      "红叶心树、静谧水面与夫妻对谈，是这一章最清晰的视觉锚点。",
      "消息指向南方宫廷的动荡，但画面停留在北方神木林的私密一刻。",
    ],
  },
];

export function buildChapterNarrative(
  chapter: ChapterSpec,
  minLen = EXCERPT_BUNDLE_MIN_PROSE
): NarrativeInputBundle {
  const unit = chapter.units.join("");
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

/** Propose feedback — keep scene count readable for a product spike. */
export const SCENE_FEEDBACK =
  "For this single chapter, propose at most 3 editorial scenes that are visually decisive for a reader. Prefer moments with clear visible geometry (full bodies, readable props, stable poses). Do not invent beats absent from the narrative. Keep rendererExpression minimal and Local-executable.";
