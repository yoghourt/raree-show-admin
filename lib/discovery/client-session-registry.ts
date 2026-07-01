/**
 * SPEC-D3-001 D3-RC-10 — one active Discovery session per (workId, operatorId)
 *
 * Uses localStorage in the browser so conflict detection works across tabs.
 * Falls back to in-memory store in Node (unit tests).
 */

const STORAGE_PREFIX = "raree:discovery:session:";
const STALE_MS = 2 * 60 * 60 * 1000;

interface StoredSessionRecord {
  sessionId: string;
  updatedAt: number;
}

const memoryStore = new Map<string, string>();

function sessionKey(workId: string, operatorId: string): string {
  return `${workId}:${operatorId}`;
}

function storageKey(workId: string, operatorId: string): string {
  return `${STORAGE_PREFIX}${sessionKey(workId, operatorId)}`;
}

function readRecord(key: string): StoredSessionRecord | null {
  const raw =
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage.getItem(key)
      : memoryStore.get(key) ?? null;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredSessionRecord;
    if (!parsed.sessionId || typeof parsed.updatedAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.updatedAt > STALE_MS) {
      removeRecord(key);
      return null;
    }
    return parsed;
  } catch {
    return { sessionId: raw, updatedAt: Date.now() };
  }
}

function writeRecord(key: string, sessionId: string): void {
  const value = JSON.stringify({
    sessionId,
    updatedAt: Date.now(),
  } satisfies StoredSessionRecord);

  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(key, value);
    return;
  }
  memoryStore.set(key, value);
}

function removeRecord(key: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(key);
    return;
  }
  memoryStore.delete(key);
}

export function getStoredClientSessionId(
  workId: string,
  operatorId: string
): string | null {
  if (!workId || !operatorId) {
    return null;
  }
  return readRecord(storageKey(workId, operatorId))?.sessionId ?? null;
}

export function getDiscoverySessionStorageKey(
  workId: string,
  operatorId: string
): string {
  return storageKey(workId, operatorId);
}

export type ClientSessionClaimResult =
  | { ok: true }
  | { ok: false; code: "SESSION_ALREADY_ACTIVE" };

export function claimClientSession(
  workId: string,
  operatorId: string,
  sessionId: string
): ClientSessionClaimResult {
  if (!workId || !operatorId) {
    return { ok: true };
  }

  const key = storageKey(workId, operatorId);
  const existing = readRecord(key);

  if (existing && existing.sessionId !== sessionId) {
    return { ok: false, code: "SESSION_ALREADY_ACTIVE" };
  }

  writeRecord(key, sessionId);
  return { ok: true };
}

export function releaseClientSession(
  workId: string,
  operatorId: string,
  sessionId: string
): void {
  if (!workId || !operatorId) {
    return;
  }

  const key = storageKey(workId, operatorId);
  const existing = readRecord(key);
  if (existing?.sessionId === sessionId) {
    removeRecord(key);
  }
}

export function hasClientSessionConflict(
  workId: string,
  operatorId: string,
  sessionId: string
): boolean {
  if (!workId || !operatorId) {
    return false;
  }
  const existing = readRecord(storageKey(workId, operatorId));
  return existing !== null && existing.sessionId !== sessionId;
}

/** Test-only reset */
export function resetClientSessionRegistry(): void {
  memoryStore.clear();
  if (typeof window !== "undefined" && window.localStorage) {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  }
}
