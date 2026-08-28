/**
 * Scene Frame Alignment V1 — policy labels only (Phase 1).
 * Authority: config/infra/scene-frame-alignment-v1-policy.md
 * No auto-classifier; no auto fallback wiring yet.
 */

export type SceneFrameBeatCapability = "LOCAL_SAFE" | "LOCAL_HARD";

/** Human Accept gate under V1 (non-contradiction + usefulness). */
export type SceneFrameV1AcceptVerdict =
  | "accept"
  | "fail"
  | "defer";

export const SCENE_FRAME_V1_POLICY_REF =
  "config/infra/scene-frame-alignment-v1-policy.md";
