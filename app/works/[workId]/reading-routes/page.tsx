"use client";

import { ChevronRight, Plus as PlusIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { ReadingRouteTable } from "@/components/reading-routes/ReadingRouteTable";
import { RagBackfillPanel } from "@/components/works/RagBackfillPanel";
import { Button } from "@/components/ui/button";
import { useScenes } from "@/hooks/useScenes";
import {
  loadRolloutQueue,
  ROLLOUT_QUEUE_UPDATED_EVENT,
} from "@/lib/rollout/rollout-queue-storage";
import { supabase } from "@/lib/supabase";
import { getWork } from "@/lib/works";
import { messages } from "@/lib/locale";
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
    setCount(q.storyStaging.length + q.readingRouteStaging.length);
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

export default function WorkReadingRoutesPage() {
  const params = useParams();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : (raw ?? "");

  const [work, setWork] = React.useState<Work | null>(null);
  const [workLoading, setWorkLoading] = React.useState(true);
  const [workError, setWorkError] = React.useState<string | null>(null);
  const [operatorId, setOperatorId] = React.useState<string | null>(null);

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

  const { scenes, loading, error, deleteScene, deleteScenes, reorderInChapter } =
    useScenes(workId);

  const pendingCount = useRolloutPendingCount(workId, operatorId);

  const workTitle = workLoading ? "加载中…" : (work?.title ?? "未知作品");
  const routesBase = `/works/${encodeURIComponent(workId)}/reading-routes`;
  const discoveryHref =
    pendingCount > 0
      ? `/works/${encodeURIComponent(workId)}/discovery?step=rollout`
      : `/works/${encodeURIComponent(workId)}/discovery`;

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
        <span className="font-medium text-zinc-800">{messages.nav.readingRoutes}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {messages.nav.readingRoutes}
          </h1>
          <p className="text-muted-foreground text-sm">{messages.works.manageReadingRoutes}</p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="outline"
            asChild
            className="relative w-full shrink-0 sm:w-auto"
          >
            <Link href={discoveryHref}>
              <Sparkles className="size-4" aria-hidden />
              {messages.nav.discovery}
              {pendingCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          </Button>

          <Button asChild className="w-full shrink-0 sm:w-auto">
            <Link href={`${routesBase}/new`}>
              <PlusIcon className="size-4" aria-hidden />
              {messages.works.newReadingRoute}
            </Link>
          </Button>
        </div>
      </header>

      <RagBackfillPanel workId={workId} />

      <ReadingRouteTable
        workId={workId}
        scenes={scenes}
        loading={loading}
        error={error}
        onDelete={deleteScene}
        onDeleteMany={deleteScenes}
        onReorder={reorderInChapter}
      />
    </div>
  );
}
