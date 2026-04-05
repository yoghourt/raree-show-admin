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
