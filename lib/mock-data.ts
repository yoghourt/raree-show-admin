import type { Scene } from "@/lib/types";

export const MOCK_SCENES: Scene[] = [
  {
    tsid: "scene_winterfell_gate",
    title: "临冬城城门",
    chapterInfo: "卷一 · 序章",
    summary: "守夜人离队后遇异鬼，为全书冷冽基调拉开序幕。",
    tags: ["序幕", "异鬼", "守夜人"],
    locationId: "loc_winterfell",
    characterIds: ["char_will", "char_waymar"],
  },
  {
    tsid: "scene_kingsroad",
    title: "国王大道南下",
    chapterInfo: "卷一 · 艾莉亚 I",
    summary: "艾莉亚与同伴沿国王大道行进，途中气氛紧张。",
    tags: ["旅途", "艾莉亚"],
    locationId: "loc_kingsroad",
    characterIds: ["char_arya", "char_yoren"],
  },
  {
    tsid: "scene_dragonstone_council",
    title: "龙石岛议事",
    chapterInfo: "卷二 · 史坦尼斯",
    summary: "史坦尼斯一方商议战略，红袍女影响渐显。",
    tags: ["战略", "龙石岛"],
    locationId: "loc_dragonstone",
    characterIds: ["char_stannis", "char_melisandre", "char_davos"],
  },
];
