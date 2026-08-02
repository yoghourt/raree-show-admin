export type Work = {
  id: string;
  tsid: string;
  title: string;
  description: string;
  coverImage: string;
  sourceProfileId: string | null;
  createdAt: string;
};

export type ReadingFrame = {
  url: string;
  caption: string;
};

export type ReadingRoute = {
  workId: string;
  tsid: string;
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  summary: string;
  tags: string[];
  /** 阅读帧序列（jsonb，唯一数据源；implementation column: story_images_v2） */
  story_images_v2: ReadingFrame[] | null;
  locationId: string | null;
  characterIds: string[];
  /**
   * Creator-only: per-frame Expression presence from frame_provenance_v1.
   * Index-aligned with story_images_v2. Not Reader Truth (ADR-011 A3).
   */
  frameHasRendererExpression?: boolean[];
  /**
   * Creator-only: Expression has optional narrative cues
   * (lighting / atmosphere / threatPerception / visualEmphasis). A5 smoke aid.
   */
  frameExpressionHasNarrativeCues?: boolean[];
};

export type Character = {
  id: string;
  tsid: string;
  name: string;
  house: string;
  description: string;
  signatureQuote: string | null;
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
