/**
 * Frozen Runtime slices from 2026-08-20 production dump.
 * Provenance only — evaluators must not branch on workId.
 */

import type { CaseSpec, LedgerRow } from "./types";

export const DUMP_PROVENANCE = {
  dumpedAt: "2026-08-20T10:01:08.250Z",
  sceneContextProjectionEnabled: "1",
  note: "Read-only dump of production scenes. Discovery sessionStorage is not durable; Discovery residual = persist fields.",
} as const;

export const CASE_SIMPLE: CaseSpec = {
  id: "simple",
  label: "Simple — recruitment notice still",
  sourceHeading: "1. 黄巾起义与招兵榜文",
  slice: {
    routeTsid: "scene_1787049985248",
    routeTitle: "The Yellow Turban Rebellion and Recruitment",
    routeChapterNumber: 1,
    storySummary:
      "At the end of the Han dynasty, the Yellow Turban Rebellion led by Zhang Jue breaks out. To defend the empire, the prefect Liu Yan issues a recruitment notice in Zhuozhou, gathering heroes from across the land.",
    frames: [
      {
        url: "https://res.cloudinary.com/dnuxz94n5/image/upload/v1787050158/tjesqlafnwb6mtwtkm3z.png",
        caption:
          "Prefect Liu Yan posts the official recruitment notice in Zhuozhou to gather volunteers against the Yellow Turbans.",
      },
    ],
    context: {
      narrativeMomentSummary:
        "Prefect Liu Yan posts the official recruitment notice in Zhuozhou to gather volunteers against the Yellow Turbans.",
      beatSummary:
        "Prefect Liu Yan posts the official recruitment notice in Zhuozhou to gather volunteers against the Yellow Turbans.",
      relationship: null,
      emotion: "urgency and despair",
      purpose: "establish the historical crisis and call to arms",
      chapterNumber: 1,
      appearanceNames: [],
      environment: "Zhuozhou town square, wooden notice board",
      archiveLocationName: null,
      expressionAction:
        "recruitment notice pinned to a wooden board in a public square with townspeople gathered around",
      expressionRoles: [],
      intentNames: [],
    },
  },
};

export const CASE_DENSE: CaseSpec = {
  id: "dense",
  label: "Dense — Mount Daxing first victory",
  sourceHeading: "4. 大兴山首战告捷",
  slice: {
    routeTsid: "scene_1787050009691",
    routeTitle: "Victory at Mount Daxing",
    routeChapterNumber: 4,
    storySummary:
      "Liu Bei and his volunteer force join Zou Jing at Mount Daxing to fight the Yellow Turbans. Zhang Fei and Guan Yu slay enemy commanders Deng Mao and Cheng Yuanzhi, securing their first major military victory.",
    frames: [
      {
        url: "https://res.cloudinary.com/dnuxz94n5/image/upload/v1787050285/mudsm6q7081n7oggdwum.png",
        caption:
          "Guan Yu and Zhang Fei confront the Yellow Turban commanders on horseback before the slopes of Mount Daxing.",
      },
    ],
    context: {
      narrativeMomentSummary:
        "Guan Yu and Zhang Fei confront the Yellow Turban commanders on horseback before the slopes of Mount Daxing.",
      beatSummary:
        "Guan Yu and Zhang Fei confront the Yellow Turban commanders on horseback before the slopes of Mount Daxing.",
      relationship: "battlefield allies in formation",
      emotion: "martial resolve",
      purpose: "demonstrate initial battlefield prowess",
      chapterNumber: 1,
      appearanceNames: ["Guan Yu", "Zhang Fei"],
      environment: "Mount Daxing foothills, dusty valley road",
      archiveLocationName: null,
      expressionAction:
        "two warriors on left and right holding polearms, facing forward across a dusty clearing",
      expressionRoles: ["Guan Yu", "Zhang Fei"],
      intentNames: ["Guan Yu", "Zhang Fei"],
    },
  },
};

export const CASE_CAUSAL: CaseSpec = {
  id: "causal",
  label: "Causal / relationship — Dong Zhuo scorn and prevented killing",
  sourceHeading: "5. 救援董卓与遭遇冷落",
  slice: {
    routeTsid: "scene_1787050018425",
    routeTitle: "Rescuing Dong Zhuo",
    routeChapterNumber: 6,
    storySummary:
      "The trio rescues imperial commander Dong Zhuo from a Yellow Turban siege, but Dong Zhuo responds with arrogance and contempt upon learning they lack noble backgrounds, sparking Zhang Fei's fury.",
    frames: [
      {
        url: "https://res.cloudinary.com/dnuxz94n5/image/upload/v1787050349/blhfkn8rzczoomm2tniu.png",
        caption:
          "Zhang Fei reaches for his sword inside the military tent in anger while Liu Bei and Guan Yu restrain him before an arrogant Dong Zhuo.",
      },
    ],
    context: {
      narrativeMomentSummary:
        "Zhang Fei reaches for his sword inside the military tent in anger while Liu Bei and Guan Yu restrain him before an arrogant Dong Zhuo.",
      beatSummary:
        "Zhang Fei reaches for his sword inside the military tent in anger while Liu Bei and Guan Yu restrain him before an arrogant Dong Zhuo.",
      relationship:
        "restraining a furious brother before an ungrateful official",
      emotion: "suppressed fury and bureaucratic contempt",
      purpose: "reveal Dong Zhuo's arrogant nature and class prejudice",
      chapterNumber: 1,
      appearanceNames: ["Liu Bei", "Guan Yu", "Zhang Fei"],
      environment:
        "military commander's tent interior, wooden table, hanging maps",
      archiveLocationName: null,
      expressionAction:
        "three brothers standing together inside a canvas tent, Zhang Fei gesturing toward an elevated seated officer",
      expressionRoles: ["Liu Bei", "Guan Yu", "Zhang Fei"],
      intentNames: ["Liu Bei", "Guan Yu", "Zhang Fei"],
    },
  },
};

export const CASES: CaseSpec[] = [CASE_SIMPLE, CASE_DENSE, CASE_CAUSAL];

/**
 * Merchant route from the same dump — appendix, not one of the three primary cases.
 * Proves Accept of Story without Frame projection.
 */
export const APPENDIX_MERCHANT_SLICE = {
  routeTsid: "scene_1787050035308",
  routeTitle: "Merchant Patronage and Weapon Forging",
  routeChapterNumber: 7,
  storySummary:
    "Merchants Zhang Shiping and Su Shuang generously fund the newly formed trio with horses, gold, and iron, enabling Liu Bei, Guan Yu, and Zhang Fei to forge their legendary weapons.",
  frames: [] as Array<{ url: string; caption: string }>,
  context: null,
};

export const APPENDIX_PEACH_SLICE = {
  routeTsid: "scene_1787049999993",
  routeTitle: "The Peach Garden Oath",
  routeChapterNumber: 2,
  storySummary:
    "Liu Bei, Guan Yu, and Zhang Feng meet in Zhuozhou and bond over their shared ambition to bring peace to the realm. They swear brotherhood in a peach garden, vowing to die together.",
  frames: [
    {
      caption:
        "Liu Bei, Guan Yu, and Zhang Fei take the oath of brotherhood in a blossoming peach garden.",
    },
  ],
};

function haystack(slice: CaseSpec["slice"]): {
  story: string;
  caption: string;
  context: string;
  appearance: string;
  expression: string;
} {
  const ctx = slice.context;
  return {
    story: slice.storySummary,
    caption: slice.frames.map((f) => f.caption).join("\n"),
    context: [
      ctx?.beatSummary,
      ctx?.relationship,
      ctx?.emotion,
      ctx?.purpose,
    ]
      .filter(Boolean)
      .join("\n"),
    appearance: (ctx?.appearanceNames ?? []).join(" "),
    expression: [
      ctx?.expressionAction,
      ...(ctx?.expressionRoles ?? []),
      ...(ctx?.intentNames ?? []),
    ].join(" "),
  };
}

function hasNeedles(text: string, needles: string[]): boolean {
  const hay = text.toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

/**
 * Discovery residual = Story.summary ∪ caption ∪ Intent/Expression persist.
 * Session Propose JSON is not durable; this is the first durable snapshot.
 */
function discoveryHay(slice: CaseSpec["slice"]): string {
  const h = haystack(slice);
  return [h.story, h.caption, h.context, h.appearance, h.expression].join("\n");
}

function acceptedHay(slice: CaseSpec["slice"]): string {
  return discoveryHay(slice);
}

export const LEDGER: LedgerRow[] = [
  // —— Case simple ——
  {
    id: "S-NOTICE",
    caseId: "simple",
    sourceInformation: "刘焉在涿郡发布招募义兵榜文",
    kind: "Event",
    needles: ["recruitment notice", "Liu Yan", "Zhuozhou"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "Y",
    runtimeContext: "Y",
    runtimeAppearance: "N",
    lossPoint: "runtime_mapping",
    cause: "Runtime mapping loss",
    architecture: "C. Projection / Runtime mapping problem",
    note: "Caption names Liu Yan; Expression.characters=[] so Step appearance is empty.",
  },
  {
    id: "S-REBELLION",
    caseId: "simple",
    sourceInformation: "张角兄弟以太平道发动黄巾起义，官军败退",
    kind: "Event",
    needles: ["Yellow Turban", "Zhang Jue"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "P",
    runtimeContext: "P",
    runtimeAppearance: "N",
    lossPoint: "semantic_compression",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Story.summary has Zhang Jue + rebellion; caption only says 'against the Yellow Turbans'. Brothers Zhang Bao/Liang never appear.",
  },
  {
    id: "S-ZOU-JING-ADVICE",
    caseId: "simple",
    sourceInformation: "刘焉采纳邹靖建议后发榜",
    kind: "Causality",
    needles: ["Zou Jing"],
    source: "Y",
    discovery: "N",
    accepted: "N",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "extraction",
    cause: "Extraction loss",
    architecture: "A. Discovery extraction problem",
    note: "Zou Jing never enters Story.summary, caption, or Intent. Not a missing field — prose could have named him.",
  },
  {
    id: "S-EUNUCH-DISASTER",
    caseId: "simple",
    sourceInformation: "朝政腐败、宦官专权、连年天灾、民不聊生",
    kind: "Causality",
    needles: ["eunuch", "corruption", "disaster"],
    source: "Y",
    discovery: "N",
    accepted: "N",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "extraction",
    cause: "Extraction loss",
    architecture: "A. Discovery extraction problem",
    note: "Cause of rebellion omitted from all durable fields. Intent.purpose is thematic, not this cause chain.",
  },
  {
    id: "S-PLACE-ARCHIVE",
    caseId: "simple",
    sourceInformation: "地点：涿郡县城 / 榜文公示处",
    kind: "Place",
    needles: ["Zhuozhou"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "Y",
    runtimeContext: "Y",
    runtimeAppearance: "N",
    lossPoint: "runtime_mapping",
    cause: "Runtime mapping loss",
    architecture: "C. Projection / Runtime mapping problem",
    note: "environmentFromExpression present; location archiveTsid absent (Work has no Three Kingdoms locations).",
  },

  // —— Case dense ——
  {
    id: "D-SLAYING",
    caseId: "dense",
    sourceInformation: "张飞刺死邓茂，关羽斩程远志，黄巾主将双亡",
    kind: "Outcome",
    needles: ["slay", "Deng Mao", "Cheng Yuanzhi"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "semantic_compression",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Story.summary has the kills; Scene.summary/caption is a still ('confront'). Caption is Reader authority — outcome is lost for the Reader.",
  },
  {
    id: "D-CONFRONT-STILL",
    caseId: "dense",
    sourceInformation: "阵前交锋发生在大兴山下",
    kind: "Event",
    needles: ["Mount Daxing"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "Y",
    runtimeContext: "Y",
    runtimeAppearance: "N",
    lossPoint: "none",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Place+confrontation survive. Used as control: not everything is lost.",
  },
  {
    id: "D-LIU-BEI",
    caseId: "dense",
    sourceInformation: "刘备率乡勇随邹靖出征并参与掩杀",
    kind: "Character",
    needles: ["Liu Bei"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "semantic_compression",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Liu Bei in Story.summary; dropped from Scene caption, Intent, Expression.characters (2-figure still).",
  },
  {
    id: "D-ZOU-JING",
    caseId: "dense",
    sourceInformation: "随邹靖出征",
    kind: "Character",
    needles: ["Zou Jing"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "semantic_compression",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Present in Story.summary; absent from Frame.caption and appearance.",
  },
  {
    id: "D-ENEMY-NAMES",
    caseId: "dense",
    sourceInformation: "敌将程远志、邓茂具名",
    kind: "Character",
    needles: ["Deng Mao", "Cheng Yuanzhi"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "semantic_compression",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Named in Story.summary; caption says 'Yellow Turban commanders'.",
  },
  {
    id: "D-SEQUENCE-DUELS",
    caseId: "dense",
    sourceInformation: "先张飞杀邓茂，再关羽斩程远志（顺序）",
    kind: "Sequence / ordering",
    needles: [],
    source: "Y",
    discovery: "N",
    accepted: "N",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "schema",
    cause: "Schema loss",
    architecture: "B. Discovery → Scene contract problem",
    note: "One Scene.summary cannot encode ordered sub-beats except as prose. 1 Story × 1 Frame collapsed the sequence.",
  },
  {
    id: "D-COUNTS",
    caseId: "dense",
    sourceInformation: "乡勇五百、敌军数万",
    kind: "Other narrative information",
    needles: ["five hundred", "500", "tens of thousands"],
    source: "Y",
    discovery: "N",
    accepted: "N",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "extraction",
    cause: "Extraction loss",
    architecture: "A. Discovery extraction problem",
    note: "DISCARDABLE for Reader sufficiency (RIE-001). Recorded so the contract can exclude it.",
  },
  {
    id: "D-CONTEXT-CHAPTER",
    caseId: "dense",
    sourceInformation: "此节为 Source 第 4 拍；Route.chapter_number=4",
    kind: "Sequence / ordering",
    needles: [],
    source: "Y",
    discovery: "P",
    accepted: "P",
    runtimeCaption: "N",
    runtimeContext: "P",
    runtimeAppearance: "N",
    lossPoint: "projection",
    cause: "Projection loss",
    architecture: "C. Projection / Runtime mapping problem",
    note: "Route chapter_number=4; Context.narrativeMoment.chapter_number=1 (copied from Scene staging, not Route).",
  },

  // —— Case causal ——
  {
    id: "C-RESCUE",
    caseId: "causal",
    sourceInformation: "三兄弟救出被围的董卓",
    kind: "Event",
    needles: ["rescue"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "semantic_compression",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Story.summary has rescue; caption is the tent aftermath still. Route title still says Rescuing Dong Zhuo.",
  },
  {
    id: "C-SCORN-CAUSE",
    caseId: "causal",
    sourceInformation: "董卓得知三人无官职门第后才傲慢轻视",
    kind: "Causality",
    needles: ["noble backgrounds"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "runtime_mapping",
    cause: "Runtime mapping loss",
    architecture: "C. Projection / Runtime mapping problem",
    note: "Cause is in Story.summary and Intent.purpose; caption only has 'arrogant'. Reader authority is caption.",
  },
  {
    id: "C-ATTEMPT",
    caseId: "causal",
    sourceInformation: "张飞提刀欲入帐斩杀董卓",
    kind: "Attempted action",
    needles: ["reaches for his sword", "anger"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "Y",
    runtimeContext: "Y",
    runtimeAppearance: "N",
    lossPoint: "none",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Caption carries the attempt. Expression.action weakens it to 'gesturing' (Creator still, not Reader).",
  },
  {
    id: "C-PREVENT",
    caseId: "causal",
    sourceInformation: "刘备与关羽死死劝阻，杀戮未发生",
    kind: "Prevented action",
    needles: ["restrain"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "Y",
    runtimeContext: "Y",
    runtimeAppearance: "N",
    lossPoint: "none",
    cause: "Semantic compression",
    architecture: "B. Discovery → Scene contract problem",
    note: "Unlike RIE Fixture A Propose, this Accepted caption DOES keep prevention. Story.summary does not. Caption saved it.",
  },
  {
    id: "C-NEGATIVE",
    caseId: "causal",
    sourceInformation: "董卓没有被杀（未发生的结果）",
    kind: "Negative information / omission",
    needles: ["restrain"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "Y",
    runtimeContext: "Y",
    runtimeAppearance: "N",
    lossPoint: "none",
    cause: "Schema loss",
    architecture: "B. Discovery → Scene contract problem",
    note: "No first-class prevented-action field. Survived only because Scene.summary prose included 'restrain'. Schema did not cause loss here — it would have if caption had been still-only.",
  },
  {
    id: "C-DONG-ZHUO-APPEARANCE",
    caseId: "causal",
    sourceInformation: "董卓在帐中在场",
    kind: "Named agent in still vs caption",
    needles: ["Dong Zhuo"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "Y",
    runtimeContext: "Y",
    runtimeAppearance: "N",
    lossPoint: "runtime_mapping",
    cause: "Runtime mapping loss",
    architecture: "C. Projection / Runtime mapping problem",
    note: "Caption + Story.summary name Dong Zhuo. Intent.characters and Expression.characters omit him ('elevated seated officer'). Appearance list therefore omits him.",
  },
  {
    id: "C-BROTHER-RELATION",
    caseId: "causal",
    sourceInformation: "刘备关羽张飞已是结义兄弟；劝阻是兄弟关系动作",
    kind: "Relationship",
    needles: ["brother"],
    source: "Y",
    discovery: "Y",
    accepted: "Y",
    runtimeCaption: "N",
    runtimeContext: "Y",
    runtimeAppearance: "N",
    lossPoint: "runtime_mapping",
    cause: "Runtime mapping loss",
    architecture: "C. Projection / Runtime mapping problem",
    note: "visualIntent.relationship and Context.readerFacingNarrativeContext.relationship hold it. Frame.caption does not. L4-B Reader uses appearance/place, not relationship text.",
  },
  {
    id: "C-QINGZHOU",
    caseId: "causal",
    sourceInformation: "救出董卓前曾转战青州解围",
    kind: "Event",
    needles: ["Qingzhou"],
    source: "Y",
    discovery: "N",
    accepted: "N",
    runtimeCaption: "N",
    runtimeContext: "N",
    runtimeAppearance: "N",
    lossPoint: "extraction",
    cause: "Extraction loss",
    architecture: "A. Discovery extraction problem",
    note: "OPTIONAL in RIE-001. Never extracted. Not required for Scene sufficiency.",
  },
  {
    id: "C-THEME-TYRANNY",
    caseId: "causal",
    sourceInformation: "叙述者点出门阀偏见并预示董卓日后专权",
    kind: "Narrative state",
    needles: ["tyranny", "later", "class prejudice"],
    source: "Y",
    discovery: "P",
    accepted: "P",
    runtimeCaption: "N",
    runtimeContext: "P",
    runtimeAppearance: "N",
    lossPoint: "semantic_compression",
    cause: "Semantic compression",
    architecture: "A. Discovery extraction problem",
    note: "Intent.purpose mentions class prejudice; narrator foreshadowing of later tyranny is absent. OPTIONAL.",
  },
];

export { haystack, hasNeedles, discoveryHay, acceptedHay };
