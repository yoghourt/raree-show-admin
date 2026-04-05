"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { WorkForm } from "@/components/works/WorkForm";
import { Button } from "@/components/ui/button";
import { getWork } from "@/lib/works";
import type { Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function EditWorkPage() {
  const params = useParams();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : raw ?? "";

  const [work, setWork] = React.useState<Work | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workId) {
      setWork(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const w = await getWork(workId);
        if (!cancelled) {
          setWork(w);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(toErrorMessage(e));
          setWork(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/works">← 返回列表</Link>
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
          <Link href="/works">← 返回列表</Link>
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

  if (!work) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/works">← 返回列表</Link>
        </Button>
        <p className="text-muted-foreground">未找到该作品。</p>
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
        <span className="font-medium text-zinc-800">编辑作品</span>
      </nav>

      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/works">← 返回列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">编辑作品</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {work.tsid}
        </p>
      </div>
      <WorkForm
        key={work.id}
        mode="edit"
        workId={work.id}
        defaultValues={{
          title: work.title,
          description: work.description,
          coverImage: work.coverImage,
        }}
      />
    </div>
  );
}
