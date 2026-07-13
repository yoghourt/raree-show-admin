"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { ReadingRouteForm } from "@/components/reading-routes/ReadingRouteForm";
import { Button } from "@/components/ui/button";
import * as charactersApi from "@/lib/characters";
import { messages } from "@/lib/locale";
import * as locationsApi from "@/lib/locations";
import { getScene } from "@/lib/scenes";
import { getWork } from "@/lib/works";
import type { Character, Location, ReadingRoute, Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function EditReadingRoutePage() {
  const params = useParams();
  const rawWork = params.workId;
  const workId = Array.isArray(rawWork) ? rawWork[0] : rawWork ?? "";
  const rawRoute = params.readingRouteId;
  const routeIdParam = Array.isArray(rawRoute) ? rawRoute[0] : rawRoute ?? "";
  const sceneTsid = routeIdParam ? decodeURIComponent(routeIdParam) : "";

  const [work, setWork] = React.useState<Work | null>(null);
  const [scene, setScene] = React.useState<ReadingRoute | null>(null);
  const [characters, setCharacters] = React.useState<Character[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [pageLoading, setPageLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workId || !sceneTsid) {
      setWork(null);
      setScene(null);
      setCharacters([]);
      setLocations([]);
      setPageLoading(false);
      return;
    }
    let cancelled = false;
    setPageLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const [w, s, ch, loc] = await Promise.all([
          getWork(workId),
          getScene(workId, sceneTsid),
          charactersApi.getAll(workId),
          locationsApi.getAll(workId),
        ]);
        if (cancelled) return;
        setWork(w);
        setScene(s);
        setCharacters(ch);
        setLocations(loc);
      } catch (e) {
        if (!cancelled) {
          setLoadError(toErrorMessage(e));
          setWork(null);
          setScene(null);
          setCharacters([]);
          setLocations([]);
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workId, sceneTsid]);

  const routesHref = `/works/${encodeURIComponent(workId)}/reading-routes`;
  const workTitle = work?.title ?? "未知作品";

  if (pageLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href={routesHref}>← 返回故事列表</Link>
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
          <Link href={routesHref}>← 返回故事列表</Link>
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
          <Link href={routesHref}>← 返回故事列表</Link>
        </Button>
        <p className="text-muted-foreground">
          未找到该故事（编号：{sceneTsid || "—"}）。
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
          href={routesHref}
          className="max-w-[140px] truncate transition-colors hover:text-zinc-800"
        >
          {workTitle}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href={routesHref} className="transition-colors hover:text-zinc-800">
          {messages.nav.readingRoutes}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">编辑故事</span>
      </nav>

      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href={routesHref}>← 返回故事列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">编辑故事</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {scene.tsid}
        </p>
      </div>
      <ReadingRouteForm
        key={scene.tsid}
        workId={workId}
        mode="edit"
        defaultValues={scene}
        characters={characters}
        locations={locations}
      />
    </div>
  );
}
