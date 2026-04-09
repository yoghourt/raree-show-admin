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
  /** 场景配图序列（jsonb，唯一数据源） */
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
