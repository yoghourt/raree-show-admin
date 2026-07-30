/** Types for Discovery Runtime Provider Evaluation (eval-only). */

import type { DiscoveryCandidateType } from "@/lib/discovery/propose-types";

export type EvalCandidateId = "A_gemini_flash" | "B_localai" | "C_openrouter_free";

export type FailureClass =
  | "model_generation"
  | "json_formatting"
  | "schema_validation"
  | "runtime_timeout"
  | "infrastructure"
  | "none";

export type TypeTiming = {
  candidateType: DiscoveryCandidateType;
  timingMs: number;
  candidateCount: number;
  jsonParseOk: boolean;
  schemaOk: boolean;
  failureClass: FailureClass;
  errorCode?: string;
  errorMessage?: string;
};

export type ProposeRunResult = {
  runIndex: number;
  candidateId: EvalCandidateId;
  provider: string;
  model: string;
  runtime: string;
  totalMs: number;
  typesOk: number;
  candidateCount: number;
  jsonParseSuccessTypes: number;
  schemaSuccessTypes: number;
  byType: TypeTiming[];
  provisionalQuality: {
    character: number;
    location: number;
    story: number;
    overall: number;
  };
};

export type CandidateAggregate = {
  candidateId: EvalCandidateId;
  provider: string;
  model: string;
  runtime: string;
  hardwareNote: string;
  configuration: Record<string, string>;
  runs: number;
  totalMs: number[];
  p50TotalMs: number | null;
  p95TotalMs: number | null;
  meanTotalMs: number | null;
  jsonParseSuccessRate: number | null;
  schemaSuccessRate: number | null;
  typeCoverageSuccessRate: number | null;
  meanProvisionalQuality: number | null;
  failureHistogram: Record<FailureClass, number>;
  estimatedUsdPerFullPropose: number | null;
  blockedReason?: string;
  recommendation: "continue_evaluation" | "approve_production_candidate" | "reject_candidate";
};
