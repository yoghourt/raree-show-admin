"use client";

import { ChevronRight, FlaskConical, Plus as PlusIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { RolloutDrawer } from "@/components/rollout/RolloutDrawer";
import { SceneTable } from "@/components/scenes/SceneTable";
import { RagBackfillPanel } from "@/components/works/RagBackfillPanel";
import { Button } from "@/components/ui/button";
import { useScenes } from "@/hooks/useScenes";
import {
  loadRolloutQueue,
  ROLLOUT_QUEUE_UPDATED_EVENT,
} from "@/lib/rollout/rollout-queue-storage";
import { supabase } from "@/lib/supabase";
import { getWork } from "@/lib/works";
import type { Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Returns the pending-item count from the Rollout queue in sessionStorage. */
function useRolloutPendingCount(workId: string, operatorId: string | null): number {
  const [count, setCount] = React.useState(0);

  const recompute = React.useCallback(() => {
    if (!operatorId) {
      setCount(0);
      return;
    }
    const q = loadRolloutQueue(workId, operatorId);
    setCount(q.storyStaging.length + q.sceneStaging.length);
  }, [workId, operatorId]);

  React.useEffect(() => {
    recompute();
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ workId?: string; operatorId?: string }>)
        .detail;
      if (detail?.workId === workId && detail?.operatorId === operatorId) {
        recompute();
      }
    };
    window.addEventListener(ROLLOUT_QUEUE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(ROLLOUT_QUEUE_UPDATED_EVENT, handler);
  }, [workId, operatorId, recompute]);

  return count;
}

export default function WorkScenesPage() {
  const params = useParams();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : (raw ?? "");

  const [work, setWork] = React.useState<Work | null>(null);
  const [workLoading, setWorkLoading] = React.useState(true);
  const [workError, setWorkError] = React.useState<string | null>(null);
  const [operatorId, setOperatorId] = React.useState<string | null>(null);
  const [rolloutOpen, setRolloutOpen] = React.useState(false);

  React.useEffect(() => {
    if (!workId) {
      setWork(null);
      setWorkLoading(false);
      return;
    }
    let cancelled = false;
    setWorkLoading(true);
    setWorkError(null);
    (async () => {
      try {
        const w = await getWork(workId);
        if (!cancelled) setWork(w);
      } catch (e) {
        if (!cancelled) {
          setWorkError(toErrorMessage(e));
          setWork(null);
        }
      } finally {
        if (!cancelled) setWorkLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  // Resolve operatorId once for badge computation
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user) setOperatorId(data.user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { scenes, loading, error, deleteScene } = useScenes(workId);

  const pendingCount = useRolloutPendingCount(workId, operatorId);

  const workTitle = workLoading ? "加载中…" : (work?.title ?? "未知作品");
  const scenesBase = `/works/${encodeURIComponent(workId)}/scenes`;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      {workError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {workError}
        </div>
      ) : null}

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
        <span className="max-w-[200px] truncate font-medium text-zinc-800">
          {workTitle}
        </span>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">场景</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Scenes
          </h1>
          <p className="text-muted-foreground text-sm">管理当前作品下的场景数据</p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-row sm:items-center">
          {/* Discovery — 跳转独立页 */}
          <Button variant="outline" asChild className="w-full shrink-0 sm:w-auto">
            <Link href={`/works/${encodeURIComponent(workId)}/discovery`}>
              <Sparkles className="size-4" aria-hidden />
              Discovery
            </Link>
          </Button>

          {/* Rollout — 打开抽屉 */}
          <Button
            variant="outline"
            className="relative w-full shrink-0 sm:w-auto"
            onClick={() => setRolloutOpen(true)}
          >
            <FlaskConical className="size-4" aria-hidden />
            Rollout 投影
            {pendingCount > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                {pendingCount}
              </span>
            ) : null}
          </Button>

          {/* 新增场景 */}
          <Button asChild className="w-full shrink-0 sm:w-auto">
            <Link href={`${scenesBase}/new`}>
              <PlusIcon className="size-4" aria-hidden />
              新增场景
            </Link>
          </Button>
        </div>
      </header>

      <RagBackfillPanel workId={workId} />

      <SceneTable
        workId={workId}
        scenes={scenes}
        loading={loading}
        error={error}
        onDelete={deleteScene}
      />

      {/* Rollout 抽屉 — 延迟渲染直到首次打开，保留挂载状态避免 sessionStorage 丢失 */}
      {rolloutOpen ? (
        <RolloutDrawer
          workId={workId}
          open={rolloutOpen}
          onOpenChange={setRolloutOpen}
        />
      ) : null}
    </div>
  );
}
