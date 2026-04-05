"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { LocationForm } from "@/components/locations/LocationForm";
import { Button } from "@/components/ui/button";
import { getLocation } from "@/lib/locations";
import { getWork } from "@/lib/works";
import type { Location, Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function EditLocationPage() {
  const params = useParams();
  const rawWork = params.workId;
  const workId = Array.isArray(rawWork) ? rawWork[0] : rawWork ?? "";
  const rawLoc = params.locationId;
  const locParam = Array.isArray(rawLoc) ? rawLoc[0] : rawLoc ?? "";
  const locationTsid = locParam ? decodeURIComponent(locParam) : "";

  const [work, setWork] = React.useState<Work | null>(null);
  const [workLoading, setWorkLoading] = React.useState(true);
  const [location, setLocation] = React.useState<Location | null>(null);
  const [locationLoading, setLocationLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workId || !locationTsid) {
      setWork(null);
      setLocation(null);
      setWorkLoading(false);
      setLocationLoading(false);
      return;
    }
    let cancelled = false;
    setWorkLoading(true);
    setLocationLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const [w, loc] = await Promise.all([
          getWork(workId),
          getLocation(workId, locationTsid),
        ]);
        if (cancelled) return;
        setWork(w);
        setLocation(loc);
      } catch (e) {
        if (!cancelled) {
          setLoadError(toErrorMessage(e));
          setWork(null);
          setLocation(null);
        }
      } finally {
        if (!cancelled) {
          setWorkLoading(false);
          setLocationLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workId, locationTsid]);

  const listHref = `/works/${encodeURIComponent(workId)}/locations`;
  const workTitle =
    workLoading ? "加载中…" : work?.title ?? "未知作品";
  const pageLoading = workLoading || locationLoading;

  if (pageLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href={listHref}>← 返回地点列表</Link>
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
          <Link href={listHref}>← 返回地点列表</Link>
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

  if (!location) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href={listHref}>← 返回地点列表</Link>
        </Button>
        <p className="text-muted-foreground">
          未找到该地点（tsid：{locationTsid || "—"}）。
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
          href={listHref}
          className="max-w-[140px] truncate transition-colors hover:text-zinc-800"
        >
          {workTitle}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href={listHref} className="transition-colors hover:text-zinc-800">
          地点
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">编辑地点</span>
      </nav>

      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href={listHref}>← 返回地点列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">编辑地点</h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          {location.tsid}
        </p>
      </div>
      <LocationForm
        key={location.tsid}
        workId={workId}
        mode="edit"
        defaultValues={location}
      />
    </div>
  );
}
