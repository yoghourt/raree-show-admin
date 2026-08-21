/**
 * SPIKE-DISCOVERY-SCENE-001 — Information Loss Ledger types.
 *
 * Presence is human-annotated against frozen Runtime slices, then probed
 * lexically so the annotation cannot drift from the captured artifacts.
 */

export type Presence = "Y" | "P" | "N";

export type LossPoint =
  | "none"
  | "extraction"
  | "schema"
  | "semantic_compression"
  | "review"
  | "projection"
  | "runtime_mapping";

export type LossCause =
  | "Extraction loss"
  | "Schema loss"
  | "Semantic compression"
  | "Human Review loss"
  | "Projection loss"
  | "Runtime mapping loss";

/** Architecture recommendation bucket from the spike grant. */
export type ArchitectureClass =
  | "A. Discovery extraction problem"
  | "B. Discovery → Scene contract problem"
  | "C. Projection / Runtime mapping problem";

export type InfoKind =
  | "Character"
  | "Relationship"
  | "Event"
  | "Time"
  | "Place"
  | "Causality"
  | "Narrative state"
  | "Negative information / omission"
  | "Sequence / ordering"
  | "Attempted action"
  | "Prevented action"
  | "Outcome"
  | "Named agent in still vs caption"
  | "Other narrative information";

export type LedgerRow = {
  id: string;
  caseId: "simple" | "dense" | "causal";
  sourceInformation: string;
  kind: InfoKind;
  /** Needles probed against English Runtime artifacts (caption / summary / intent / expression). */
  needles: string[];
  source: Presence;
  discovery: Presence;
  accepted: Presence;
  runtimeCaption: Presence;
  runtimeContext: Presence;
  runtimeAppearance: Presence;
  lossPoint: LossPoint;
  cause: LossCause;
  architecture: ArchitectureClass;
  note: string;
};

export type FrozenSceneSlice = {
  routeTsid: string;
  routeTitle: string;
  routeChapterNumber: number;
  /** Story persist — Accepted Story.summary */
  storySummary: string;
  frames: Array<{ url: string; caption: string }>;
  context: {
    narrativeMomentSummary: string | null;
    beatSummary: string | null;
    relationship: string | null;
    emotion: string | null;
    purpose: string | null;
    chapterNumber: number | null;
    appearanceNames: string[];
    environment: string | null;
    archiveLocationName: string | null;
    expressionAction: string | null;
    expressionRoles: string[];
    intentNames: string[];
  } | null;
};

export type CaseSpec = {
  id: "simple" | "dense" | "causal";
  label: string;
  sourceHeading: string;
  slice: FrozenSceneSlice;
};
