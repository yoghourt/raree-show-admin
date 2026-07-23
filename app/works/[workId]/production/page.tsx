"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { ProductionBoard } from "@/components/production/ProductionBoard";
import { Button } from "@/components/ui/button";
import * as charactersApi from "@/lib/characters";
import { deriveProductionPlan } from "@/lib/production/derive-tasks";
import type { ProductionPlanProjection } from "@/lib/production/types";
import * as scenesApi from "@/lib/scenes";
import { messages } from "@/lib/locale";
import type { ReadingRoute, Work } from "@/lib/types";
import { getWork } from "@/lib/works";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function WorkProductionPage() {
  const params = useParams();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : raw ?? "";

  const [work, setWork] = React.useState<Work | null>(null);
  const [routes, setRoutes] = React.useState<ReadingRoute[]>([]);
  const [plan, setPlan] = React.useState<ProductionPlanProjection | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!workId) {
      setWork(null);
      setPlan(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [w, chars, scenes] = await Promise.all([
          getWork(workId),
          charactersApi.getAll(workId),
          scenesApi.getScenes(workId),
        ]);
        if (cancelled) return;
        if (!w) {
          setWork(null);
          setPlan(null);
          setError("作品不存在");
          return;
        }
        setWork(w);
        setRoutes(scenes);
        setPlan(
          deriveProductionPlan({
            work: w,
            characters: chars,
            routes: scenes,
          })
        );
      } catch (e) {
        if (!cancelled) {
          setError(toErrorMessage(e));
          setWork(null);
          setPlan(null);
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
  }, [workId, reloadToken]);

  const workTitle = loading ? "加载中…" : work?.title ?? "未知作品";
  const base = `/works/${encodeURIComponent(workId)}`;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      {error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <nav className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        <Link href="/" className="hover:text-foreground">
          首页
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href="/works" className="hover:text-foreground">
          {messages.nav.works}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link
          href={`/works/${encodeURIComponent(workId)}/edit`}
          className="text-foreground font-medium hover:underline"
        >
          {workTitle}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="text-foreground font-medium">制作</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            制作看板
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            可视化 Production Plan（Runtime）。看板是 UI，不是第二套 Runtime
            Truth。派生任务随 Assets 重算。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`${base}/edit`}>编辑作品</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`${base}/reading-routes`}>{messages.domain.readingRoute}</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`${base}/characters`}>角色</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`${base}/discovery`}>Discovery</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">加载 Production Context…</p>
      ) : plan && work ? (
        <ProductionBoard
          workId={workId}
          plan={plan}
          routes={routes}
          onAssetsChanged={() => setReloadToken((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
