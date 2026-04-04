"use client";

import { ChevronRight, Plus as PlusIcon } from "lucide-react";
import Link from "next/link";

import { SceneTable } from "@/components/scenes/SceneTable";
import { Button } from "@/components/ui/button";
import { useScenes } from "@/hooks/useScenes";

export default function ScenesPage() {
  const { scenes, loading, error, deleteScene } = useScenes();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <nav
        className="flex flex-wrap items-center gap-1 text-sm text-zinc-500"
        aria-label="面包屑"
      >
        <Link
          href="/"
          className="transition-colors hover:text-zinc-800"
        >
          首页
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">场景管理</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Scenes
          </h1>
          <p className="text-muted-foreground text-sm">
            管理所有场景数据
          </p>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link href="/scenes/new">
            <PlusIcon className="size-4" aria-hidden />
            新增场景
          </Link>
        </Button>
      </header>

      <SceneTable
        scenes={scenes}
        loading={loading}
        error={error}
        onDelete={deleteScene}
      />
    </div>
  );
}
