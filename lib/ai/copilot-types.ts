/**
 * SPEC-D2-002 Enrichment Copilot — TypeScript type contracts
 *
 * All payload shapes are authoritative per §7 of the spec.
 * sessionId is a correlation-only identifier; no correctness logic may depend on it.
 */

// ---------------------------------------------------------------------------
// Taxonomy primitives
// ---------------------------------------------------------------------------

export type FieldClassification = "scope" | "canonical" | "narrative" | "asset";
export type CopilotRoute = "excluded" | "fact" | "narrative" | "reference";
export type EntityType = "character" | "location" | "scene";
export type Confidence = "green" | "yellow";
export type SuggestionClassification = "fact" | "narrative";

// ---------------------------------------------------------------------------
// Schema metadata (SPEC-CORE-001 §4.1, consumed by SPEC-D2-002)
// ---------------------------------------------------------------------------

export interface FieldMetadata {
  classification: FieldClassification;
  copilot_route: CopilotRoute;
}

// ---------------------------------------------------------------------------
// Source Connector interface (§5.6)
// ---------------------------------------------------------------------------

export interface SourceRef {
  tier: 1 | 2 | 3;
  label: string;
  url?: string;
  excerpt?: string;
}

export interface SourceConnectorInput {
  entityType: EntityType;
  scopeFieldValue: string;
  field: string;
  workId: string;
}

/** Resolved server-side from works.source_profile_id (SPEC-D2-003). */
export type { WorkSourceContext } from "@/lib/ai/evidence-types";

export interface SourceConnectorOutput {
  tier: 1 | 2 | 3;
  results: SourceRef[];
  matched: boolean;
}

// ---------------------------------------------------------------------------
// Suggest endpoint (§7.1, §7.2)
// ---------------------------------------------------------------------------

export interface FieldRequest {
  field: string;
  copilot_route: "fact" | "narrative";
}

export interface SuggestRequest {
  workId: string;
  entityType: EntityType;
  entityId: string;
  scopeField: string;
  /** Work title for prompt context (e.g. "三体"). Optional but improves relevance. */
  workTitle?: string | null;
  /** Loaded from works.source_profile_id — null triggers SC-03 for fact fields. */
  sourceContext?: import("@/lib/ai/evidence-types").WorkSourceContext | null;
  emptyFields: FieldRequest[];
}

export interface SuggestionItem {
  field: string;
  value: string;
  confidence: Confidence;
  classification: SuggestionClassification;
  sources: SourceRef[];
}

export interface SuggestResponse {
  suggestions: SuggestionItem[];
  sessionId?: string | null;
}

export interface PartialSuggestResponse extends SuggestResponse {
  errors: Array<{ field: string; code: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Retry endpoint (§7.4)
// ---------------------------------------------------------------------------

export interface RetryFieldRequest {
  field: string;
  previousSuggestion: string;
  feedback: string | null;
}

export interface RetryRequest {
  sessionId?: string | null;
  retryFields: RetryFieldRequest[];
}

// ---------------------------------------------------------------------------
// Error response (§7.5)
// ---------------------------------------------------------------------------

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: string[];
  };
}

// ---------------------------------------------------------------------------
// Client-side session state (useCopilotSession)
// ---------------------------------------------------------------------------

export type CopilotIconState = "disabled" | "enabled" | "loading";

export interface RetryQueueEntry {
  field: string;
  previousSuggestion: string;
  feedback: string | null;
}

export interface CopilotSessionState {
  iconState: CopilotIconState;
  dupConflict: boolean;
  panelOpen: boolean;
  suggestions: SuggestionItem[];
  skippedFields: Set<string>;
  retryQueue: RetryQueueEntry[];
  isRetrying: boolean;
  /** Narrative Regenerate pending suggestion (Phase 2) */
  pendingRegen: Record<string, SuggestionItem>;
}
