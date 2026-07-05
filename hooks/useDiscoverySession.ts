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
  getStoredClientSessionId,
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
import type {
  DiscoveryCandidate,
  DiscoveryCandidateType,
  ProposeTypeError,
  SceneCandidateFields,
  StoryCandidateFields,
} from "@/lib/discovery/propose-types";
import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
  AcceptReviewError,
  AcceptReviewResult,
  DiscoveryReviewItem,
} from "@/lib/discovery/review-types";
import {
  createReviewItems,
  discardReviewItem,
  findReviewDuplicateCandidate,
  findReviewItem,
  getActiveReviewItems,
  getEffectiveCandidate,
  getSiblingCandidatesForRegen,
  hasPendingReviewItems,
  markReviewAccepted,
  prepareAcceptReview,
  replaceReviewCandidate,
  revokeReviewAccept,
  saveReviewEdit,
  buildAcceptPrefill,
  buildStoryStaging,
  buildSceneStaging,
  type ReviewEditPayload,
} from "@/lib/discovery/review-state";
import { storeDiscoveryAcceptPrefill } from "@/lib/discovery/accept-prefill";
import {
  appendSceneStagingToRolloutQueue,
  appendStoryStagingToRolloutQueue,
  removeSceneStagingFromRolloutQueue,
  removeStoryStagingFromRolloutQueue,
  updateSceneStagingInRolloutQueue,
  updateStoryStagingInRolloutQueue,
} from "@/lib/rollout/sync-discovery-staging";
import {
  clearDiscoveryReviewSnapshot,
  loadDiscoveryReviewSnapshot,
  saveDiscoveryReviewSnapshot,
} from "@/lib/discovery/review-session-storage";

export interface UseDiscoverySessionConfig {
  workId: string;
  operatorId: string;
}

export interface LockNarrativeError {
  code: string;
  message: string;
  failures?: NarrativeGateResult["failures"];
}

export interface ProposeError {
  code: string;
  message: string;
  errors?: ProposeTypeError[];
}

export interface RegenError {
  code: string;
  message: string;
}

export interface UseDiscoverySessionReturn {
  workId: string;
  operatorId: string;
  session: DiscoverySession;
  gateResult: NarrativeGateResult;
  gateFlags: NarrativeGateFlags;
  setGateFlags: (flags: NarrativeGateFlags) => void;
  sessionConflict: boolean;
  isLocking: boolean;
  lockError: LockNarrativeError | null;
  canPropose: boolean;
  isProposing: boolean;
  proposeError: ProposeError | null;
  candidates: DiscoveryCandidate[];
  reviewItems: DiscoveryReviewItem[];
  activeReviewItems: DiscoveryReviewItem[];
  acceptedStoryUnits: AcceptedStoryUnitStaging[];
  acceptedSceneCandidates: AcceptedSceneCandidateStaging[];
  isRegening: boolean;
  regenReviewId: string | null;
  regenError: RegenError | null;
  retryingType: DiscoveryCandidateType | null;
  retryTypeError: RegenError | null;
  acceptError: AcceptReviewError | null;
  minProseRequired: number;
  updateNarrative: (narrative: NarrativeInputBundle) => void;
  setInputMode: (mode: NarrativeInputBundle["inputMode"]) => void;
  lockNarrative: () => Promise<boolean>;
  unlockNarrative: () => Promise<void>;
  startPropose: () => Promise<boolean>;
  startFullRePropose: () => Promise<boolean>;
  discardCandidate: (reviewId: string) => void;
  revokeStagingAccept: (
    sourceReviewId: string,
    kind: "story" | "scene"
  ) => void;
  saveCandidateEdit: (reviewId: string, edit: ReviewEditPayload) => void;
  saveStoryStagingEdit: (
    sourceReviewId: string,
    edit: ReviewEditPayload
  ) => void;
  saveSceneStagingEdit: (
    sourceReviewId: string,
    edit: ReviewEditPayload
  ) => void;
  regenCandidate: (reviewId: string, feedback?: string | null) => Promise<boolean>;
  retryProposeType: (
    candidateType: DiscoveryCandidateType,
    feedback?: string | null
  ) => Promise<boolean>;
  acceptCandidate: (
    reviewId: string
  ) => AcceptReviewResult | AcceptReviewError;
  teardown: () => void;
}

function partialProposeFailureMessage(errors: ProposeTypeError[]): string {
  return `部分类型生成失败（${errors.map((e) => e.candidateType).join("、")}），其余 Candidate 已展示`;
}

function mergePartialProposeErrors(
  previous: ProposeTypeError[] | undefined,
  candidateType: DiscoveryCandidateType,
  nextTypeError?: ProposeTypeError
): ProposeTypeError[] {
  const withoutRetried = (previous ?? []).filter(
    (error) => error.candidateType !== candidateType
  );
  if (nextTypeError) {
    return [...withoutRetried, nextTypeError];
  }
  return withoutRetried;
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
  const [isProposing, setIsProposing] = useState(false);
  const [proposeError, setProposeError] = useState<ProposeError | null>(null);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [reviewItems, setReviewItems] = useState<DiscoveryReviewItem[]>([]);
  const [acceptedStoryUnits, setAcceptedStoryUnits] = useState<
    AcceptedStoryUnitStaging[]
  >([]);
  const [acceptedSceneCandidates, setAcceptedSceneCandidates] = useState<
    AcceptedSceneCandidateStaging[]
  >([]);
  const [isRegening, setIsRegening] = useState(false);
  const [regenReviewId, setRegenReviewId] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<RegenError | null>(null);
  const [retryingType, setRetryingType] = useState<DiscoveryCandidateType | null>(
    null
  );
  const [retryTypeError, setRetryTypeError] = useState<RegenError | null>(null);
  const [acceptError, setAcceptError] = useState<AcceptReviewError | null>(null);

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

  const sessionPairRef = useRef<string | null>(null);

  useEffect(() => {
    if (!operatorId) {
      return;
    }
    const pair = `${workId}:${operatorId}`;
    if (sessionPairRef.current !== pair) {
      sessionPairRef.current = pair;
      const storedSessionId = getStoredClientSessionId(workId, operatorId);
      sessionIdRef.current = storedSessionId ?? createSessionId();
    }
    const snapshot = loadDiscoveryReviewSnapshot(
      workId,
      operatorId,
      sessionIdRef.current
    );

    if (snapshot) {
      setSession(snapshot.session);
      setCandidates(snapshot.candidates);
      setReviewItems(snapshot.reviewItems);
      setAcceptedStoryUnits(snapshot.acceptedStoryUnits);
      setAcceptedSceneCandidates(snapshot.acceptedSceneCandidates);
    } else {
      setSession(
        createDiscoverySession(workId, operatorId, sessionIdRef.current)
      );
      setCandidates([]);
      setReviewItems([]);
      setAcceptedStoryUnits([]);
      setAcceptedSceneCandidates([]);
    }
    setGateFlags({});
    setLockError(null);
    setProposeError(null);
    setRegenError(null);
    setAcceptError(null);
    setSessionConflict(false);
  }, [workId, operatorId]);

  useEffect(() => {
    if (!workId || !operatorId) {
      return;
    }

    const hasReviewProgress =
      reviewItems.length > 0 ||
      session.state === "review_pending" ||
      acceptedStoryUnits.length > 0 ||
      acceptedSceneCandidates.length > 0;

    if (!hasReviewProgress) {
      clearDiscoveryReviewSnapshot(workId, operatorId, session.sessionId);
      return;
    }

    saveDiscoveryReviewSnapshot({
      sessionId: session.sessionId,
      workId,
      operatorId,
      session,
      candidates,
      reviewItems,
      acceptedStoryUnits,
      acceptedSceneCandidates,
      savedAt: new Date().toISOString(),
    });
  }, [
    workId,
    operatorId,
    session,
    candidates,
    reviewItems,
    acceptedStoryUnits,
    acceptedSceneCandidates,
  ]);

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
    };
  }, [workId, operatorId]);

  const teardown = useCallback(() => {
    clearDiscoveryReviewSnapshot(workId, operatorId, sessionIdRef.current);
    releaseClientSession(workId, operatorId, sessionIdRef.current);
    sessionIdRef.current = createSessionId();
    setSession(createDiscoverySession(workId, operatorId, sessionIdRef.current));
    setGateFlags({});
    setLockError(null);
    setProposeError(null);
    setCandidates([]);
    setReviewItems([]);
    setAcceptedStoryUnits([]);
    setAcceptedSceneCandidates([]);
    setRegenError(null);
    setAcceptError(null);
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

    const requestLock = async (): Promise<Response> =>
      fetch("/api/admin/discovery/session/lock", {
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

    try {
      let res = await requestLock();

      let body = (await res.json().catch(() => ({}))) as {
        error?: LockNarrativeError;
        lockedAt?: string;
        narrative?: NarrativeInputBundle;
      };

      if (
        !res.ok &&
        res.status === 409 &&
        body.error?.code === "SESSION_ALREADY_ACTIVE" &&
        !sessionConflict
      ) {
        await fetch("/api/admin/discovery/session/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workId }),
        });
        res = await requestLock();
        body = (await res.json().catch(() => ({}))) as typeof body;
      }

      if (!res.ok) {
        setLockError(
          body.error ?? {
            code: "LOCK_FAILED",
            message: `Lock failed (HTTP ${res.status})`,
          }
        );
        return false;
      }

      claimClientSession(workId, operatorId, session.sessionId);
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
  }, [session, sessionConflict, workId, operatorId, gateFlags]);

  const unlockNarrative = useCallback(async () => {
    if (
      session.state !== "narrative_locked" &&
      session.state !== "review_pending"
    ) {
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

    clearDiscoveryReviewSnapshot(workId, operatorId, session.sessionId);

    setSession((prev) => ({
      ...prev,
      state: "draft",
      lockedAt: null,
    }));
    setLockError(null);
    setProposeError(null);
    setCandidates([]);
    setReviewItems([]);
    setAcceptedStoryUnits([]);
    setAcceptedSceneCandidates([]);
    setRegenError(null);
    setAcceptError(null);
  }, [session.sessionId, session.state, workId, operatorId]);

  const startPropose = useCallback(async (): Promise<boolean> => {
    if (!canStartPropose(session) || sessionConflict || isProposing) {
      return false;
    }
    if (!session.lockedAt) {
      setProposeError({
        code: "NARRATIVE_NOT_LOCKED",
        message: "Narrative must be locked before propose",
      });
      return false;
    }

    setIsProposing(true);
    setProposeError(null);
    setSession((prev) => ({ ...prev, state: "proposing" }));

    try {
      const res = await fetch("/api/admin/discovery/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId,
          sessionId: session.sessionId,
          narrative: session.narrative,
          lockedAt: session.lockedAt,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: ProposeError & { errors?: ProposeTypeError[] };
        candidates?: DiscoveryCandidate[];
        errors?: ProposeTypeError[];
      };

      if (!res.ok) {
        setProposeError(
          body.error ?? {
            code: "PROPOSE_FAILED",
            message: `Propose failed (HTTP ${res.status})`,
          }
        );
        setSession((prev) => ({
          ...prev,
          state: prev.state === "proposing" ? "narrative_locked" : prev.state,
        }));
        return false;
      }

      setCandidates(body.candidates ?? []);
      setReviewItems(createReviewItems(body.candidates ?? []));
      setSession((prev) => ({ ...prev, state: "review_pending" }));
      if (body.errors?.length) {
        setProposeError({
          code: "PARTIAL_PROPOSE_FAILURE",
          message: partialProposeFailureMessage(body.errors),
          errors: body.errors,
        });
      } else {
        setProposeError(null);
      }
      return true;
    } catch {
      setProposeError({
        code: "NETWORK_ERROR",
        message: "Failed to reach Discovery propose endpoint",
      });
      setSession((prev) => ({
        ...prev,
        state: prev.state === "proposing" ? "narrative_locked" : prev.state,
      }));
      return false;
    } finally {
      setIsProposing(false);
    }
  }, [
    session,
    sessionConflict,
    isProposing,
    workId,
  ]);

  const startFullRePropose = useCallback(async (): Promise<boolean> => {
    return startPropose();
  }, [startPropose]);

  const discardCandidate = useCallback((reviewId: string) => {
    setAcceptError(null);
    setReviewItems((prev) => discardReviewItem(prev, reviewId));
  }, []);

  const revokeStagingAccept = useCallback(
    (sourceReviewId: string, kind: "story" | "scene") => {
      setAcceptError(null);
      setReviewItems((prev) => revokeReviewAccept(prev, sourceReviewId));
      if (kind === "story") {
        setAcceptedStoryUnits((prev) =>
          prev.filter((unit) => unit.sourceReviewId !== sourceReviewId)
        );
        removeStoryStagingFromRolloutQueue(workId, operatorId, sourceReviewId);
      } else {
        setAcceptedSceneCandidates((prev) =>
          prev.filter((scene) => scene.sourceReviewId !== sourceReviewId)
        );
        removeSceneStagingFromRolloutQueue(workId, operatorId, sourceReviewId);
      }
    },
    [workId, operatorId]
  );

  const saveCandidateEdit = useCallback(
    (reviewId: string, edit: ReviewEditPayload) => {
      setAcceptError(null);
      setReviewItems((prev) => {
        const next = saveReviewEdit(prev, reviewId, edit);
        const item = findReviewItem(next, reviewId);
        if (item?.status === "accepted") {
          const candidateType = item.candidate.candidateType;
          if (candidateType === "character" || candidateType === "location") {
            storeDiscoveryAcceptPrefill(
              buildAcceptPrefill(item, candidateType)
            );
          } else if (candidateType === "story") {
            const staging = buildStoryStaging(item);
            setAcceptedStoryUnits((units) =>
              units.map((unit) =>
                unit.sourceReviewId === reviewId ? staging : unit
              )
            );
            updateStoryStagingInRolloutQueue(workId, operatorId, staging);
          } else if (candidateType === "scene") {
            const staging = buildSceneStaging(item);
            setAcceptedSceneCandidates((scenes) =>
              scenes.map((scene) =>
                scene.sourceReviewId === reviewId ? staging : scene
              )
            );
            updateSceneStagingInRolloutQueue(workId, operatorId, staging);
          }
        }
        return next;
      });
    },
    [workId, operatorId]
  );

  const saveStoryStagingEdit = useCallback(
    (sourceReviewId: string, edit: ReviewEditPayload) => {
      setAcceptError(null);
      const item = findReviewItem(reviewItems, sourceReviewId);
      if (item) {
        saveCandidateEdit(sourceReviewId, edit);
        return;
      }
      const storyFields = edit.editedFields as StoryCandidateFields;
      const staging: AcceptedStoryUnitStaging = {
        workId,
        sourceReviewId,
        title: storyFields.title.trim(),
        summary: storyFields.summary.trim(),
        ...(typeof storyFields.boundaryHint === "string" &&
        storyFields.boundaryHint.trim()
          ? { boundaryHint: storyFields.boundaryHint.trim() }
          : {}),
        acceptedAt: new Date().toISOString(),
      };
      setAcceptedStoryUnits((prev) =>
        prev.map((unit) =>
          unit.sourceReviewId === sourceReviewId ? staging : unit
        )
      );
      updateStoryStagingInRolloutQueue(workId, operatorId, staging);
    },
    [reviewItems, saveCandidateEdit, workId, operatorId]
  );

  const saveSceneStagingEdit = useCallback(
    (sourceReviewId: string, edit: ReviewEditPayload) => {
      setAcceptError(null);
      const item = findReviewItem(reviewItems, sourceReviewId);
      if (item) {
        saveCandidateEdit(sourceReviewId, edit);
        return;
      }
      const sceneFields = edit.editedFields as SceneCandidateFields;
      const staging: AcceptedSceneCandidateStaging = {
        workId,
        sourceReviewId,
        chapter_title: sceneFields.chapter_title ?? null,
        chapter_number: sceneFields.chapter_number,
        title: sceneFields.title.trim(),
        ...(typeof sceneFields.summary === "string" && sceneFields.summary.trim()
          ? { summary: sceneFields.summary.trim() }
          : {}),
        acceptedAt: new Date().toISOString(),
      };
      setAcceptedSceneCandidates((prev) =>
        prev.map((scene) =>
          scene.sourceReviewId === sourceReviewId ? staging : scene
        )
      );
      updateSceneStagingInRolloutQueue(workId, operatorId, staging);
    },
    [reviewItems, saveCandidateEdit, workId, operatorId]
  );

  const regenCandidate = useCallback(
    async (reviewId: string, feedback?: string | null): Promise<boolean> => {
      const item = findReviewItem(reviewItems, reviewId);
      if (!item || !session.lockedAt || sessionConflict || isRegening) {
        return false;
      }

      setIsRegening(true);
      setRegenReviewId(reviewId);
      setRegenError(null);

      try {
        const siblingCandidates = getSiblingCandidatesForRegen(
          reviewItems,
          reviewId
        );
        const previousCandidate = getEffectiveCandidate(item);

        const res = await fetch("/api/admin/discovery/propose/regen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            sessionId: session.sessionId,
            narrative: session.narrative,
            lockedAt: session.lockedAt,
            candidateType: previousCandidate.candidateType,
            previousCandidate,
            siblingCandidates,
            feedback: feedback ?? null,
          }),
        });

        const body = (await res.json().catch(() => ({}))) as {
          error?: RegenError;
          candidate?: DiscoveryCandidate;
        };

        if (!res.ok || !body.candidate) {
          setRegenError(
            body.error ?? {
              code: "REGEN_FAILED",
              message: `Regen failed (HTTP ${res.status})`,
            }
          );
          return false;
        }

        const duplicate = findReviewDuplicateCandidate(
          body.candidate,
          reviewItems,
          reviewId
        );
        if (duplicate) {
          setRegenError({
            code: "REGEN_DUPLICATE",
            message:
              "Regenerated candidate duplicates another item in this review session. Add feedback and try again.",
          });
          return false;
        }

        setReviewItems((prev) =>
          replaceReviewCandidate(prev, reviewId, body.candidate!)
        );
        setCandidates((prev) =>
          prev.map((candidate) =>
            candidate.candidateId === item.candidate.candidateId
              ? body.candidate!
              : candidate
          )
        );
        return true;
      } catch {
        setRegenError({
          code: "NETWORK_ERROR",
          message: "Failed to reach Discovery regen endpoint",
        });
        return false;
      } finally {
        setIsRegening(false);
        setRegenReviewId(null);
      }
    },
    [
      reviewItems,
      session,
      sessionConflict,
      isRegening,
      workId,
    ]
  );

  const retryProposeType = useCallback(
    async (
      candidateType: DiscoveryCandidateType,
      feedback?: string | null
    ): Promise<boolean> => {
      if (
        session.state !== "review_pending" ||
        !session.lockedAt ||
        sessionConflict ||
        isProposing ||
        isRegening ||
        retryingType
      ) {
        return false;
      }

      setRetryingType(candidateType);
      setRetryTypeError(null);

      try {
        const res = await fetch("/api/admin/discovery/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            sessionId: session.sessionId,
            narrative: session.narrative,
            lockedAt: session.lockedAt,
            candidateTypes: [candidateType],
            feedback: feedback ?? null,
          }),
        });

        const body = (await res.json().catch(() => ({}))) as {
          error?: ProposeError & { errors?: ProposeTypeError[] };
          candidates?: DiscoveryCandidate[];
          errors?: ProposeTypeError[];
        };

        if (!res.ok) {
          setRetryTypeError({
            code: body.error?.code ?? "TYPE_RETRY_FAILED",
            message:
              body.error?.message ?? `Type retry failed (HTTP ${res.status})`,
          });
          return false;
        }

        const newCandidates = (body.candidates ?? []).filter(
          (candidate) => candidate.candidateType === candidateType
        );

        if (newCandidates.length === 0) {
          const typeError =
            body.errors?.find((error) => error.candidateType === candidateType) ??
            body.errors?.[0];
          setRetryTypeError({
            code: typeError?.code ?? "TYPE_RETRY_FAILED",
            message:
              typeError?.message ??
              `${candidateType} propose produced no candidates`,
          });
          setProposeError((prev) => {
            const merged = mergePartialProposeErrors(
              prev?.errors,
              candidateType,
              typeError ?? {
                candidateType,
                code: "GENERATION_FAILED",
                message: `${candidateType} propose produced no candidates`,
              }
            );
            if (merged.length === 0) {
              return null;
            }
            return {
              code: "PARTIAL_PROPOSE_FAILURE",
              message: partialProposeFailureMessage(merged),
              errors: merged,
            };
          });
          return false;
        }

        const newItems = createReviewItems(newCandidates);
        setCandidates((prev) => [...prev, ...newCandidates]);
        setReviewItems((prev) => [...prev, ...newItems]);
        setProposeError((prev) => {
          const merged = mergePartialProposeErrors(prev?.errors, candidateType);
          if (merged.length === 0) {
            return null;
          }
          return {
            code: "PARTIAL_PROPOSE_FAILURE",
            message: partialProposeFailureMessage(merged),
            errors: merged,
          };
        });
        return true;
      } catch {
        setRetryTypeError({
          code: "NETWORK_ERROR",
          message: "Failed to reach Discovery propose endpoint",
        });
        return false;
      } finally {
        setRetryingType(null);
      }
    },
    [
      session,
      sessionConflict,
      isProposing,
      isRegening,
      retryingType,
      workId,
    ]
  );

  const acceptCandidate = useCallback(
    (reviewId: string): AcceptReviewResult | AcceptReviewError => {
      const result = prepareAcceptReview(reviewItems, reviewId);
      if (!result.ok) {
        setAcceptError(result);
        return result;
      }

      setAcceptError(null);
      setReviewItems((prev) => markReviewAccepted(prev, reviewId));

      if (result.kind === "entity_prefill") {
        storeDiscoveryAcceptPrefill(result.prefill);
      } else if (result.kind === "story_staging") {
        setAcceptedStoryUnits((prev) => [...prev, result.staging]);
        appendStoryStagingToRolloutQueue(workId, operatorId, result.staging);
      } else if (result.kind === "scene_staging") {
        setAcceptedSceneCandidates((prev) => [...prev, result.staging]);
        appendSceneStagingToRolloutQueue(workId, operatorId, result.staging);
      }

      return result;
    },
    [reviewItems, workId, operatorId]
  );

  const activeReviewItems = useMemo(
    () => getActiveReviewItems(reviewItems),
    [reviewItems]
  );

  return {
    workId,
    operatorId,
    session,
    gateResult,
    gateFlags,
    setGateFlags,
    sessionConflict,
    isLocking,
    lockError,
    canPropose:
      canStartPropose(session) && !isProposing && !isRegening && !retryingType,
    isProposing,
    proposeError,
    candidates,
    reviewItems,
    activeReviewItems,
    acceptedStoryUnits,
    acceptedSceneCandidates,
    isRegening,
    regenReviewId,
    regenError,
    retryingType,
    retryTypeError,
    acceptError,
    minProseRequired,
    updateNarrative,
    setInputMode,
    lockNarrative,
    unlockNarrative,
    startPropose,
    startFullRePropose,
    discardCandidate,
    revokeStagingAccept,
    saveCandidateEdit,
    saveStoryStagingEdit,
    saveSceneStagingEdit,
    regenCandidate,
    retryProposeType,
    acceptCandidate,
    teardown,
  };
}
