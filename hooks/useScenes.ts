"use client";

import * as React from "react";

import { MOCK_SCENES } from "@/lib/mock-data";
import type { Scene } from "@/lib/types";

export type ScenesContextValue = {
  getAll: () => Scene[];
  getById: (id: string) => Scene | undefined;
  create: (scene: Omit<Scene, "tsid"> & { tsid?: string }) => Scene;
  update: (scene: Scene) => void;
  deleteById: (id: string) => void;
};

const ScenesContext = React.createContext<ScenesContextValue | null>(null);

export function ScenesProvider({ children }: { children: React.ReactNode }) {
  const [scenes, setScenes] = React.useState<Scene[]>(() => [...MOCK_SCENES]);

  const getAll = React.useCallback(() => scenes, [scenes]);

  const getById = React.useCallback(
    (id: string) => scenes.find((s) => s.tsid === id),
    [scenes]
  );

  const create = React.useCallback(
    (input: Omit<Scene, "tsid"> & { tsid?: string }) => {
      const { tsid: optionalTsid, ...rest } = input;
      const tsid =
        optionalTsid?.trim() || `scene_${Date.now()}`;
      const scene: Scene = { ...rest, tsid };
      setScenes((prev) => [...prev, scene]);
      return scene;
    },
    []
  );

  const update = React.useCallback((scene: Scene) => {
    setScenes((prev) =>
      prev.map((s) => (s.tsid === scene.tsid ? scene : s))
    );
  }, []);

  const deleteById = React.useCallback((id: string) => {
    setScenes((prev) => prev.filter((s) => s.tsid !== id));
  }, []);

  const value = React.useMemo<ScenesContextValue>(
    () => ({ getAll, getById, create, update, deleteById }),
    [getAll, getById, create, update, deleteById]
  );

  return React.createElement(ScenesContext.Provider, { value }, children);
}

export function useScenes(): ScenesContextValue {
  const ctx = React.useContext(ScenesContext);
  if (!ctx) {
    throw new Error("useScenes must be used within ScenesProvider");
  }
  return ctx;
}
