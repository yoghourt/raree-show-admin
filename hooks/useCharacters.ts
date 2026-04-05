"use client";

import * as React from "react";

import * as charactersApi from "@/lib/characters";
import type { Character } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export function useCharacters(workId: string) {
  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const list = await charactersApi.getAll(workId);
      setCharacters(list);
    } catch (e) {
      setError(toErrorMessage(e));
      throw e;
    }
  }, [workId]);

  const load = React.useCallback(async () => {
    if (!workId) {
      setLoading(false);
      setCharacters([]);
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

  const createCharacter = React.useCallback(
    async (
      data: Omit<Character, "id" | "tsid" | "workId" | "createdAt"> & {
        tsid?: string;
      }
    ) => {
      try {
        await charactersApi.create(workId, data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  const updateCharacter = React.useCallback(
    async (
      tsid: string,
      data: Omit<Character, "id" | "tsid" | "workId" | "createdAt">
    ) => {
      try {
        await charactersApi.update(workId, tsid, data);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  const deleteCharacter = React.useCallback(
    async (tsid: string) => {
      try {
        await charactersApi.deleteById(workId, tsid);
        await refresh();
      } catch (e) {
        setError(toErrorMessage(e));
        throw e;
      }
    },
    [workId, refresh]
  );

  return {
    characters,
    loading,
    error,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    refresh,
  };
}
