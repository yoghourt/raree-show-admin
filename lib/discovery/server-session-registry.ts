/**
 * SPEC-D3-001 §6 / SPEC-D3-003 OQ-D3-003-04 — server-side active lock registry (ephemeral, v1)
 */

import { normalizeNarrativeBundle } from "@/lib/discovery/narrative-snapshot";
import type { NarrativeInputBundle } from "@/lib/discovery/types";

export interface ServerLockSnapshot {
  sessionId: string;
  lockedAt: string;
  narrativeNormalized: string;
}

const activeLocks = new Map<string, ServerLockSnapshot>();

/** v1 ephemeral registry — reclaim orphaned locks after inactivity */
const SERVER_LOCK_STALE_MS = (() => {
  const raw = process.env.DISCOVERY_SERVER_LOCK_STALE_MS?.trim();
  if (raw === "0") return 0;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : 30 * 60 * 1000;
})();

function lockKey(workId: string, operatorId: string): string {
  return `${workId}:${operatorId}`;
}

export type ServerLockClaimResult =
  | { ok: true; replacedStaleLock?: boolean }
  | { ok: false; code: "SESSION_ALREADY_ACTIVE" };

function isServerLockStale(snapshot: ServerLockSnapshot): boolean {
  if (SERVER_LOCK_STALE_MS === 0) {
    return true;
  }
  const lockedMs = Date.parse(snapshot.lockedAt);
  if (Number.isNaN(lockedMs)) {
    return true;
  }
  return Date.now() - lockedMs >= SERVER_LOCK_STALE_MS;
}

export function setServerLock(
  workId: string,
  operatorId: string,
  sessionId: string,
  lockedAt: string,
  narrative: NarrativeInputBundle
): ServerLockClaimResult {
  const key = lockKey(workId, operatorId);
  const existing = activeLocks.get(key);

  if (existing && existing.sessionId !== sessionId) {
    if (!isServerLockStale(existing)) {
      return { ok: false, code: "SESSION_ALREADY_ACTIVE" };
    }
  }

  const replacedStaleLock =
    existing !== undefined && existing.sessionId !== sessionId;

  activeLocks.set(key, {
    sessionId,
    lockedAt,
    narrativeNormalized: normalizeNarrativeBundle(narrative),
  });
  return { ok: true, ...(replacedStaleLock ? { replacedStaleLock: true } : {}) };
}

/** @deprecated Use setServerLock with snapshot fields */
export function claimServerLock(
  workId: string,
  operatorId: string,
  sessionId: string,
  lockedAt?: string,
  narrative?: NarrativeInputBundle
): ServerLockClaimResult {
  if (lockedAt && narrative) {
    return setServerLock(workId, operatorId, sessionId, lockedAt, narrative);
  }
  const key = lockKey(workId, operatorId);
  const existing = activeLocks.get(key);
  if (existing && existing.sessionId !== sessionId) {
    if (!isServerLockStale(existing)) {
      return { ok: false, code: "SESSION_ALREADY_ACTIVE" };
    }
  }

  activeLocks.set(key, {
    sessionId,
    lockedAt: lockedAt ?? new Date().toISOString(),
    narrativeNormalized: narrative
      ? normalizeNarrativeBundle(narrative)
      : "",
  });
  return { ok: true };
}

export function getServerLockSnapshot(
  workId: string,
  operatorId: string
): ServerLockSnapshot | null {
  return activeLocks.get(lockKey(workId, operatorId)) ?? null;
}

export function releaseServerLock(
  workId: string,
  operatorId: string,
  sessionId: string
): void {
  const key = lockKey(workId, operatorId);
  if (activeLocks.get(key)?.sessionId === sessionId) {
    activeLocks.delete(key);
  }
}

/** Release server lock for operator regardless of sessionId (orphan recovery). */
export function releaseServerLockForOperator(
  workId: string,
  operatorId: string
): boolean {
  const key = lockKey(workId, operatorId);
  return activeLocks.delete(key);
}

/** Test-only reset */
export function resetServerLockRegistry(): void {
  activeLocks.clear();
}
