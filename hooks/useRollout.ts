"use client";

/**
 * useRollout — SPEC-ROL-001 client state for Rollout panel
 */

import { useCallback, useEffect, useState } from "react";

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
import { syncRolloutQueueFromDiscovery } from "@/lib/rollout/sync-discovery-staging";
import type {
  ApprovedStoryUnit,
  RolloutQueueSnapshot,
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
  links: StoryReadingRouteProjectionLink[];
  scenes: RolloutSceneBrief[];
  actionError: RolloutActionError | null;
  busy: boolean;
  refresh: () => Promise<void>;
  importFromDiscovery: () => boolean;
  persistStoryUnit: (staging: AcceptedStoryUnitStaging) => Promise<boolean>;
  projectSceneCreate: (
    staging: AcceptedSceneCandidateStaging,
    linkToStoryUnitId?: string
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
  unprojectScene: (sourceReviewId: string) => Promise<boolean>;
  unprojectSceneByTsid: (sceneTsid: string) => Promise<boolean>;
  dismissStoryStaging: (sourceReviewId: string) => void;
  dismissSceneStaging: (sourceReviewId: string) => void;
  restoreStoryStaging: (sourceReviewId: string) => void;
  restoreSceneStaging: (sourceReviewId: string) => void;
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
        links: StoryReadingRouteProjectionLink[];
        scenes: RolloutSceneBrief[];
      };
      const persistedUnits = json.storyUnits ?? [];
      setStoryUnits(persistedUnits);
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
      mode: "create" | "link_existing"
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
      });
      persistQueue(next);
    },
    [workId, operatorId, persistQueue]
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
    async (staging: AcceptedStoryUnitStaging): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch("/api/admin/rollout/story-units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workId, staging }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        const next = markStoryReviewIdProcessed(
          loadRolloutQueue(workId, operatorId),
          staging.sourceReviewId
        );
        persistQueue(next);
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [workId, operatorId, persistQueue, refresh]
  );

  const projectSceneCreate = useCallback(
    async (
      staging: AcceptedSceneCandidateStaging,
      linkToStoryUnitId?: string
    ): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch("/api/admin/rollout/reading-route-projection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            staging,
            mode: "create",
            linkToStoryUnitId,
          }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        const json = (await res.json()) as { sceneTsid?: string };
        if (json.sceneTsid) {
          finalizeSceneProjection(staging, json.sceneTsid, "create");
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
    [workId, operatorId, finalizeSceneProjection, persistQueue, refresh]
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
        const res = await fetch("/api/admin/rollout/reading-route-projection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            staging,
            mode: "link_existing",
            sceneTsid,
            linkToStoryUnitId,
          }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        finalizeSceneProjection(staging, sceneTsid, "link_existing");
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [workId, finalizeSceneProjection, refresh]
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
    async (sourceReviewId: string): Promise<boolean> => {
      const record = findProjectedScene(
        loadRolloutQueue(workId, operatorId),
        sourceReviewId
      );
      if (!record) {
        setActionError({
          code: "STAGING_NOT_FOUND",
          message: "No projection record found for this staging item",
        });
        return false;
      }

      setBusy(true);
      setActionError(null);
      try {
        const res = await fetch("/api/admin/rollout/reading-route-projection/unproject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workId,
            sceneTsid: record.sceneTsid,
            mode: record.mode,
          }),
        });
        if (!res.ok) {
          setActionError(await parseRolloutError(res));
          return false;
        }
        const next = mergeRolloutQueue(
          unmarkSceneReviewIdProcessed(
            removeProjectedScene(
              loadRolloutQueue(workId, operatorId),
              sourceReviewId
            ),
            sourceReviewId
          ),
          { sceneCandidates: [record.staging] }
        );
        persistQueue(next);
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [workId, operatorId, persistQueue, refresh]
  );

  const unprojectSceneByTsid = useCallback(
    async (sceneTsid: string): Promise<boolean> => {
      const record = findProjectedSceneByTsid(
        loadRolloutQueue(workId, operatorId),
        sceneTsid
      );
      if (!record) {
        setActionError({
          code: "STAGING_NOT_FOUND",
          message:
            messages.rollout.unprojectNoRecord,
        });
        return false;
      }
      return unprojectScene(record.sourceReviewId);
    },
    [workId, operatorId, unprojectScene]
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
    links,
    scenes,
    actionError,
    busy,
    refresh,
    importFromDiscovery,
    persistStoryUnit,
    projectSceneCreate,
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
  };
}
