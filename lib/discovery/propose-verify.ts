/**
 * SPEC-D3-003 OQ-D3-003-04 — lock snapshot + Narrative Gate verification for propose
 */

import { normalizeNarrativeBundle } from "@/lib/discovery/narrative-snapshot";
import {
  validateNarrativeGate,
  type NarrativeGateResult,
} from "@/lib/discovery/narrative-gate";
import { getServerLockSnapshot } from "@/lib/discovery/server-session-registry";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

export type VerifyProposeLockResult =
  | { ok: true }
  | {
      ok: false;
      code: "NARRATIVE_NOT_LOCKED" | "NARRATIVE_INVALID";
      message: string;
      failures?: NarrativeGateResult["failures"];
    };

export function verifyProposeLock(
  workId: string,
  operatorId: string,
  sessionId: string,
  narrative: NarrativeInputBundle,
  lockedAt: string
): VerifyProposeLockResult {
  const snapshot = getServerLockSnapshot(workId, operatorId);

  if (!snapshot || snapshot.sessionId !== sessionId) {
    return {
      ok: false,
      code: "NARRATIVE_NOT_LOCKED",
      message: "Discovery narrative is not locked for this session",
    };
  }

  if (snapshot.lockedAt !== lockedAt) {
    return {
      ok: false,
      code: "NARRATIVE_INVALID",
      message: "Locked narrative snapshot mismatch (lockedAt)",
    };
  }

  if (snapshot.narrativeNormalized !== normalizeNarrativeBundle(narrative)) {
    return {
      ok: false,
      code: "NARRATIVE_INVALID",
      message: "Locked narrative snapshot mismatch (narrative bundle)",
    };
  }

  const gate = validateNarrativeGate(narrative);
  if (!gate.pass) {
    return {
      ok: false,
      code: "NARRATIVE_INVALID",
      message: "Narrative gate validation failed",
      failures: gate.failures,
    };
  }

  return { ok: true };
}
