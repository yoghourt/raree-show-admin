export type Work = {
  id: string;
  tsid: string;
  title: string;
  description: string;
  coverImage: string;
  createdAt: string;
};

export type Scene = {
  workId: string;
  tsid: string;
  title: string;
  chapterInfo: string;
  summary: string;
  tags: string[];
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
