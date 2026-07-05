/**
 * Shared helpers for Admin Rollout API routes (SPEC-ROL-001)
 */

export {
  assertWorkAccessible,
  parseJsonBody,
  requireDiscoveryAuth as requireRolloutAuth,
} from "@/lib/discovery/discovery-route-helpers";
