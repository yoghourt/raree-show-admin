/**
 * SPEC-D2-003 — Evidence Architecture runtime types
 */

import type { EntityType, SourceRef } from "@/lib/ai/copilot-types";

export type SourceBindingStatus = "draft" | "approved" | "inactive";

export type SourceProfileKind =
  | "public_franchise"
  | "original_work"
  | "encyclopedia";

export interface SourceProfile {
  profileId: string;
  kind: SourceProfileKind;
  displayName: string;
  workPattern: string;
  wikipediaSearchContext?: string | null;
  tier2Enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Tier-1 only — stored in source_bindings */
export interface SourceBinding {
  bindingId: string;
  profileId: string;
  tier: 1;
  connectorId: string;
  officialSourceId: string;
  sourceLabel: string;
  baseUrl: string;
  applicableFields: string[];
  effectiveFrom: string;
  status: SourceBindingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSourceContext {
  sourceProfileId: string;
  profile: SourceProfile;
  tier1Bindings: SourceBinding[];
}

export type EvidenceDiagnosticCode =
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "NO_MATCH"
  | "RATE_LIMITED"
  | "PARSE_ERROR";

export interface EvidenceDiagnostic {
  connectorId: string;
  code: EvidenceDiagnosticCode;
  message: string;
}

export interface EvidenceItem {
  tier: 1 | 2 | 3;
  connectorId: string;
  sourceRef: SourceRef;
  excerpt: string;
  retrievedAt: string;
  matchConfidence: "high" | "medium" | "low";
}

export interface EvidenceBundle {
  requestId: string;
  workId: string;
  entityType: EntityType;
  scopeFieldValue: string;
  field: string;
  matched: boolean;
  tier: 1 | 2 | 3;
  evidenceItems: EvidenceItem[];
  diagnostics: EvidenceDiagnostic[];
}

export interface ConnectorRetrieveInput {
  entityType: EntityType;
  scopeFieldValue: string;
  profile: SourceProfile;
  connectorId: string;
  baseUrl: string;
}
