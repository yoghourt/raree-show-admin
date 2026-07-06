"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

import { LocationForm, type LocationFormValues } from "@/components/locations/LocationForm";
import { Button } from "@/components/ui/button";
import { buildDiscoveryPagePath, loadDiscoveryAcceptPrefill } from "@/lib/discovery/accept-prefill";
import { locationPrefillToFormValues } from "@/lib/discovery/review-state";
import { discoveryHandoffUi } from "@/lib/discovery/ui-copy";
import { getWork } from "@/lib/works";
import type { Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function NewLocationPage() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : raw ?? "";
  const discoveryReviewId = searchParams.get("discoveryReviewId");

  const [work, setWork] = React.useState<Work | null>(null);
  const [workLoading, setWorkLoading] = React.useState(true);
  const [workError, setWorkError] = React.useState<string | null>(null);
  const [prefillValues, setPrefillValues] = React.useState<
    Partial<LocationFormValues> | undefined
  >(undefined);

  React.useEffect(() => {
    if (!discoveryReviewId) {
      setPrefillValues(undefined);
      return;
    }
    const prefill = loadDiscoveryAcceptPrefill(discoveryReviewId);
    if (prefill?.candidateType === "location") {
      setPrefillValues(locationPrefillToFormValues(prefill));
    } else {
      setPrefillValues(undefined);
    }
  }, [discoveryReviewId, pathname]);

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

  const listHref = `/works/${encodeURIComponent(workId)}/locations`;
  const discoveryHref = buildDiscoveryPagePath(workId);
  const isDiscoveryHandoff = Boolean(discoveryReviewId);
  const backHref = isDiscoveryHandoff ? discoveryHref : listHref;
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
          href={listHref}
          className="max-w-[160px] truncate transition-colors hover:text-zinc-800"
        >
          {workTitle}
        </Link>
        {isDiscoveryHandoff ? (
          <>
            <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
            <Link href={discoveryHref} className="transition-colors hover:text-zinc-800">
              {discoveryHandoffUi.breadcrumbDiscovery}
            </Link>
          </>
        ) : (
          <>
            <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
            <Link href={listHref} className="transition-colors hover:text-zinc-800">
              地点
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">新增地点</span>
      </nav>

      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href={backHref}>
          {isDiscoveryHandoff ? discoveryHandoffUi.backToDiscovery : "← 返回地点列表"}
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">新增地点</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          填写名称、地区与描述。
        </p>
      </div>
      {workId ? (
        <LocationForm
          key={
            discoveryReviewId
              ? `${discoveryReviewId}:${prefillValues?.name ?? ""}`
              : "new"
          }
          workId={workId}
          mode="create"
          initialValues={prefillValues}
          successRedirectHref={isDiscoveryHandoff ? discoveryHref : undefined}
        />
      ) : (
        <p className="text-muted-foreground text-sm">无效的作品 ID。</p>
      )}
    </div>
  );
}
