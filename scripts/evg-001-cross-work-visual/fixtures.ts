/**
 * EVG-001 first-round fixtures — disposable experiment data.
 *
 * Same experience machinery for both works. No per-work style tuning.
 * Scene types are paired so 三国 and ASOIAF are compared in one round.
 */

import type { CharacterArchive } from "../../lib/discovery/character-archive";
import type { RendererExpression } from "../../lib/discovery/visual-contract";

export type WorkId = "three-kingdoms" | "asoiaf";

export type SceneType =
  | "symbol-profile"
  | "sacred-place"
  | "indoor-counsel"
  | "campaign-document";

export type RoleFixture = {
  name: string;
  archive: CharacterArchive;
};

export type FrameFixture = {
  id: string;
  workId: WorkId;
  sceneType: SceneType;
  label: string;
  /** In-world setting title only — not the EVG evaluation label. */
  routeTitle: string;
  caption: string;
  roles: RoleFixture[];
  /** Canonical Expression as Discovery would author it from the work — not Local-minimized. */
  expression: RendererExpression;
  /** Identity tokens the reader should still be able to use after projection. */
  identityTokens: string[];
  render: boolean;
};

export const WORK_STYLE: Record<WorkId, string> = {
  "three-kingdoms":
    "Han mineral-pigment narrative illustration, ink-wash edge, Eastern military epic",
  asoiaf:
    "desaturated northern chronicle illustration, painterly grain, Western medieval winter",
};

const GUAN_YU: RoleFixture = {
  name: "Guan Yu",
  archive: {
    visualSummary:
      "Sworn brother recognized by crescent blade, red face, and long beard",
    identityCues: [
      "red face",
      "long beard",
      "Green Dragon Crescent Blade",
    ],
    costumeCues: ["green battle robe"],
    propCues: [],
  },
};

const LIU_BEI: RoleFixture = {
  name: "Liu Bei",
  archive: {
    visualSummary: "Humble Han royal claimant in plain dress",
    identityCues: ["twin swords"],
    costumeCues: ["plain Han robe", "straw sandals"],
    propCues: [],
  },
};

const ZHANG_FEI: RoleFixture = {
  name: "Zhang Fei",
  archive: {
    visualSummary: "Fierce sworn brother with bristling beard and serpent spear",
    identityCues: ["bristling beard", "serpent spear"],
    costumeCues: ["dark armor"],
    propCues: [],
  },
};

const DONG_ZHUO: RoleFixture = {
  name: "Dong Zhuo",
  archive: {
    visualSummary: "Arrogant Han minister in ornate court dress",
    identityCues: ["ivory minister tablet"],
    costumeCues: ["ornate Han court robe"],
    propCues: [],
  },
};

const NED: RoleFixture = {
  name: "Eddard Stark",
  archive: {
    visualSummary: "Northern lord shaped by honor and winter",
    identityCues: ["ancestral greatsword Ice"],
    costumeCues: ["dark northern fur cloak", "wool noble attire"],
    propCues: [],
  },
};

const CATELYN: RoleFixture = {
  name: "Catelyn Stark",
  archive: {
    visualSummary: "Northern lady with southern riverland grace",
    identityCues: ["auburn hair"],
    costumeCues: ["southern noble gown", "modest trim"],
    propCues: ["sealed letter"],
  },
};

const WAYMAR: RoleFixture = {
  name: "Waymar Royce",
  archive: {
    visualSummary: "Young Night's Watch ranger in black",
    costumeCues: ["black Night's Watch cloak", "closed helm"],
    propCues: ["steel sword"],
  },
};

const OTHER: RoleFixture = {
  name: "White Walker",
  archive: {
    visualSummary: "Inhuman ice being beyond the Wall",
    costumeCues: ["pale ice-like body", "ragged frost shroud"],
    propCues: ["ice sword"],
  },
};

export const FRAMES: FrameFixture[] = [
  {
    id: "tk-symbol-profile",
    workId: "three-kingdoms",
    sceneType: "symbol-profile",
    label: "三国 · 关羽侧身（强符号 / 非正脸）",
    routeTitle: "Mount Daxing",
    caption:
      "关羽侧身立于阵前，青龙偃月刀拄地，红脸长须，不面向观者。",
    roles: [GUAN_YU],
    identityTokens: [
      "green dragon",
      "crescent",
      "blade",
      "red face",
      "beard",
      "green",
      "robe",
    ],
    render: true,
    expression: {
      environment: "Han battlefield slope at Mount Daxing, silk banners, packed earth",
      characters: [
        {
          role: "Guan Yu",
          visual:
            "Green Dragon Crescent Blade, red face, long beard, green robe, back-three-quarter",
        },
      ],
      action:
        "Guan Yu standing in profile, crescent blade grounded, looking away from viewer",
      composition:
        "medium-wide profile still, face secondary, weapon and beard readable",
      styleHints: WORK_STYLE["three-kingdoms"],
      atmosphere: "martial gravity before the first strike",
      visualEmphasis: "Green Dragon Crescent Blade, red face, long beard",
    },
  },
  {
    id: "as-symbol-profile",
    workId: "asoiaf",
    sceneType: "symbol-profile",
    label: "ASOIAF · Ned 侧身（强符号 / 非正脸）",
    routeTitle: "Winterfell godswood",
    caption:
      "Eddard sits in profile by the heart tree, cleaning Ice, head bowed, not facing the viewer.",
    roles: [NED],
    identityTokens: ["ice", "greatsword", "fur", "cloak", "beard", "bowed"],
    render: true,
    expression: {
      environment: "Winterfell godswood, pale carved weirwood by dark pool",
      characters: [
        {
          role: "Eddard Stark",
          visual:
            "greatsword Ice, northern fur cloak, bearded, head bowed profile",
        },
      ],
      action:
        "Eddard seated in profile cleaning greatsword, head bowed, not facing viewer",
      composition:
        "medium-wide profile still, face secondary, sword and cloak readable",
      styleHints: WORK_STYLE.asoiaf,
      atmosphere: "quiet northern duty after an execution",
      visualEmphasis: "greatsword Ice against the weirwood pool",
    },
  },
  {
    id: "tk-sacred-place",
    workId: "three-kingdoms",
    sceneType: "sacred-place",
    label: "三国 · 桃园结义",
    routeTitle: "Peach Garden",
    caption:
      "刘备、关羽、张飞在桃花盛开的园中焚香结义，三人分立香案两侧。",
    roles: [LIU_BEI, GUAN_YU, ZHANG_FEI],
    identityTokens: [
      "peach",
      "twin swords",
      "crescent",
      "serpent spear",
      "green robe",
      "beard",
    ],
    render: true,
    expression: {
      environment: "peach garden in bloom, stone incense altar under pink petals",
      characters: [
        {
          role: "Liu Bei",
          visual: "plain Han robe, twin swords, straw sandals, standing left",
        },
        {
          role: "Guan Yu",
          visual:
            "Green Dragon Crescent Blade, red face, long beard, green robe",
        },
        {
          role: "Zhang Fei",
          visual: "serpent spear, dark armor, bristling beard, standing right",
        },
      ],
      action:
        "three sworn brothers at incense altar in peach garden, all fully visible, none facing camera",
      composition:
        "wide garden still, altar center, three figures, faces secondary",
      styleHints: WORK_STYLE["three-kingdoms"],
      atmosphere: "spring oath, brotherhood",
      visualEmphasis: "peach blossom canopy and three distinct weapons",
    },
  },
  {
    id: "as-sacred-place",
    workId: "asoiaf",
    sceneType: "sacred-place",
    label: "ASOIAF · 神木林密谈",
    routeTitle: "Winterfell godswood",
    caption:
      "Catelyn finds Ned by the heart tree after the execution; Ice rests by the dark pool.",
    roles: [NED, CATELYN],
    identityTokens: ["weirwood", "ice", "fur", "gown", "pool"],
    render: true,
    expression: {
      environment: "Winterfell godswood, pale carved weirwood by dark pool",
      characters: [
        {
          role: "Eddard Stark",
          visual: "greatsword Ice, northern fur cloak, seated head bowed",
        },
        {
          role: "Catelyn Stark",
          visual: "southern noble gown, auburn hair, standing in profile",
        },
      ],
      action:
        "Catelyn standing near seated Eddard by dark pool, both fully visible, looking down",
      composition:
        "medium-wide grove still, both figures, faces secondary to tree and sword",
      styleHints: WORK_STYLE.asoiaf,
      atmosphere: "sacred northern hush",
      visualEmphasis: "weirwood face and greatsword Ice",
    },
  },
  {
    id: "tk-indoor-counsel",
    workId: "three-kingdoms",
    sceneType: "indoor-counsel",
    label: "三国 · 帐中劝阻",
    routeTitle: "Han command tent",
    caption:
      "董卓在军帐中轻视刘备三人；张飞欲拔刀，刘备与关羽死死劝阻。",
    roles: [ZHANG_FEI, LIU_BEI, DONG_ZHUO],
    identityTokens: [
      "tent",
      "serpent spear",
      "han",
      "robe",
      "tablet",
    ],
    // R2 Local near-white → Cloud FLUX. Keep projection in the log; do not
    // render as R3 Local same-model evidence.
    render: false,
    expression: {
      environment: "Han felt military tent, campaign table, hanging campaign maps, oil lamps",
      characters: [
        {
          role: "Zhang Fei",
          visual: "serpent spear, dark armor, bristling beard, reaching for weapon",
        },
        {
          role: "Liu Bei",
          visual: "plain Han robe, twin swords, restraining Zhang Fei",
        },
        {
          role: "Dong Zhuo",
          visual: "ornate Han court robe, ivory minister tablet, seated in contempt",
        },
      ],
      action:
        "Zhang Fei reaching for spear, Liu Bei restraining him, Dong Zhuo seated at campaign table",
      composition:
        "medium-wide tent still, three figures fully visible, faces secondary",
      styleHints: WORK_STYLE["three-kingdoms"],
      atmosphere: "class insult inside a command tent",
      visualEmphasis: "felt tent walls, hanging campaign maps, restraining hands",
    },
  },
  {
    id: "as-indoor-counsel",
    workId: "asoiaf",
    sceneType: "indoor-counsel",
    label: "ASOIAF · 密信",
    routeTitle: "Winterfell solar",
    caption:
      "Catelyn delivers grave news of Jon Arryn's death; she and Ned look down at the sealed letter.",
    roles: [CATELYN, NED],
    identityTokens: [
      "sealed letter",
      "auburn hair",
      "gown",
      "fur",
      "cloak",
      "Ice",
    ],
    render: true,
    expression: {
      environment: "Winterfell solar, granite chamber, timber table, tallow candles",
      characters: [
        {
          role: "Catelyn Stark",
          visual: "southern noble gown, sealed letter, standing in profile",
        },
        {
          role: "Eddard Stark",
          visual: "northern fur cloak, seated looking down at parchment",
        },
      ],
      action:
        "Catelyn and Eddard looking down at sealed letter on wooden table, both fully visible",
      composition:
        "medium-wide indoor still, two profiles, faces secondary to letter",
      styleHints: WORK_STYLE.asoiaf,
      atmosphere: "grave indoor news",
      visualEmphasis: "sealed parchment between husband and wife",
    },
  },
  {
    id: "tk-campaign-document",
    workId: "three-kingdoms",
    sceneType: "campaign-document",
    label: "三国 · 军帐地图（投影对照，默认可跳过出图）",
    routeTitle: "Han command tent",
    caption: "刘备与关羽俯看军帐中的征讨地图。",
    roles: [LIU_BEI, GUAN_YU],
    identityTokens: [
      "Green Dragon Crescent Blade",
      "red face",
      "long beard",
      "green robe",
      "campaign map",
      "tent",
    ],
    render: true,
    expression: {
      environment: "Han felt command tent, campaign map on wooden table, oil lamps",
      characters: [
        {
          role: "Liu Bei",
          visual: "plain Han robe, twin swords, looking down at map",
        },
        {
          role: "Guan Yu",
          visual:
            "Green Dragon Crescent Blade, red face, long beard, green robe, looking down at map",
        },
      ],
      action:
        "Liu Bei and Guan Yu looking down at a campaign map on the table",
      composition: "medium-wide tent still, two profiles, faces secondary to map",
      styleHints: WORK_STYLE["three-kingdoms"],
      visualEmphasis: "felt tent, campaign map, Green Dragon Crescent Blade",
    },
  },
  {
    id: "as-duel-threat",
    workId: "asoiaf",
    sceneType: "campaign-document",
    label: "ASOIAF · 墙外对峙（投影对照）",
    routeTitle: "Beyond the Wall",
    caption:
      "Ser Waymar Royce faces a White Walker in the haunted forest; Will is not in frame.",
    roles: [WAYMAR, OTHER],
    identityTokens: ["black", "helm", "ice sword", "steel sword"],
    render: false,
    expression: {
      environment: "Haunted Forest clearing under moonlight beyond the Wall",
      characters: [
        {
          role: "Waymar Royce",
          visual: "steel sword, closed helm, black Night's Watch cloak",
        },
        {
          role: "White Walker",
          visual: "ice sword, pale frost shroud, inhuman scale",
        },
      ],
      action:
        "two warriors facing each other, swords crossed at middle distance",
      composition: "wide shot, faces secondary, two silhouettes",
      styleHints: WORK_STYLE.asoiaf,
      atmosphere: "supernatural cold",
      threatPerception: "inhuman opponent",
    },
  },
];

export const ASOIAF_BOUND_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: "winterfell", pattern: /\bwinterfell\b/i },
  { id: "weirwood", pattern: /\bweirwood\b/i },
  { id: "godswood", pattern: /\bgodswood\b/i },
  { id: "heart-tree", pattern: /\bheart\s*tree\b/i },
  { id: "northern-fur", pattern: /\bnorthern fur\b/i },
  { id: "catelyn", pattern: /\bcatelyn\b/i },
  { id: "eddard", pattern: /\beddard\b/i },
  { id: "valyrian", pattern: /\bvalyrian\b/i },
];

export const TK_BOUND_PATTERNS: { id: string; pattern: RegExp }[] = [
  { id: "han-tent", pattern: /\bhan\b/i },
  { id: "peach-garden", pattern: /\bpeach\b/i },
  { id: "crescent-blade", pattern: /\bcrescent blade\b/i },
  { id: "felt-tent", pattern: /\bfelt\b/i },
];

export const LETTER_REWRITE_PATTERN = /\b(letter|parchment|scroll)\b/i;
export const MAP_SURVIVAL_PATTERN = /\bmap\b/i;
export const LOCATION_SUBSTITUTION_PATTERN =
  /\b(winterfell stone chamber|castle hall|generic medieval stone)\b/i;
export const STYLE_HINT_MARKERS: Record<WorkId, RegExp> = {
  "three-kingdoms": /han mineral|ink-wash|eastern military/i,
  asoiaf: /desaturated northern|western medieval/i,
};
/** Work identity that Local must consume — materials / architecture, not style adjectives. */
export const WORK_IDENTITY_MARKERS: Record<WorkId, RegExp> = {
  "three-kingdoms": /\b(han|tent|felt|peach|silk banners|campaign map|oil lamps?)\b/i,
  asoiaf: /\b(winterfell|weirwood|godswood|fur cloak|solar|granite|tallow|snow)\b/i,
};
