/**
 * Granularity Gate I/O — Propose → Human Review boundary.
 * Validator only (SPIKE-GRANULARITY-GATE-001). Not a generator or repair engine.
 */

export type GranularityInvariant = "G1" | "G2" | "G3" | "G4";

export type GranularitySeverity = "error" | "warning";

export type GranularityViolation = {
  invariant: GranularityInvariant;
  severity: GranularitySeverity;
  evidence: string[];
};

export type GranularityGateResult = {
  status: "PASS" | "FAIL";
  violations: GranularityViolation[];
  analysis: GranularityAnalysis;
};

export type StoryNode = {
  id: string;
  title: string;
  summary: string;
};

export type FrameNode = {
  id: string;
  parentStoryId: string;
  title: string;
  /** Discovery Scene prose = Frame Narrative draft (Gate input; Confirm writes caption). */
  caption: string;
};

/**
 * Optional operator/spike labels. Used when a check is semantic and must not
 * be faked as string equality. Gate still runs heuristics without these.
 */
export type GranularityLabels = {
  /** Plot turns the Reader must learn from some Frame caption. */
  requiredTurns?: string[];
};

export type GranularityInput = {
  sourceText: string;
  stories: StoryNode[];
  frames: FrameNode[];
  labels?: GranularityLabels;
};

export type SourceHeading = {
  index: number;
  title: string;
};

export type StoryFrameBundle = {
  story: StoryNode;
  frames: FrameNode[];
};

export type GranularityAnalysis = {
  headingCount: number;
  headings: SourceHeading[];
  storyCount: number;
  frameCount: number;
  singletonStoryCount: number;
  singletonStoryRatio: number;
  headingStoryCountDelta: number;
  sharedProperNamesAcrossStories: string[];
  bundles: Array<{
    storyId: string;
    title: string;
    frameCount: number;
    estimatedProgressionUnits: number;
  }>;
};
