/**
 * SPEC-D3-001 §4.1 / §4.2 — Discovery Platform data contracts
 */

export type DiscoverySessionState =
  | "draft"
  | "narrative_locked"
  | "proposing"
  | "review_pending"
  | "closed";

export type NarrativeInputMode = "excerpt_bundle" | "approved_summary";

export interface NarrativeExcerpt {
  text: string;
  orderIndex: number;
  sourceLabel?: string;
}

export interface NarrativeInputBundle {
  excerpts: NarrativeExcerpt[];
  operatorSummary?: string | null;
  inputMode: NarrativeInputMode;
  summaryAttested?: boolean;
}

export interface DiscoverySession {
  sessionId: string;
  workId: string;
  operatorId: string;
  state: DiscoverySessionState;
  narrative: NarrativeInputBundle;
  lockedAt: string | null;
  createdAt: string;
}

/** Gate-only flags; not persisted in locked bundle (§4.3.1) */
export interface NarrativeGateFlags {
  catalogOnly?: boolean;
  runtimeExportOnly?: boolean;
}

export interface LockNarrativeRequest {
  workId: string;
  sessionId: string;
  narrative: NarrativeInputBundle;
  catalogOnly?: boolean;
  runtimeExportOnly?: boolean;
}
