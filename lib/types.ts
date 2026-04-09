export type Work = {
  id: string;
  tsid: string;
  title: string;
  description: string;
  coverImage: string;
  createdAt: string;
};

export type StoryImage = {
  url: string;
  caption: string;
};

export type Scene = {
  workId: string;
  tsid: string;
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  summary: string;
  tags: string[];
  /** Legacy text[]；写入时必须与 `story_images_v2.map(x => x.url)` 一致 */
  story_images: string[];
  /** 新版 jsonb；表单与双写的单一数据源 */
  story_images_v2: StoryImage[] | null;
  locationId: string;
  characterIds: string[];
};

export type Character = {
  id: string;
  tsid: string;
  name: string;
  house: string;
  description: string;
  portraitUrl: string;
  workId: string;
  createdAt: string;
};

export type Location = {
  id: string;
  tsid: string;
  name: string;
  region: string;
  description: string;
  workId: string;
  createdAt: string;
  map_focus_x?: number | null;
  map_focus_y?: number | null;
};
