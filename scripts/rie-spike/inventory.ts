import type { NarrativeUnit } from "./types";

/**
 * Minimal Reader-required inventory for the Three Kingdoms excerpt.
 * Not every source token. Commentary, counts, and ornament are OPTIONAL/DISCARDABLE.
 */
export const NARRATIVE_UNITS: NarrativeUnit[] = [
  {
    id: "U-REBELLION",
    kind: "event",
    necessity: "REQUIRED",
    source: "张角兄弟发动黄巾起义，官军败退",
    gloss: "Yellow Turban Rebellion rises",
    naiveEntities: ["Zhang Jue", "Yellow Turban"],
  },
  {
    id: "U-NOTICE",
    kind: "event",
    necessity: "REQUIRED",
    source: "刘焉听从邹靖，发布招募义兵榜文",
    gloss: "A recruitment notice is posted to raise volunteers",
    naiveEntities: ["Liu Yan", "Zou Jing", "Zhuozhou"],
  },
  {
    id: "U-MEET-OATH",
    kind: "relationship_change",
    necessity: "REQUIRED",
    source: "刘备、关羽、张飞相遇并桃园结义",
    gloss: "Liu Bei, Guan Yu, and Zhang Fei meet and swear brotherhood",
    naiveEntities: ["Liu Bei", "Guan Yu", "Zhang Fei"],
  },
  {
    id: "U-ARMS",
    kind: "event",
    necessity: "REQUIRED",
    source: "张世平、苏双资助，三兄弟打造兵器并召集乡勇",
    gloss: "Merchants fund them; they forge weapons and raise a militia",
    naiveEntities: ["Zhang Shiping", "Su Shuang"],
  },
  {
    id: "U-DAXING",
    kind: "event",
    necessity: "REQUIRED",
    source: "大兴山首战，黄巾主将败亡，刘备得胜",
    gloss: "First victory at Mount Daxing against Yellow Turban commanders",
    naiveEntities: ["Mount Daxing", "Deng Mao", "Cheng Yuanzhi"],
  },
  {
    id: "U-RESCUE",
    kind: "event",
    necessity: "REQUIRED",
    source: "三兄弟救出被围的董卓",
    gloss: "The brothers rescue Dong Zhuo from siege",
    naiveEntities: ["Dong Zhuo", "Liu Bei"],
  },
  {
    id: "U-SCORN",
    kind: "causal_turn",
    necessity: "REQUIRED",
    source: "董卓得知三人无官职门第后态度傲慢轻视",
    gloss: "Dong Zhuo scorns them for lack of rank or pedigree",
    naiveEntities: ["Dong Zhuo"],
  },
  {
    id: "U-ATTEMPT",
    kind: "attempted_action",
    necessity: "REQUIRED",
    source: "张飞大怒，提刀欲入帐斩杀董卓",
    gloss: "Zhang Fei attempts to kill Dong Zhuo",
    naiveEntities: ["Zhang Fei", "Dong Zhuo"],
  },
  {
    id: "U-PREVENT",
    kind: "prevented_action",
    necessity: "REQUIRED",
    source: "刘备与关羽死死劝阻",
    gloss: "Liu Bei and Guan Yu restrain Zhang Fei and prevent the killing",
    naiveEntities: ["Liu Bei", "Guan Yu", "Zhang Fei"],
  },
  {
    id: "U-ATTEMPT-PREVENTED",
    kind: "causal_turn",
    necessity: "REQUIRED",
    source: "张飞欲杀董卓，但刘备和关羽阻止了他",
    gloss: "Zhang Fei attempted to kill Dong Zhuo, but Liu Bei and Guan Yu prevented it",
    naiveEntities: ["Zhang Fei", "Dong Zhuo", "Liu Bei", "Guan Yu"],
  },
  {
    id: "U-OATH-TEXT",
    kind: "relationship_change",
    necessity: "OPTIONAL",
    source: "不求同年同月同日生，只愿同年同月同日死",
    gloss: "Exact peach-garden oath wording",
    naiveEntities: [],
  },
  {
    id: "U-WEAPON-NAMES",
    kind: "proper_noun_grounding",
    necessity: "OPTIONAL",
    source: "双股剑、青龙偃月刀、丈八点钢矛",
    gloss: "Named iconic weapons",
    naiveEntities: ["Green Dragon", "Serpent Spear"],
  },
  {
    id: "U-QINGZHOU",
    kind: "event",
    necessity: "OPTIONAL",
    source: "转战青州解围",
    gloss: "They also relieve Qingzhou before the Dong Zhuo rescue",
    naiveEntities: ["Qingzhou"],
  },
  {
    id: "U-THEME",
    kind: "consequence",
    necessity: "OPTIONAL",
    source: "揭示门阀偏见，预示董卓日后专权",
    gloss: "Narrator moral: class prejudice; Dong Zhuo’s later tyranny",
    naiveEntities: ["Dong Zhuo"],
  },
  {
    id: "U-COUNTS",
    kind: "event",
    necessity: "DISCARDABLE",
    source: "良马五十匹、金银五百两、镔铁一千斤、乡勇五百、敌军数万",
    gloss: "Exact counts of horses, silver, iron, troops",
    naiveEntities: [],
  },
];

export const REQUIRED_UNITS = NARRATIVE_UNITS.filter(
  (u) => u.necessity === "REQUIRED"
);

export function unitById(id: string): NarrativeUnit {
  const u = NARRATIVE_UNITS.find((x) => x.id === id);
  if (!u) throw new Error(`unknown unit ${id}`);
  return u;
}
