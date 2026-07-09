"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { ReadingRouteForm } from "@/components/reading-routes/ReadingRouteForm";
import { Button } from "@/components/ui/button";
import * as charactersApi from "@/lib/characters";
import * as locationsApi from "@/lib/locations";
import { getWork } from "@/lib/works";
import type { Character, Location, Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function NewReadingRoutePage() {
  const params = useParams();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : raw ?? "";

  const [work, setWork] = React.useState<Work | null>(null);
  const [workLoading, setWorkLoading] = React.useState(true);
  const [workError, setWorkError] = React.useState<string | null>(null);

  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [refsLoading, setRefsLoading] = React.useState(true);
  const [refsError, setRefsError] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    if (!workId) {
      setRefsLoading(false);
      return;
    }
    let cancelled = false;
    setRefsLoading(true);
    setRefsError(null);
    (async () => {
      try {
        const [ch, loc] = await Promise.all([
          charactersApi.getAll(workId),
          locationsApi.getAll(workId),
        ]);
        if (!cancelled) {
          setCharacters(ch);
          setLocations(loc);
        }
      } catch (e) {
        if (!cancelled) {
          setRefsError(toErrorMessage(e));
          setCharacters([]);
          setLocations([]);
        }
      } finally {
        if (!cancelled) {
          setRefsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  const routesHref = `/works/${encodeURIComponent(workId)}/reading-routes`;
  const workTitle =
    workLoading ? "加载中…" : work?.title ?? "未知作品";

  const formReady = workId && !refsError;

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

      {refsError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {refsError}
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
          href={routesHref}
          className="max-w-[160px] truncate transition-colors hover:text-zinc-800"
        >
          {workTitle}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href={routesHref} className="transition-colors hover:text-zinc-800">
          阅读路线
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">新增阅读路线</span>
      </nav>

      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href={routesHref}>← 返回阅读路线列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">新增阅读路线</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          地点、角色从当前作品已维护的数据中选择；若无数据可手动填写 TSID。
        </p>
      </div>
      {formReady ? (
        <ReadingRouteForm
          workId={workId}
          mode="create"
          characters={characters}
          locations={locations}
          entitiesLoading={refsLoading}
        />
      ) : !workId ? (
        <p className="text-muted-foreground text-sm">无效的作品 ID。</p>
      ) : null}
    </div>
  );
}
