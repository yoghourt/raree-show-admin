import type { Scene } from "@/lib/types";

/** 占位 work id，仅作本地示例/种子参考；线上数据以 Supabase 为准 */
const PLACEHOLDER_WORK_ID = "00000000-0000-0000-0000-000000000000";

export const MOCK_SCENES: Scene[] = [
  {
    workId: PLACEHOLDER_WORK_ID,
    tsid: "scene_winterfell_gate",
    title: "临冬城城门",
    chapter_number: 1,
    chapter_title: "序章",
    summary: "守夜人离队后遇异鬼，为全书冷冽基调拉开序幕。",
    tags: ["序幕", "异鬼", "守夜人"],
    story_images: [],
    story_images_v2: null,
    locationId: "loc_winterfell",
    characterIds: ["char_will", "char_waymar"],
  },
  {
    workId: PLACEHOLDER_WORK_ID,
    tsid: "scene_kingsroad",
    title: "国王大道南下",
    chapter_number: 2,
    chapter_title: "艾莉亚 I",
    summary: "艾莉亚与同伴沿国王大道行进，途中气氛紧张。",
    tags: ["旅途", "艾莉亚"],
    story_images: [],
    story_images_v2: null,
    locationId: "loc_kingsroad",
    characterIds: ["char_arya", "char_yoren"],
  },
  {
    workId: PLACEHOLDER_WORK_ID,
    tsid: "scene_dragonstone_council",
    title: "龙石岛议事",
    chapter_number: 3,
    chapter_title: "史坦尼斯",
    summary: "史坦尼斯一方商议战略，红袍女影响渐显。",
    tags: ["战略", "龙石岛"],
    story_images: [],
    story_images_v2: null,
    locationId: "loc_dragonstone",
    characterIds: ["char_stannis", "char_melisandre", "char_davos"],
  },
];
