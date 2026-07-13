"use client";

/**
 * useRollout — SPEC-ROL-001 client state for Rollout panel
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import { messages } from "@/lib/locale";
import {
  dismissSceneStagingItem,
  dismissStoryStagingItem,
  findProjectedScene,
  findProjectedSceneByTsid,
  loadRolloutQueue,
  markSceneReviewIdProcessed,
  markStoryReviewIdProcessed,
  mergeRolloutQueue,
  recordProjectedScene,
  reconcileStoryStagingWithPersistedUnits,
  removeProjectedScene,
  restoreSceneStagingItem,
  restoreStoryStagingItem,
  ROLLOUT_QUEUE_UPDATED_EVENT,
  saveRolloutQueue,
  unmarkSceneReviewIdProcessed,
  unmarkStoryReviewIdProcessed,
} from "@/lib/rollout/rollout-queue-storage";
import {
  appendSceneStagingToRolloutQueue,
  appendStoryStagingToRolloutQueue,
  removeSceneStagingFromRolloutQueue,
  removeStoryStagingFromRolloutQueue,
  updateSceneStagingInRolloutQueue,
  updateStoryStagingInRolloutQueue,
  syncRolloutQueueFromDiscovery,
} from "@/lib/rollout/sync-discovery-staging";
import { resolveStoryRelatedEntities } from "@/lib/rollout/resolve-story-entities";
import type {
  ApprovedSceneUnit,
  ApprovedStoryUnit,
  RolloutQueueSnapshot,
  SceneProjectionLink,
  StoryReadingRouteProjectionLink,
} from "@/lib/rollout/types";

export interface UseRolloutConfig {
  workId: string;
  operatorId: string;
}

export interface RolloutSceneBrief {
  tsid: string;
  title: string;
  chapter_number: number;
}

export interface RolloutActionError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface UseRolloutReturn {
  loading: boolean;
  error: string | null;
  queue: RolloutQueueSnapshot;
  storyUnits: ApprovedStoryUnit[];
  approvedSceneUnits: ApprovedSceneUnit[];
  sceneProjectionLinks: SceneProjectionLink[];
  frameProjections: Array<{
    sourceReviewId: string;
    readingRouteTsid: string;
    frameIndex: number;
    caption: string;
  }>;
  links: StoryReadingRouteProjectionLink[];
  scenes: RolloutSceneBrief[];
  actionError: RolloutActionError | null;
  busy: boolean;
  /** Client-side preflight: parent Reading Route persisted for Scene staging. */
  canProjectScene: (staging: AcceptedSceneCandidateStaging) => boolean;
  refresh: () => Promise<void>;
  importFromDiscovery: () => boolean;
  /** Returns persisted story unit id (Reading Route tsid) on success. */
  persistStoryUnit: (
    staging: AcceptedStoryUnitStaging
  ) => Promise<string | null>;
  projectSceneCreate: (
    staging: AcceptedSceneCandidateStaging,
    linkToStoryUnitId?: string
  ) => Promise<boolean>;
  /** Post-write read-back: title + captions must be present for Story Structure evidence. */
  verifyReaderEvidence: (
    routeTsid: string,
    expectedCaptionCount?: number
  ) => Promise<boolean>;
  projectSceneLinkExisting: (
    staging: AcceptedSceneCandidateStaging,
    sceneTsid: string,
    linkToStoryUnitId?: string
  ) => Promise<boolean>;
  createLink: (storyUnitId: string, sceneTsid: string) => Promise<boolean>;
  unlink: (linkId: string) => Promise<boolean>;
  archiveStoryUnit: (storyUnitId: string) => Promise<boolean>;
  updateStoryUnit: (
    storyUnitId: string,
    patch: { title: string; summary: string; boundaryHint?: string }
  ) => Promise<boolean>;
  unpersistStoryUnit: (storyUnitId: string) => Promise<boolean>;
  unprojectScene: (
    sourceReviewId: string,
    options?: { sceneProjectionLinkId?: string }
  ) => Promise<boolean>;
  unprojectSceneByTsid: (sceneTsid: string) => Promise<boolean>;
  dismissStoryStaging: (sourceReviewId: string) => void;
  dismissSceneStaging: (sourceReviewId: string) => void;
  restoreStoryStaging: (sourceReviewId: string) => void;
  restoreSceneStaging: (sourceReviewId: string) => void;
  updateStoryStaging: (staging: AcceptedStoryUnitStaging) => void;
  updateSceneStaging: (staging: AcceptedSceneCandidateStaging) => void;
}

async function parseRolloutError(res: Response): Promise<RolloutActionError> {
  try {
    const json = (await res.json()) as {
      error?: {
        code?: string;
        message?: string;
        fieldErrors?: Record<string, string[]>;
      };
    };
    return {
      code: json.error?.code ?? "UNKNOWN",
      message: json.error?.message ?? res.statusText,
      fieldErrors: json.error?.fieldErrors,
    };
  } catch {
    return { code: "UNKNOWN", message: res.statusText };
  }
}

export function useRollout({
  workId,
  operatorId,
}: UseRolloutConfig): UseRolloutReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<RolloutActionError | null>(
    null
  );
  const [queue, setQueue] = useState<RolloutQueueSnapshot>(() =>
    loadRolloutQueue(workId, operatorId)
  );
  const [storyUnits, setStoryUnits] = useState<ApprovedStoryUnit[]>([]);
  const storyUnitsRef = useRef<ApprovedStoryUnit[]>([]);
  storyUnitsRef.current = storyUnits;
  const [approvedSceneUnits, setApprovedSceneUnits] = useState<
    ApprovedSceneUnit[]
  >([]);
  const [sceneProjectionLinks, setSceneProjectionLinks] = useState<
    SceneProjectionLink[]
  >([]);
  const [frameProjections, setFrameProjections] = useState<
    Array<{
      sourceReviewId: string;
      readingRouteTsid: string;
      frameIndex: number;
      caption: string;
    }>
  >([]);
  const [links, setLinks] = useState<StoryReadingRouteProjectionLink[]>([]);
  const [scenes, setScenes] = useState<RolloutSceneBrief[]>([]);

  const persistQueue = useCallback(
    (next: RolloutQueueSnapshot) => {
      setQueue(next);
      saveRolloutQueue(workId, operatorId, next);
    },
    [workId, operatorId]
  );

  const refresh = useCallback(async () => {
    if (!workId || !operatorId) {
      setLoading(false);
      return;
    }

    const syncedQueue = syncRolloutQueueFromDiscovery(workId, operatorId);
    setQueue(syncedQueue);

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/rollout?workId=${encodeURIComponent(workId)}`
      );
      if (!res.ok) {
        const err = await parseRolloutError(res);
        setError(err.message);
        return;
      }
      const json = (await res.json()) as {
        storyUnits: ApprovedStoryUnit[];
        approvedSceneUnits?: ApprovedSceneUnit[];
        sceneProjectionLinks?: SceneProjectionLink[];
        frameProjections?: Array<{
          sourceReviewId: string;
          readingRouteTsid: string;
          frameIndex: number;
          caption: string;
        }>;
        links: StoryReadingRouteProjectionLink[];
        scenes: RolloutSceneBrief[];
      };
      const persistedUnits = json.storyUnits ?? [];
      storyUnitsRef.current = persistedUnits;
      setStoryUnits(persistedUnits);
      setApprovedSceneUnits(json.approvedSceneUnits ?? []);
      setSceneProjectionLinks(json.sceneProjectionLinks ?? []);
      setFrameProjections(json.frameProjections ?? []);
      setLinks(json.links ?? []);
      setScenes(json.scenes ?? []);

      const reconciled = reconcileStoryStagingWithPersistedUnits(
        loadRolloutQueue(workId, operatorId),
        persistedUnits
      );
      setQueue(reconciled);
      saveRolloutQueue(workId, operatorId, reconciled);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [workId, operatorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const reloadQueue = () => {
      setQueue(loadRolloutQueue(workId, operatorId));
    };
    const onQueueUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ workId?: string; operatorId?: string }>)
        .detail;
      if (detail?.workId === workId && detail?.operatorId === operatorId) {
        reloadQueue();
      }
    };
    window.addEventListener(ROLLOUT_QUEUE_UPDATED_EVENT, onQueueUpdated);
    return () => {
      window.removeEventListener(ROLLOUT_QUEUE_UPDATED_EVENT, onQueueUpdated);
    };
  }, [workId, operatorId]);

  const finalizeSceneProjection = useCallback(
    (
      staging: AcceptedSceneCandidateStaging,
      sceneTsid: string,
      mode: "create" | "link_existing",
      meta?: { approvedSceneUnitId?: string; sceneProjectionLinkId?: string }
    ) => {
      let next = markSceneReviewIdProcessed(
        loadRolloutQueue(workId, operatorId),
        staging.sourceReviewId
      );
      next = recordProjectedScene(next, {
        sourceReviewId: staging.sourceReviewId,
        sceneTsid,
        mode,
        staging,
        approvedSceneUnitId: meta?.approvedSceneUnitId,
        sceneProjectionLinkId: meta?.sceneProjectionLinkId,
      });
      persistQueue(next);
    },
    [workId, operatorId, persistQueue]
  );

  const canProjectScene = useCallback(
    (staging: AcceptedSceneCandidateStaging): boolean => {
      const parentId = staging.parentStorySourceReviewId?.trim();
      if (!parentId) return false;
      return storyUnitsRef.current.some(
        (u) => u.sourceReviewId === parentId && u.status === "active"
      );
    },
    []
  );

  const resolveParentStoryUnitId = useCallback(
    (staging: AcceptedSceneCandidateStaging): string | undefined => {
      const parentId = staging.parentStorySourceReviewId?.trim();
      if (!parentId) return undefined;
      return storyUnitsRef.current.find(
        (u) => u.sourceReviewId === parentId && u.status === "active"
      )?.id;
    },
    []
  );

  const importFromDiscovery = useCallback((): boolean => {
    if (!workId || !operatorId) {
      return false;
    }
    const merged = syncRolloutQueueFromDiscovery(workId, operatorId);
    setQueue(merged);
    return merged.storyStaging.length > 0 || merged.readingRouteStaging.length > 0;
  }, [workId, operatorId]);

  const persistStoryUnit = useCallback(
    async (staging: AcceptedStoryUnitStaging): Promise<string | null> => {
      setBusy(true);
      setActionError(null);
      try {
        let resolved = staging;
        try {
          resolved = await resolveStoryRelatedEntities(workId, staging);
        } catch (e) {
          setActionError({
            code: "ENTITY_RESOLVE_FAILED",
            message:
              e instanceof Error
                ? e.message
                : "创建或匹配角色/地点失败",
          });
          return null;
        }

        const res = await fetch("/api/admin/rollout/story-units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workId, staging: resolved }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return null;
        }
        const json = (await res.json()) as { storyUnit?: ApprovedStoryUnit };
        const storyUnit = json.storyUnit;
        if (storyUnit) {
          const nextUnits = [
            storyUnit,
            ...storyUnitsRef.current.filter((u) => u.id !== storyUnit.id),
          ];
          storyUnitsRef.current = nextUnits;
          setStoryUnits(nextUnits);
        }
        const next = markStoryReviewIdProcessed(
          loadRolloutQueue(workId, operatorId),
          staging.sourceReviewId
        );
        persistQueue(next);
        await refresh();
        return (
          storyUnit?.id ??
          storyUnitsRef.current.find(
            (u) =>
              u.sourceReviewId === staging.sourceReviewId &&
              u.status === "active"
          )?.id ??
          null
        );
      } finally {
        setBusy(false);
      }
    },
    [workId, operatorId, persistQueue, refresh]
  );

  const verifyReaderEvidence = useCallback(
    async (
      routeTsid: string,
      expectedCaptionCount?: number
    ): Promise<boolean> => {
      setActionError(null);
      const res = await fetch("/api/admin/rollout/reader-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workId,
          routeTsid,
          ...(typeof expectedCaptionCount === "number"
            ? { expectedCaptionCount }
            : {}),
        }),
      });
      if (!res.ok) {
        setActionError(await parseRolloutError(res));
        return false;
      }
      return true;
    },
    [workId]
  );

  const projectSceneCreate = useCallback(
    async (
      staging: AcceptedSceneCandidateStaging,
      linkToStoryUnitId?: string
    ): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        // linkToStoryUnitId：刚写入父故事后传入，避免 React state 尚未刷新时误拒
        if (!linkToStoryUnitId && !canProjectScene(staging)) {
          setActionError({
            code: "PARENT_STORY_NOT_PERSISTED",
            message: "请先写入所属故事，再添加画面页",
          });
          return false;
        }
        const parentUnitId =
          linkToStoryUnitId ?? resolveParentStoryUnitId(staging);
        const res = await fetch("/api/admin/rollout/reading-route-projection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            staging,
            mode: "create",
            linkToStoryUnitId: parentUnitId,
          }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        const json = (await res.json()) as {
          sceneTsid?: string;
          approvedSceneUnitId?: string;
          sceneProjectionLinkId?: string;
        };
        if (json.sceneTsid) {
          finalizeSceneProjection(staging, json.sceneTsid, "create", {
            approvedSceneUnitId: json.approvedSceneUnitId,
            sceneProjectionLinkId: json.sceneProjectionLinkId,
          });
        } else {
          persistQueue(
            markSceneReviewIdProcessed(
              loadRolloutQueue(workId, operatorId),
              staging.sourceReviewId
            )
          );
        }
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [
      workId,
      operatorId,
      finalizeSceneProjection,
      persistQueue,
      refresh,
      canProjectScene,
      resolveParentStoryUnitId,
    ]
  );

  const projectSceneLinkExisting = useCallback(
    async (
      staging: AcceptedSceneCandidateStaging,
      sceneTsid: string,
      linkToStoryUnitId?: string
    ): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        if (!linkToStoryUnitId && !canProjectScene(staging)) {
          setActionError({
            code: "PARENT_STORY_NOT_PERSISTED",
            message: "请先写入所属故事，再添加画面页",
          });
          return false;
        }
        const parentUnitId =
          linkToStoryUnitId ?? resolveParentStoryUnitId(staging);
        const res = await fetch("/api/admin/rollout/reading-route-projection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            staging,
            mode: "link_existing",
            sceneTsid,
            linkToStoryUnitId: parentUnitId,
          }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        const json = (await res.json()) as {
          approvedSceneUnitId?: string;
          sceneProjectionLinkId?: string;
        };
        finalizeSceneProjection(staging, sceneTsid, "link_existing", {
          approvedSceneUnitId: json.approvedSceneUnitId,
          sceneProjectionLinkId: json.sceneProjectionLinkId,
        });
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [
      workId,
      finalizeSceneProjection,
      refresh,
      canProjectScene,
      resolveParentStoryUnitId,
    ]
  );

  const createLink = useCallback(
    async (storyUnitId: string, sceneTsid: string): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch("/api/admin/rollout/story-scene-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workId, storyUnitId, sceneTsid }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [workId, refresh]
  );

  const unlink = useCallback(
    async (linkId: string): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(
          `/api/admin/rollout/story-scene-links/${encodeURIComponent(linkId)}?workId=${encodeURIComponent(workId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [workId, refresh]
  );

  const archiveStoryUnit = useCallback(
    async (storyUnitId: string): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch("/api/admin/rollout/story-units/archive", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workId, storyUnitId }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [workId, refresh]
  );

  const updateStoryUnit = useCallback(
    async (
      storyUnitId: string,
      patch: { title: string; summary: string; boundaryHint?: string }
    ): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(
          `/api/admin/rollout/story-units/${encodeURIComponent(storyUnitId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workId, ...patch }),
          }
        );
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [workId, refresh]
  );

  const unpersistStoryUnit = useCallback(
    async (storyUnitId: string): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(
          `/api/admin/rollout/story-units/${encodeURIComponent(storyUnitId)}?workId=${encodeURIComponent(workId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        const json = (await res.json()) as {
          staging?: AcceptedStoryUnitStaging;
        };
        if (json.staging) {
          const next = mergeRolloutQueue(
            unmarkStoryReviewIdProcessed(
              loadRolloutQueue(workId, operatorId),
              json.staging.sourceReviewId
            ),
            { storyUnits: [json.staging] }
          );
          persistQueue(next);
        }
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [workId, operatorId, persistQueue, refresh]
  );

  const unprojectScene = useCallback(
    async (
      sourceReviewId: string,
      options?: { sceneProjectionLinkId?: string }
    ): Promise<boolean> => {
      const record = findProjectedScene(
        loadRolloutQueue(workId, operatorId),
        sourceReviewId
      );
      const frameProj =
        frameProjections.find((f) => f.sourceReviewId === sourceReviewId) ??
        null;
      const durableLink =
        sceneProjectionLinks.find((l) => l.sourceReviewId === sourceReviewId) ??
        null;
      const approvedScene =
        approvedSceneUnits.find((u) => u.sourceReviewId === sourceReviewId) ??
        null;

      if (
        !record &&
        !frameProj &&
        !durableLink &&
        !options?.sceneProjectionLinkId
      ) {
        setActionError({
          code: "STAGING_NOT_FOUND",
          message: messages.rollout.unprojectNoRecord,
        });
        return false;
      }

      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch(
          "/api/admin/rollout/reading-route-projection/unproject",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workId,
              sourceReviewId,
              sceneTsid: frameProj?.readingRouteTsid,
              sceneProjectionLinkId:
                options?.sceneProjectionLinkId ??
                record?.sceneProjectionLinkId ??
                durableLink?.id,
            }),
          }
        );
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }

        let next = removeProjectedScene(
          loadRolloutQueue(workId, operatorId),
          sourceReviewId
        );
        next = unmarkSceneReviewIdProcessed(next, sourceReviewId);

        const stagingToRestore =
          record?.staging ??
          (frameProj
            ? {
                workId,
                sourceReviewId: frameProj.sourceReviewId,
                title: frameProj.caption || frameProj.sourceReviewId,
                chapter_number: 1,
                acceptedAt: new Date().toISOString(),
              }
            : approvedScene
              ? {
                  workId,
                  sourceReviewId: approvedScene.sourceReviewId,
                  parentStorySourceReviewId: storyUnits.find(
                    (s) => s.id === approvedScene.parentStoryUnitId
                  )?.sourceReviewId,
                  chapter_number: approvedScene.chapterNumber,
                  chapter_title: approvedScene.chapterTitle,
                  title: approvedScene.title,
                  summary: approvedScene.summary,
                  acceptedAt: approvedScene.approvedAt,
                }
              : null);

        if (stagingToRestore) {
          next = mergeRolloutQueue(next, {
            sceneCandidates: [stagingToRestore],
          });
        }

        persistQueue(next);
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [
      workId,
      operatorId,
      persistQueue,
      refresh,
      sceneProjectionLinks,
      approvedSceneUnits,
      frameProjections,
      storyUnits,
    ]
  );

  const unprojectSceneByTsid = useCallback(
    async (sceneTsid: string): Promise<boolean> => {
      const frameProj =
        frameProjections.find((f) => f.readingRouteTsid === sceneTsid) ?? null;
      if (frameProj) {
        return unprojectScene(frameProj.sourceReviewId);
      }

      const durableLink =
        sceneProjectionLinks.find((l) => l.readingRouteTsid === sceneTsid) ??
        null;
      if (durableLink) {
        return unprojectScene(durableLink.sourceReviewId, {
          sceneProjectionLinkId: durableLink.id,
        });
      }

      const record = findProjectedSceneByTsid(
        loadRolloutQueue(workId, operatorId),
        sceneTsid
      );
      if (!record) {
        setActionError({
          code: "STAGING_NOT_FOUND",
          message: messages.rollout.unprojectNoRecord,
        });
        return false;
      }
      return unprojectScene(record.sourceReviewId, {
        sceneProjectionLinkId: record.sceneProjectionLinkId,
      });
    },
    [workId, operatorId, unprojectScene, sceneProjectionLinks, frameProjections]
  );

  const dismissStoryStaging = useCallback(
    (sourceReviewId: string) => {
      persistQueue(
        dismissStoryStagingItem(
          loadRolloutQueue(workId, operatorId),
          sourceReviewId
        )
      );
    },
    [workId, operatorId, persistQueue]
  );

  const updateStoryStaging = useCallback(
    (staging: AcceptedStoryUnitStaging) => {
      updateStoryStagingInRolloutQueue(workId, operatorId, staging);
      setQueue(loadRolloutQueue(workId, operatorId));
    },
    [workId, operatorId]
  );

  const updateSceneStaging = useCallback(
    (staging: AcceptedSceneCandidateStaging) => {
      updateSceneStagingInRolloutQueue(workId, operatorId, staging);
      setQueue(loadRolloutQueue(workId, operatorId));
    },
    [workId, operatorId]
  );

  const dismissSceneStaging = useCallback(
    (sourceReviewId: string) => {
      persistQueue(
        dismissSceneStagingItem(
          loadRolloutQueue(workId, operatorId),
          sourceReviewId
        )
      );
    },
    [workId, operatorId, persistQueue]
  );

  const restoreStoryStaging = useCallback(
    (sourceReviewId: string) => {
      persistQueue(
        restoreStoryStagingItem(
          loadRolloutQueue(workId, operatorId),
          sourceReviewId
        )
      );
    },
    [workId, operatorId, persistQueue]
  );

  const restoreSceneStaging = useCallback(
    (sourceReviewId: string) => {
      persistQueue(
        restoreSceneStagingItem(
          loadRolloutQueue(workId, operatorId),
          sourceReviewId
        )
      );
    },
    [workId, operatorId, persistQueue]
  );

  return {
    loading,
    error,
    queue,
    storyUnits,
    approvedSceneUnits,
    sceneProjectionLinks,
    frameProjections,
    links,
    scenes,
    actionError,
    busy,
    canProjectScene,
    refresh,
    importFromDiscovery,
    persistStoryUnit,
    projectSceneCreate,
    verifyReaderEvidence,
    projectSceneLinkExisting,
    createLink,
    unlink,
    archiveStoryUnit,
    updateStoryUnit,
    unpersistStoryUnit,
    unprojectScene,
    unprojectSceneByTsid,
    dismissStoryStaging,
    dismissSceneStaging,
    restoreStoryStaging,
    restoreSceneStaging,
    updateStoryStaging,
    updateSceneStaging,
  };
}
