/**
 * CPP domain projections (SPEC-CPP-001).
 * Tasks are derived — never an Asset authority store.
 */

export type ProductionTaskKind =
  | "missing_cover"
  | "complete_character_portrait"
  | "fill_frame_url"
  | "missing_reading_route"
  | "missing_frame_narrative";

export type DerivedProductionTask = {
  /** Stable projection id for UI keys only — not a durable authority id */
  id: string;
  kind: ProductionTaskKind;
  label: string;
  href: string;
  /** Optional target refs for batch actions */
  target?: {
    characterTsid?: string;
    routeTsid?: string;
    frameIndex?: number;
    caption?: string;
  };
};

export type ProductionChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  total: number;
  complete: number;
};

export type ProductionPlanProjection = {
  workId: string;
  profileId: "lean_showcase_v1";
  checklist: ProductionChecklistItem[];
  progressPercent: number;
  tasks: DerivedProductionTask[];
};
