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
  ProposeError,
  ProposeTypeError,
  SceneCandidateFields,
  StoryCandidateFields,
} from "@/lib/discovery/propose-types";
import { discoveryComposerUi } from "@/lib/discovery/ui-copy";
import type {
  AcceptedCharacterStaging,
  AcceptedLocationStaging,
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
  AcceptReviewError,
  AcceptReviewResult,
  DiscoveryReviewItem,
} from "@/lib/discovery/review-types";
import {
  granularityContextRequired,
  type GranularityGateResult,
} from "@/lib/discovery/granularity-gate";
import type { RequiredUnitAuthorityContext } from "@/lib/discovery/required-unit-authority";
import {
  createReviewItems,
  discardReviewItem,
  evaluateGranularityForReviewItems,
  evaluateInformationEquivalenceReviewView,
  findReviewDuplicateCandidate,
  findReviewItem,
  getActiveReviewItems,
  getEffectiveCandidate,
  getSiblingCandidatesForRegen,
  hasPendingReviewItems,
  markReviewAccepted,
  prepareAcceptReview,
  prepareAcceptStoryWithChildScenes,
  replaceReviewCandidate,
  replaceSceneWithSplitBeats,
  revokeReviewAccept,
  saveReviewEdit,
  buildAcceptPrefill,
  buildCharacterStaging,
  buildLocationStaging,
  buildStoryStaging,
  buildSceneStaging,
  getChildSceneReviewIdsForStory,
  findAcceptedParentStory,
  characterStagingFromAcceptedReviewItems,
  locationStagingFromAcceptedReviewItems,
  type InformationEquivalenceReviewView,
  type ReviewEditPayload,
} from "@/lib/discovery/review-state";
import { storeDiscoveryAcceptPrefill } from "@/lib/discovery/accept-prefill";
import * as charactersApi from "@/lib/characters";
import * as locationsApi from "@/lib/locations";
import {
  appendCharacterStagingToRolloutQueue,
  appendLocationStagingToRolloutQueue,
  appendSceneStagingToRolloutQueue,
  appendStoryStagingToRolloutQueue,
  removeCharacterStagingFromRolloutQueue,
  removeLocationStagingFromRolloutQueue,
  removeSceneStagingFromRolloutQueue,
  removeStoryStagingFromRolloutQueue,
  updateCharacterStagingInRolloutQueue,
  updateLocationStagingInRolloutQueue,
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
  /**
   * Optional caller-supplied Work Canon + per-Story Bind (spike / tests).
   * Production Discovery does not pass this. Omitting it does not block Accept.
   * Incomplete bind still blocks with AUTHORITY_BIND_INCOMPLETE if Canon is supplied.
   */
  requiredUnitAuthority?: RequiredUnitAuthorityContext;
}

export interface LockNarrativeError {
  code: string;
  message: string;
  failures?: NarrativeGateResult["failures"];
}

export type { ProposeError };

export interface RegenError {
  code: string;
  message: string;
}

function withOperatorFacingMessage<T extends { code: string; message: string }>(
  error: T
): T {
  if (error.code === "NARRATIVE_NOT_LOCKED") {
    return { ...error, message: discoveryComposerUi.narrativeLockLost };
  }
  return error;
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
  acceptedCharacters: AcceptedCharacterStaging[];
  acceptedLocations: AcceptedLocationStaging[];
  isRegening: boolean;
  regenReviewId: string | null;
  regenError: RegenError | null;
  isSplitting: boolean;
  splitError: RegenError | null;
  retryingType: DiscoveryCandidateType | null;
  retryTypeError: RegenError | null;
  acceptError: AcceptReviewError | null;
  granularityGate: GranularityGateResult | null;
  informationEquivalence: InformationEquivalenceReviewView | null;
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
    kind: "story" | "scene" | "character" | "location"
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
  splitSceneIntoBeats: (
    sourceReviewId: string,
    beats: Array<{ title: string; summary: string }>
  ) => Promise<boolean>;
  regenCandidate: (reviewId: string, feedback?: string | null) => Promise<boolean>;
  retryProposeType: (
    candidateType: DiscoveryCandidateType,
    feedback?: string | null
  ) => Promise<boolean>;
  acceptCandidate: (
    reviewId: string
  ) => Promise<AcceptReviewResult | AcceptReviewError>;
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
  const { workId, operatorId, requiredUnitAuthority } = config;

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
  const [acceptedCharacters, setAcceptedCharacters] = useState<
    AcceptedCharacterStaging[]
  >([]);
  const [acceptedLocations, setAcceptedLocations] = useState<
    AcceptedLocationStaging[]
  >([]);
  const [isRegening, setIsRegening] = useState(false);
  const [regenReviewId, setRegenReviewId] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<RegenError | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitError, setSplitError] = useState<RegenError | null>(null);
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
      setAcceptedCharacters(
        snapshot.acceptedCharacters && snapshot.acceptedCharacters.length > 0
          ? snapshot.acceptedCharacters
          : characterStagingFromAcceptedReviewItems(snapshot.reviewItems)
      );
      setAcceptedLocations(
        snapshot.acceptedLocations && snapshot.acceptedLocations.length > 0
          ? snapshot.acceptedLocations
          : locationStagingFromAcceptedReviewItems(snapshot.reviewItems)
      );
      setProposeError(snapshot.proposeError ?? null);
    } else {
      setSession(
        createDiscoverySession(workId, operatorId, sessionIdRef.current)
      );
      setCandidates([]);
      setReviewItems([]);
      setAcceptedStoryUnits([]);
      setAcceptedSceneCandidates([]);
      setAcceptedCharacters([]);
      setAcceptedLocations([]);
      setProposeError(null);
    }
    setGateFlags({});
    setLockError(null);
    setRegenError(null);
    setSplitError(null);
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
      acceptedSceneCandidates.length > 0 ||
      acceptedCharacters.length > 0 ||
      acceptedLocations.length > 0 ||
      (proposeError?.errors?.length ?? 0) > 0;

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
      acceptedCharacters,
      acceptedLocations,
      proposeError,
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
    acceptedCharacters,
    acceptedLocations,
    proposeError,
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
    setSplitError(null);
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
    setSplitError(null);
    setAcceptError(null);
  }, [session.sessionId, session.state, workId, operatorId]);

  const startPropose = useCallback(async (): Promise<boolean> => {
    if (!canStartPropose(session) || sessionConflict || isProposing) {
      return false;
    }
    if (!session.lockedAt) {
      setProposeError({
        code: "NARRATIVE_NOT_LOCKED",
        message: discoveryComposerUi.narrativeLockLost,
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
          withOperatorFacingMessage(
            body.error ?? {
              code: "PROPOSE_FAILED",
              message: `Propose failed (HTTP ${res.status})`,
            }
          )
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
    (sourceReviewId: string, kind: "story" | "scene" | "character" | "location") => {
      setAcceptError(null);
      if (kind === "character") {
        setReviewItems((prev) => revokeReviewAccept(prev, sourceReviewId));
        setAcceptedCharacters((prev) =>
          prev.filter((item) => item.sourceReviewId !== sourceReviewId)
        );
        removeCharacterStagingFromRolloutQueue(
          workId,
          operatorId,
          sourceReviewId
        );
        return;
      }
      if (kind === "location") {
        setReviewItems((prev) => revokeReviewAccept(prev, sourceReviewId));
        setAcceptedLocations((prev) =>
          prev.filter((item) => item.sourceReviewId !== sourceReviewId)
        );
        removeLocationStagingFromRolloutQueue(
          workId,
          operatorId,
          sourceReviewId
        );
        return;
      }
      if (kind === "story") {
        const revokedStory = acceptedStoryUnits.find(
          (unit) => unit.sourceReviewId === sourceReviewId
        );
        const childSceneReviewIds = getChildSceneReviewIdsForStory(
          reviewItems,
          sourceReviewId
        );
        const childFromStaging = acceptedSceneCandidates
          .filter((s) => s.parentStorySourceReviewId === sourceReviewId)
          .map((s) => s.sourceReviewId);
        const allChildIds = [
          ...new Set([...childSceneReviewIds, ...childFromStaging]),
        ];
        const relatedEntityIds = [
          ...(revokedStory?.relatedCharacterRefs ?? []).map(
            (r) => r.sourceReviewId
          ),
          ...(revokedStory?.relatedLocationRefs ?? []).map(
            (r) => r.sourceReviewId
          ),
        ];
        const remainingStories = acceptedStoryUnits.filter(
          (unit) => unit.sourceReviewId !== sourceReviewId
        );
        const stillNeededEntityIds = new Set(
          remainingStories.flatMap((unit) => [
            ...(unit.relatedCharacterRefs ?? []).map((r) => r.sourceReviewId),
            ...(unit.relatedLocationRefs ?? []).map((r) => r.sourceReviewId),
          ])
        );
        const entityIdsToRevoke = relatedEntityIds.filter(
          (id) => !stillNeededEntityIds.has(id)
        );

        setReviewItems((prev) => {
          let next = revokeReviewAccept(prev, sourceReviewId);
          for (const childId of allChildIds) {
            next = revokeReviewAccept(next, childId);
          }
          for (const entityId of entityIdsToRevoke) {
            next = revokeReviewAccept(next, entityId);
          }
          return next;
        });
        setAcceptedStoryUnits((prev) =>
          prev.filter((unit) => unit.sourceReviewId !== sourceReviewId)
        );
        setAcceptedSceneCandidates((prev) =>
          prev.filter(
            (scene) => scene.parentStorySourceReviewId !== sourceReviewId
          )
        );
        removeStoryStagingFromRolloutQueue(workId, operatorId, sourceReviewId);
        for (const childId of allChildIds) {
          removeSceneStagingFromRolloutQueue(workId, operatorId, childId);
        }
      } else {
        setReviewItems((prev) => revokeReviewAccept(prev, sourceReviewId));
        setAcceptedSceneCandidates((prev) =>
          prev.filter((scene) => scene.sourceReviewId !== sourceReviewId)
        );
        removeSceneStagingFromRolloutQueue(workId, operatorId, sourceReviewId);
      }
    },
    [
      workId,
      operatorId,
      reviewItems,
      acceptedSceneCandidates,
      acceptedStoryUnits,
    ]
  );

  const saveCandidateEdit = useCallback(
    (reviewId: string, edit: ReviewEditPayload) => {
      setAcceptError(null);
      setReviewItems((prev) => {
        const next = saveReviewEdit(prev, reviewId, edit);
        const item = findReviewItem(next, reviewId);
        if (item?.status === "accepted") {
          const candidateType = item.candidate.candidateType;
          if (candidateType === "character") {
            const staging = buildCharacterStaging(item);
            setAcceptedCharacters((units) => {
              const index = units.findIndex(
                (unit) => unit.sourceReviewId === reviewId
              );
              if (index === -1) return [...units, staging];
              return units.map((unit, i) => (i === index ? staging : unit));
            });
            updateCharacterStagingInRolloutQueue(workId, operatorId, staging);
          } else if (candidateType === "location") {
            const staging = buildLocationStaging(item);
            setAcceptedLocations((units) => {
              const index = units.findIndex(
                (unit) => unit.sourceReviewId === reviewId
              );
              if (index === -1) return [...units, staging];
              return units.map((unit, i) => (i === index ? staging : unit));
            });
            updateLocationStagingInRolloutQueue(workId, operatorId, staging);
          } else if (candidateType === "story") {
            const staging = buildStoryStaging(item);
            setAcceptedStoryUnits((units) =>
              units.map((unit) =>
                unit.sourceReviewId === reviewId ? staging : unit
              )
            );
            updateStoryStagingInRolloutQueue(workId, operatorId, staging);
          } else if (candidateType === "scene") {
            const parent = findAcceptedParentStory(
              next,
              acceptedStoryUnits,
              (getEffectiveCandidate(item).fields as SceneCandidateFields)
                .parentStoryCandidateId
            );
            if (!parent) {
              return next;
            }
            const staging = buildSceneStaging(item, parent, next);
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
    [workId, operatorId, acceptedStoryUnits]
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
      const existing = acceptedStoryUnits.find(
        (u) => u.sourceReviewId === sourceReviewId
      );
      const staging: AcceptedStoryUnitStaging = {
        workId,
        sourceReviewId,
        sourceCandidateId: existing?.sourceCandidateId ?? sourceReviewId,
        title: storyFields.title.trim(),
        summary: storyFields.summary.trim(),
        ...(typeof storyFields.boundaryHint === "string" &&
        storyFields.boundaryHint.trim()
          ? { boundaryHint: storyFields.boundaryHint.trim() }
          : {}),
        acceptedAt: existing?.acceptedAt ?? new Date().toISOString(),
      };
      setAcceptedStoryUnits((prev) =>
        prev.map((unit) =>
          unit.sourceReviewId === sourceReviewId ? staging : unit
        )
      );
      updateStoryStagingInRolloutQueue(workId, operatorId, staging);
    },
    [reviewItems, saveCandidateEdit, workId, operatorId, acceptedStoryUnits]
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
      const existing = acceptedSceneCandidates.find(
        (s) => s.sourceReviewId === sourceReviewId
      );
      if (!existing) {
        return;
      }
      const staging: AcceptedSceneCandidateStaging = {
        workId,
        sourceReviewId,
        parentStorySourceReviewId: existing.parentStorySourceReviewId,
        parentStoryTitle: existing.parentStoryTitle,
        // 章节属性归属故事；画面编辑只改标题与摘要
        chapter_title: existing.chapter_title,
        chapter_number: existing.chapter_number,
        title: sceneFields.title.trim(),
        ...(typeof sceneFields.summary === "string" && sceneFields.summary.trim()
          ? { summary: sceneFields.summary.trim() }
          : typeof edit.editedSummary === "string" && edit.editedSummary.trim()
            ? { summary: edit.editedSummary.trim() }
            : {}),
        ...(sceneFields.visualIntent
          ? { visualIntent: sceneFields.visualIntent }
          : existing.visualIntent
            ? { visualIntent: existing.visualIntent }
            : {}),
        rendererExpression:
          sceneFields.rendererExpression ?? existing.rendererExpression,
        acceptedAt: existing.acceptedAt,
      };
      setAcceptedSceneCandidates((prev) =>
        prev.map((scene) =>
          scene.sourceReviewId === sourceReviewId ? staging : scene
        )
      );
      updateSceneStagingInRolloutQueue(workId, operatorId, staging);
    },
    [
      reviewItems,
      saveCandidateEdit,
      workId,
      operatorId,
      acceptedSceneCandidates,
    ]
  );

  const splitSceneIntoBeats = useCallback(
    async (
      sourceReviewId: string,
      beats: Array<{ title: string; summary: string }>
    ): Promise<boolean> => {
      setAcceptError(null);
      setSplitError(null);
      const source = findReviewItem(reviewItems, sourceReviewId);
      if (!source || source.candidate.candidateType !== "scene") {
        return false;
      }
      if (!session.lockedAt || sessionConflict || isSplitting) {
        return false;
      }
      const cleaned = beats
        .map((b) => ({ title: b.title.trim(), summary: b.summary.trim() }))
        .filter((b) => b.title || b.summary);
      if (cleaned.length < 2) {
        return false;
      }

      setIsSplitting(true);
      try {
        const characterCandidates = reviewItems
          .filter(
            (r) =>
              r.status !== "discarded" &&
              r.candidate.candidateType === "character"
          )
          .map(getEffectiveCandidate);

        const res = await fetch(
          "/api/admin/discovery/propose/split-expressions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workId,
              sessionId: session.sessionId,
              narrative: session.narrative,
              lockedAt: session.lockedAt,
              beats: cleaned,
              characterCandidates,
            }),
          }
        );
        const data = (await res.json()) as {
          beats?: Array<{
            title: string;
            summary: string;
            rendererExpression: SceneCandidateFields["rendererExpression"];
            visualIntent?: SceneCandidateFields["visualIntent"];
          }>;
          error?: RegenError;
          warning?: RegenError;
        };

        if (!res.ok || !data.beats || data.beats.length < 2) {
          setSplitError(
            data.error ?? {
              code: "SPLIT_EXPRESSION_FAILED",
              message: "拆分后补全 Expression 失败",
            }
          );
          return false;
        }

        setReviewItems((prev) =>
          replaceSceneWithSplitBeats(prev, sourceReviewId, data.beats!)
        );
        return true;
      } catch (e) {
        setSplitError({
          code: "SPLIT_EXPRESSION_FAILED",
          message: e instanceof Error ? e.message : String(e),
        });
        return false;
      } finally {
        setIsSplitting(false);
      }
    },
    [reviewItems, session.lockedAt, session.sessionId, session.narrative, sessionConflict, isSplitting, workId]
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
      setSplitError(null);

      try {
        const siblingCandidates = getSiblingCandidatesForRegen(
          reviewItems,
          reviewId
        );
        const previousCandidate = getEffectiveCandidate(item);
        const storyCandidates = reviewItems
          .filter(
            (r) =>
              r.status !== "discarded" &&
              r.candidate.candidateType === "story"
          )
          .map(getEffectiveCandidate);

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
            storyCandidates,
            feedback: feedback ?? null,
          }),
        });

        const body = (await res.json().catch(() => ({}))) as {
          error?: RegenError;
          candidate?: DiscoveryCandidate;
        };

        if (!res.ok || !body.candidate) {
          setRegenError(
            withOperatorFacingMessage(
              body.error ?? {
                code: "REGEN_FAILED",
                message: `Regen failed (HTTP ${res.status})`,
              }
            )
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
        (session.state !== "review_pending" && session.state !== "narrative_locked") ||
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
        const existingStoryCandidates =
          candidateType === "scene"
            ? reviewItems
                .filter(
                  (r) =>
                    r.status !== "discarded" &&
                    r.candidate.candidateType === "story"
                )
                .map(getEffectiveCandidate)
            : undefined;

        const res = await fetch("/api/admin/discovery/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            sessionId: session.sessionId,
            narrative: session.narrative,
            lockedAt: session.lockedAt,
            candidateTypes: [candidateType],
            ...(existingStoryCandidates
              ? { existingStoryCandidates }
              : {}),
            feedback: feedback ?? null,
          }),
        });

        const body = (await res.json().catch(() => ({}))) as {
          error?: ProposeError & { errors?: ProposeTypeError[] };
          candidates?: DiscoveryCandidate[];
          errors?: ProposeTypeError[];
        };

        if (!res.ok) {
          setRetryTypeError(
            withOperatorFacingMessage({
              code: body.error?.code ?? "TYPE_RETRY_FAILED",
              message:
                body.error?.message ?? `Type retry failed (HTTP ${res.status})`,
            })
          );
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
      reviewItems,
    ]
  );

  const acceptCandidate = useCallback(
    async (
      reviewId: string
    ): Promise<AcceptReviewResult | AcceptReviewError> => {
      const target = findReviewItem(reviewItems, reviewId);
      const isStoryOrScene =
        target?.candidate.candidateType === "story" ||
        target?.candidate.candidateType === "scene";

      if (isStoryOrScene && !session.narrative) {
        const blocked = granularityContextRequired();
        setAcceptError(blocked);
        return blocked;
      }

      // Production Story/Frame Accept always carries session.narrative into the Gate.
      const granularity = { narrative: session.narrative };
      const authority = requiredUnitAuthority;

      if (target?.candidate.candidateType === "story") {
        let catalogs = { characters: [] as Array<{ name: string; tsid: string }>, locations: [] as Array<{ name: string; tsid: string }> };
        try {
          const [characters, locations] = await Promise.all([
            charactersApi.getAll(workId),
            locationsApi.getAll(workId),
          ]);
          catalogs = { characters, locations };
        } catch {
          // Matching is best-effort; persist will rematch/create.
        }

        const cascade = prepareAcceptStoryWithChildScenes(
          reviewItems,
          reviewId,
          acceptedStoryUnits,
          catalogs,
          granularity,
          authority
        );
        if (!cascade.ok) {
          setAcceptError(cascade);
          return cascade;
        }

        if (cascade.sceneErrors.length > 0) {
          setAcceptError({
            ok: false,
            code: "SCENE_CASCADE_PARTIAL",
            message: `故事已确认；有 ${cascade.sceneErrors.length} 个画面未能一并确认，可先编辑画面字段后再确认故事`,
            fieldErrors: cascade.sceneErrors.flatMap(
              (err) => err.fieldErrors ?? [err.message]
            ),
          });
        } else {
          setAcceptError(null);
        }

        setReviewItems((prev) => {
          let next = prev;
          for (const id of cascade.acceptedReviewIds) {
            next = markReviewAccepted(next, id);
          }
          return next;
        });
        setAcceptedStoryUnits((prev) => [...prev, cascade.storyStaging]);
        appendStoryStagingToRolloutQueue(
          workId,
          operatorId,
          cascade.storyStaging
        );
        if (cascade.sceneStagings.length > 0) {
          setAcceptedSceneCandidates((prev) => [
            ...prev,
            ...cascade.sceneStagings,
          ]);
          for (const staging of cascade.sceneStagings) {
            appendSceneStagingToRolloutQueue(workId, operatorId, staging);
          }
        }

        return {
          ok: true,
          kind: "story_staging",
          staging: cascade.storyStaging,
        };
      }

      const result = prepareAcceptReview(
        reviewItems,
        reviewId,
        acceptedStoryUnits,
        granularity,
        authority
      );
      if (!result.ok) {
        setAcceptError(result);
        return result;
      }

      setAcceptError(null);
      setReviewItems((prev) => markReviewAccepted(prev, reviewId));

      if (result.kind === "character_staging") {
        setAcceptedCharacters((prev) => [...prev, result.staging]);
        appendCharacterStagingToRolloutQueue(
          workId,
          operatorId,
          result.staging
        );
      } else if (result.kind === "location_staging") {
        setAcceptedLocations((prev) => [...prev, result.staging]);
        appendLocationStagingToRolloutQueue(
          workId,
          operatorId,
          result.staging
        );
      } else if (result.kind === "entity_prefill") {
        storeDiscoveryAcceptPrefill(result.prefill);
      } else if (result.kind === "scene_staging") {
        setAcceptedSceneCandidates((prev) => [...prev, result.staging]);
        appendSceneStagingToRolloutQueue(workId, operatorId, result.staging);
      }

      return result;
    },
    [reviewItems, acceptedStoryUnits, workId, operatorId, session.narrative, requiredUnitAuthority]
  );

  const activeReviewItems = useMemo(
    () => getActiveReviewItems(reviewItems),
    [reviewItems]
  );

  const granularityGate = useMemo((): GranularityGateResult | null => {
    const hasStoryOrScene = activeReviewItems.some(
      (item) =>
        item.candidate.candidateType === "story" ||
        item.candidate.candidateType === "scene"
    );
    if (!hasStoryOrScene) return null;
    return evaluateGranularityForReviewItems(session.narrative, reviewItems);
  }, [activeReviewItems, reviewItems, session.narrative]);

  const informationEquivalence = useMemo((): InformationEquivalenceReviewView | null => {
    const hasStoryOrScene = activeReviewItems.some(
      (item) =>
        item.candidate.candidateType === "story" ||
        item.candidate.candidateType === "scene"
    );
    if (!hasStoryOrScene) return null;
    if (granularityGate?.status === "FAIL") return null;
    return evaluateInformationEquivalenceReviewView(
      reviewItems,
      requiredUnitAuthority
    );
  }, [activeReviewItems, reviewItems, requiredUnitAuthority, granularityGate]);

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
    acceptedCharacters,
    acceptedLocations,
    isRegening,
    regenReviewId,
    regenError,
    isSplitting,
    splitError,
    retryingType,
    retryTypeError,
    acceptError,
    granularityGate,
    informationEquivalence,
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
    splitSceneIntoBeats,
    regenCandidate,
    retryProposeType,
    acceptCandidate,
    teardown,
  };
}
