"use client";

/**
 * useDiscoverySession — Discovery Platform client-side state machine
 *
 * SPEC-D3-001 §4 / §5 / D3-RC-02
 *
 * Separate from Enrichment useCopilotSession (DISC-INV-06, DISC-INV-07).
 * Ephemeral client state only — no Candidate or Entity persist (DISC-INV-01).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  claimClientSession,
  getDiscoverySessionStorageKey,
  hasClientSessionConflict,
  releaseClientSession,
} from "@/lib/discovery/client-session-registry";
import {
  APPROVED_SUMMARY_MIN_PROSE,
  EXCERPT_BUNDLE_MIN_PROSE,
} from "@/lib/discovery/constants";
import {
  validateNarrativeGate,
  type NarrativeGateResult,
} from "@/lib/discovery/narrative-gate";
import {
  canStartPropose,
  createDiscoverySession,
  isNarrativeEditable,
  switchNarrativeInputMode,
} from "@/lib/discovery/session-factory";
import type {
  DiscoverySession,
  NarrativeGateFlags,
  NarrativeInputBundle,
} from "@/lib/discovery/types";

export interface UseDiscoverySessionConfig {
  workId: string;
  operatorId: string;
}

export interface LockNarrativeError {
  code: string;
  message: string;
  failures?: NarrativeGateResult["failures"];
}

export interface UseDiscoverySessionReturn {
  session: DiscoverySession;
  gateResult: NarrativeGateResult;
  gateFlags: NarrativeGateFlags;
  setGateFlags: (flags: NarrativeGateFlags) => void;
  sessionConflict: boolean;
  isLocking: boolean;
  lockError: LockNarrativeError | null;
  canPropose: boolean;
  minProseRequired: number;
  updateNarrative: (narrative: NarrativeInputBundle) => void;
  setInputMode: (mode: NarrativeInputBundle["inputMode"]) => void;
  lockNarrative: () => Promise<boolean>;
  unlockNarrative: () => Promise<void>;
  teardown: () => void;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `disc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function useDiscoverySession(
  config: UseDiscoverySessionConfig
): UseDiscoverySessionReturn {
  const { workId, operatorId } = config;

  const sessionIdRef = useRef(createSessionId());
  const [session, setSession] = useState<DiscoverySession>(() =>
    createDiscoverySession(workId, operatorId, sessionIdRef.current)
  );
  const [gateFlags, setGateFlags] = useState<NarrativeGateFlags>({});
  const [sessionConflict, setSessionConflict] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [lockError, setLockError] = useState<LockNarrativeError | null>(null);

  const gateResult = useMemo(
    () =>
      validateNarrativeGate({
        ...session.narrative,
        ...gateFlags,
      }),
    [session.narrative, gateFlags]
  );

  const minProseRequired =
    session.narrative.inputMode === "approved_summary"
      ? APPROVED_SUMMARY_MIN_PROSE
      : EXCERPT_BUNDLE_MIN_PROSE;

  useEffect(() => {
    if (!operatorId) {
      return;
    }
    sessionIdRef.current = createSessionId();
    setSession(
      createDiscoverySession(workId, operatorId, sessionIdRef.current)
    );
    setGateFlags({});
    setLockError(null);
    setSessionConflict(false);
  }, [workId, operatorId]);

  useEffect(() => {
    if (!workId || !operatorId) {
      return;
    }

    const storageKey = getDiscoverySessionStorageKey(workId, operatorId);

    const syncConflict = () => {
      if (
        hasClientSessionConflict(workId, operatorId, sessionIdRef.current)
      ) {
        setSessionConflict(true);
      }
    };

    const claim = claimClientSession(workId, operatorId, sessionIdRef.current);
    if (!claim.ok) {
      setSessionConflict(true);
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        syncConflict();
      }
    };

    window.addEventListener("storage", onStorage);

    const releaseOnPageHide = () => {
      releaseClientSession(workId, operatorId, sessionIdRef.current);
    };
    window.addEventListener("pagehide", releaseOnPageHide);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", releaseOnPageHide);
      releaseClientSession(workId, operatorId, sessionIdRef.current);
    };
  }, [workId, operatorId]);

  const teardown = useCallback(() => {
    releaseClientSession(workId, operatorId, sessionIdRef.current);
    sessionIdRef.current = createSessionId();
    setSession(createDiscoverySession(workId, operatorId, sessionIdRef.current));
    setGateFlags({});
    setLockError(null);
    setSessionConflict(false);
    claimClientSession(workId, operatorId, sessionIdRef.current);
  }, [workId, operatorId]);

  const updateNarrative = useCallback(
    (narrative: NarrativeInputBundle) => {
      if (!isNarrativeEditable(session)) {
        return;
      }
      setLockError(null);
      setSession((prev) => ({ ...prev, narrative }));
    },
    [session]
  );

  const setInputMode = useCallback(
    (mode: NarrativeInputBundle["inputMode"]) => {
      setSession((prev) => {
        if (!isNarrativeEditable(prev)) {
          return prev;
        }
        const nextNarrative = switchNarrativeInputMode(prev.narrative, mode);
        if (nextNarrative === prev.narrative) {
          return prev;
        }
        return { ...prev, narrative: nextNarrative };
      });
      setGateFlags({});
      setLockError(null);
    },
    []
  );

  const lockNarrative = useCallback(async (): Promise<boolean> => {
    if (!isNarrativeEditable(session) || sessionConflict) {
      return false;
    }

    const localGate = validateNarrativeGate({
      ...session.narrative,
      ...gateFlags,
    });

    if (!localGate.pass) {
      setLockError({
        code: "NARRATIVE_GATE_FAILED",
        message: "Narrative gate validation failed",
        failures: localGate.failures,
      });
      return false;
    }

    setIsLocking(true);
    setLockError(null);

    try {
      const res = await fetch("/api/admin/discovery/session/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId,
          sessionId: session.sessionId,
          narrative: session.narrative,
          catalogOnly: gateFlags.catalogOnly,
          runtimeExportOnly: gateFlags.runtimeExportOnly,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: LockNarrativeError;
        lockedAt?: string;
        narrative?: NarrativeInputBundle;
      };

      if (!res.ok) {
        setLockError(
          body.error ?? {
            code: "LOCK_FAILED",
            message: `Lock failed (HTTP ${res.status})`,
          }
        );
        return false;
      }

      setGateFlags({});
      setSession((prev) => ({
        ...prev,
        state: "narrative_locked",
        lockedAt: body.lockedAt ?? new Date().toISOString(),
        narrative: body.narrative ?? prev.narrative,
      }));
      return true;
    } catch {
      setLockError({
        code: "NETWORK_ERROR",
        message: "Failed to reach Discovery lock endpoint",
      });
      return false;
    } finally {
      setIsLocking(false);
    }
  }, [session, sessionConflict, workId, gateFlags]);

  const unlockNarrative = useCallback(async () => {
    if (session.state !== "narrative_locked") {
      return;
    }

    try {
      await fetch("/api/admin/discovery/session/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId,
          sessionId: session.sessionId,
        }),
      });
    } catch {
      // Client unlock still proceeds — server registry is best-effort in v1
    }

    setSession((prev) => ({
      ...prev,
      state: "draft",
      lockedAt: null,
    }));
    setLockError(null);
  }, [session.sessionId, session.state, workId]);

  return {
    session,
    gateResult,
    gateFlags,
    setGateFlags,
    sessionConflict,
    isLocking,
    lockError,
    canPropose: canStartPropose(session),
    minProseRequired,
    updateNarrative,
    setInputMode,
    lockNarrative,
    unlockNarrative,
    teardown,
  };
}
