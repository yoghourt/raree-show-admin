"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { SceneForm } from "@/components/scenes/SceneForm";
import { Button } from "@/components/ui/button";
import { getScene } from "@/lib/scenes";
import { getWork } from "@/lib/works";
import type { Scene, Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function EditScenePage() {
  const params = useParams();
  const rawWork = params.workId;
  const workId = Array.isArray(rawWork) ? rawWork[0] : rawWork ?? "";
  const rawScene = params.sceneId;
  const sceneIdParam = Array.isArray(rawScene) ? rawScene[0] : rawScene ?? "";
  const sceneTsid = sceneIdParam ? decodeURIComponent(sceneIdParam) : "";

  const [work, setWork] = React.useState<Work | null>(null);
  const [workLoading, setWorkLoading] = React.useState(true);
  const [scene, setScene] = React.useState<Scene | null>(null);
  const [sceneLoading, setSceneLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workId || !sceneTsid) {
      setWork(null);
      setScene(null);
      setWorkLoading(false);
      setSceneLoading(false);
      return;
    }
    let cancelled = false;
    setWorkLoading(true);
    setSceneLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const [w, s] = await Promise.all([
          getWork(workId),
          getScene(workId, sceneTsid),
        ]);
        if (cancelled) return;
        setWork(w);
        setScene(s);
      } catch (e) {
        if (!cancelled) {
          setLoadError(toErrorMessage(e));
          setWork(null);
          setScene(null);
        }
      } finally {
        if (!cancelled) {
          setWorkLoading(false);
          setSceneLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workId, sceneTsid]);

  const scenesHref = `/works/${encodeURIComponent(workId)}/scenes`;
  const workTitle =
    workLoading ? "加载中…" : work?.title ?? "未知作品";
  const pageLoading = workLoading || sceneLoading;

  if (pageLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href={scenesHref}>← 返回场景列表</Link>
        </Button>
        <p className="text-muted-foreground text-sm" aria-busy="true">
          加载中…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href={scenesHref}>← 返回场景列表</Link>
        </Button>
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {loadError}
        </div>
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href={scenesHref}>← 返回场景列表</Link>
        </Button>
        <p className="text-muted-foreground">
          未找到该场景（tsid：{sceneTsid || "—"}）。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <nav
        className="flex flex-wrap items-center gap-1 text-sm text-zinc-500"
        aria-label="面包屑"
      >
        <Link href="/" className="transition-colors hover:text-zinc-800">
          首页
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href="/works" className="transition-colors hover:text-zinc-800">
          作品管理
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link
          href={scenesHref}
          className="max-w-[140px] truncate transition-colors hover:text-zinc-800"
        >
          {workTitle}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href={scenesHref} className="transition-colors hover:text-zinc-800">
          场景
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">编辑场景</span>
      </nav>

      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href={scenesHref}>← 返回场景列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">编辑场景</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {scene.tsid}
        </p>
      </div>
      <SceneForm
        key={scene.tsid}
        workId={workId}
        mode="edit"
        defaultValues={scene}
      />
    </div>
  );
}
