"use client";

import * as React from "react";

import {
  createScene as createSceneApi,
  deleteScene as deleteSceneApi,
  getScenes,
  updateScene as updateSceneApi,
} from "@/lib/scenes";
import type { Scene } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export function useScenes() {
  const [scenes, setScenes] = React.useState<Scene[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const list = await getScenes();
      setScenes(list);
    } catch (e) {
      setError(toErrorMessage(e));
      throw e;
    }
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refresh();
    } catch {
      /* error 已写入 state */
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const createScene = React.useCallback(
    async (data: Omit<Scene, "tsid"> & { tsid?: string }) => {
      try {
        await createSceneApi(data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [refresh]
  );

  const updateScene = React.useCallback(
    async (id: string, data: Omit<Scene, "tsid">) => {
      try {
        await updateSceneApi(id, data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [refresh]
  );

  const deleteScene = React.useCallback(
    async (id: string) => {
      try {
        await deleteSceneApi(id);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [refresh]
  );

  return {
    scenes,
    loading,
    error,
    createScene,
    updateScene,
    deleteScene,
    refresh,
  };
}
