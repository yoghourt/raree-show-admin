"use client";

import * as React from "react";

import {
  createScene as createSceneApi,
  deleteScene as deleteSceneApi,
  getScenes,
  updateScene as updateSceneApi,
} from "@/lib/scenes";
import type { ReadingRoute } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export function useScenes(workId: string) {
  const [scenes, setScenes] = React.useState<ReadingRoute[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const list = await getScenes(workId);
      setScenes(list);
    } catch (e) {
      setError(toErrorMessage(e));
      throw e;
    }
  }, [workId]);

  const load = React.useCallback(async () => {
    if (!workId) {
      setLoading(false);
      setScenes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await refresh();
    } catch {
      /* error 已写入 state */
    } finally {
      setLoading(false);
    }
  }, [workId, refresh]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const createScene = React.useCallback(
    async (data: Omit<ReadingRoute, "tsid" | "workId"> & { tsid?: string }) => {
      try {
        await createSceneApi(workId, data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  const updateScene = React.useCallback(
    async (tsid: string, data: Omit<ReadingRoute, "tsid" | "workId">) => {
      try {
        await updateSceneApi(workId, tsid, data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  const deleteScene = React.useCallback(
    async (tsid: string) => {
      try {
        await deleteSceneApi(workId, tsid);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  const deleteScenes = React.useCallback(
    async (tsids: string[]) => {
      const ids = [...new Set(tsids.map((t) => t.trim()).filter(Boolean))];
      if (ids.length === 0) return;
      try {
        for (const tsid of ids) {
          await deleteSceneApi(workId, tsid);
        }
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        try {
          await refresh();
        } catch {
          /* keep original error */
        }
        throw e;
      }
    },
    [workId, refresh]
  );

  return {
    scenes,
    loading,
    error,
    createScene,
    updateScene,
    deleteScene,
    deleteScenes,
    refresh,
  };
}
