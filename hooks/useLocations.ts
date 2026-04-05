"use client";

import * as React from "react";

import * as locationsApi from "@/lib/locations";
import type { Location } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export function useLocations(workId: string) {
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const list = await locationsApi.getAll(workId);
      setLocations(list);
    } catch (e) {
      setError(toErrorMessage(e));
      throw e;
    }
  }, [workId]);

  const load = React.useCallback(async () => {
    if (!workId) {
      setLoading(false);
      setLocations([]);
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

  const createLocation = React.useCallback(
    async (
      data: Omit<Location, "id" | "tsid" | "workId" | "createdAt"> & {
        tsid?: string;
      }
    ) => {
      try {
        await locationsApi.create(workId, data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  const updateLocation = React.useCallback(
    async (
      tsid: string,
      data: Omit<Location, "id" | "tsid" | "workId" | "createdAt">
    ) => {
      try {
        await locationsApi.update(workId, tsid, data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  const deleteLocation = React.useCallback(
    async (tsid: string) => {
      try {
        await locationsApi.deleteById(workId, tsid);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  return {
    locations,
    loading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
    refresh,
  };
}
