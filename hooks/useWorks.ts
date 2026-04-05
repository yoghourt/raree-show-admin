"use client";

import * as React from "react";

import {
  createWork as createWorkApi,
  deleteWork as deleteWorkApi,
  getWorks,
  updateWork as updateWorkApi,
} from "@/lib/works";
import type { Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export function useWorks() {
  const [works, setWorks] = React.useState<Work[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const list = await getWorks();
      setWorks(list);
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

  const createWork = React.useCallback(
    async (
      data: Pick<Work, "title" | "description" | "coverImage"> & {
        tsid?: string;
      }
    ) => {
      try {
        await createWorkApi(data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [refresh]
  );

  const updateWork = React.useCallback(
    async (
      id: string,
      data: Partial<Pick<Work, "title" | "description" | "coverImage" | "tsid">>
    ) => {
      try {
        await updateWorkApi(id, data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [refresh]
  );

  const deleteWork = React.useCallback(
    async (id: string) => {
      try {
        await deleteWorkApi(id);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [refresh]
  );

  return {
    works,
    loading,
    error,
    createWork,
    updateWork,
    deleteWork,
    refresh,
  };
}
