/**
 * Production Granularity Gate — Propose → Human Review boundary.
 * Validator only. Spike evidence: SPIKE-GRANULARITY-GATE-001.
 */

export type {
  FrameNode,
  GranularityAnalysis,
  GranularityGateResult,
  GranularityInput,
  GranularityInvariant,
  GranularityLabels,
  GranularitySeverity,
  GranularityViolation,
  SourceHeading,
  StoryFrameBundle,
  StoryNode,
} from "./types";

export { runGranularityGate, invariantSet } from "./gate";
export { analyzeGranularity } from "./analyze";
export {
  candidatesToGranularityInput,
  evaluateGranularityForCandidates,
  narrativeSourceText,
} from "./from-candidates";
export {
  GRANULARITY_GATE_ACCEPT_BLOCKED,
  GRANULARITY_GATE_CONTEXT_REQUIRED,
  GRANULARITY_GATE_REPROPOSE_ACTION,
  granularityAcceptBlock,
  granularityBlocksCandidateType,
  granularityContextRequired,
  type GranularityAcceptContext,
} from "./accept-guard";
