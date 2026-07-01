/**
 * SPEC-D3-001 §6 — server-side active lock registry (ephemeral, v1)
 */

const activeLocks = new Map<string, string>();

function lockKey(workId: string, operatorId: string): string {
  return `${workId}:${operatorId}`;
}

export type ServerLockClaimResult =
  | { ok: true }
  | { ok: false; code: "SESSION_ALREADY_ACTIVE" };

export function claimServerLock(
  workId: string,
  operatorId: string,
  sessionId: string
): ServerLockClaimResult {
  const key = lockKey(workId, operatorId);
  const existing = activeLocks.get(key);

  if (existing && existing !== sessionId) {
    return { ok: false, code: "SESSION_ALREADY_ACTIVE" };
  }

  activeLocks.set(key, sessionId);
  return { ok: true };
}

export function releaseServerLock(
  workId: string,
  operatorId: string,
  sessionId: string
): void {
  const key = lockKey(workId, operatorId);
  if (activeLocks.get(key) === sessionId) {
    activeLocks.delete(key);
  }
}

/** Test-only reset */
export function resetServerLockRegistry(): void {
  activeLocks.clear();
}
