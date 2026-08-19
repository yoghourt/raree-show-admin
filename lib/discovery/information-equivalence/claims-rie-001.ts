import type { ClaimedRequiredUnit } from "./types";

/**
 * RIE-001 / RIE-002 claimed REQUIRED units for the Three Kingdoms excerpt.
 * Caller-supplied contract only — not selected by Work id.
 */
export const RIE_001_CLAIMED_REQUIRED_UNITS: ClaimedRequiredUnit[] = [
  {
    unitId: "U-REBELLION",
    kind: "event",
    expected: "张角兄弟发动黄巾起义，官军败退",
    relationEvidence: [["Yellow Turban", "黄巾"]],
    naiveEntities: ["Zhang Jue"],
  },
  {
    unitId: "U-NOTICE",
    kind: "event",
    expected: "刘焉听从邹靖，发布招募义兵榜文",
    relationEvidence: [["recruitment notice", "榜文"]],
    naiveEntities: ["Liu Yan", "Zhuozhou"],
  },
  {
    unitId: "U-MEET-OATH",
    kind: "relationship_change",
    expected: "刘备、关羽、张飞相遇并桃园结义",
    relationEvidence: [["swear brotherhood", "结义"]],
    naiveEntities: ["Liu Bei", "Guan Yu", "Zhang Fei"],
  },
  {
    unitId: "U-ARMS",
    kind: "event",
    expected: "张世平、苏双资助，三兄弟打造兵器并召集乡勇",
    relationEvidence: [["fund", "arm a militia", "forge", "资助", "乡勇"]],
    naiveEntities: ["Zhang Shiping", "Su Shuang"],
  },
  {
    unitId: "U-DAXING",
    kind: "event",
    expected: "大兴山首战，黄巾主将败亡，刘备得胜",
    relationEvidence: [["Mount Daxing", "大兴山"]],
    naiveEntities: ["Deng Mao", "Cheng Yuanzhi"],
  },
  {
    unitId: "U-RESCUE",
    kind: "event",
    expected: "三兄弟救出被围的董卓",
    relationEvidence: [["rescue Dong Zhuo", "rescues Dong Zhuo", "救出董卓"]],
    naiveEntities: ["Dong Zhuo", "Liu Bei"],
  },
  {
    unitId: "U-SCORN",
    kind: "causal_turn",
    expected: "董卓得知三人无官职门第后态度傲慢轻视",
    relationEvidence: [["scorns", "contempt", "lack of rank", "轻视"]],
    naiveEntities: ["Dong Zhuo"],
  },
  {
    unitId: "U-ATTEMPT",
    kind: "attempted_action",
    expected: "张飞大怒，提刀欲入帐斩杀董卓",
    relationEvidence: [
      ["tries to kill", "try to kill", "attempted to kill", "欲杀", "into executing"],
    ],
    naiveEntities: ["Zhang Fei", "Dong Zhuo"],
  },
  {
    unitId: "U-PREVENT",
    kind: "prevented_action",
    expected: "刘备与关羽死死劝阻",
    relationEvidence: [["restrain", "prevent the killing", "prevented it", "劝阻"]],
    naiveEntities: ["Liu Bei", "Guan Yu", "Zhang Fei"],
  },
  {
    unitId: "U-ATTEMPT-PREVENTED",
    kind: "causal_turn",
    expected: "张飞欲杀董卓，但刘备和关羽阻止了他",
    relationEvidence: [
      ["tries to kill", "try to kill", "attempted to kill", "欲杀", "into executing"],
      ["restrain", "prevent the killing", "prevented it", "劝阻"],
    ],
    naiveEntities: ["Zhang Fei", "Dong Zhuo", "Liu Bei", "Guan Yu"],
  },
];
