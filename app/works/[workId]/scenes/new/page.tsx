"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { SceneForm } from "@/components/scenes/SceneForm";
import { Button } from "@/components/ui/button";
import { getWork } from "@/lib/works";
import type { Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function NewScenePage() {
  const params = useParams();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : raw ?? "";

  const [work, setWork] = React.useState<Work | null>(null);
  const [workLoading, setWorkLoading] = React.useState(true);
  const [workError, setWorkError] = React.useState<string | null>(null);

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
        if (!cancelled) {
          setWork(w);
        }
      } catch (e) {
        if (!cancelled) {
          setWorkError(toErrorMessage(e));
          setWork(null);
        }
      } finally {
        if (!cancelled) {
          setWorkLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  const scenesHref = `/works/${encodeURIComponent(workId)}/scenes`;
  const workTitle =
    workLoading ? "加载中…" : work?.title ?? "未知作品";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {workError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
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
        <Link
          href={scenesHref}
          className="max-w-[160px] truncate transition-colors hover:text-zinc-800"
        >
          {workTitle}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href={scenesHref} className="transition-colors hover:text-zinc-800">
          场景
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">新增场景</span>
      </nav>

      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href={scenesHref}>← 返回场景列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">新增场景</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          标签与角色 ID 支持英文逗号分隔多个值。
        </p>
      </div>
      {workId ? (
        <SceneForm workId={workId} mode="create" />
      ) : (
        <p className="text-muted-foreground text-sm">无效的作品 ID。</p>
      )}
    </div>
  );
}
