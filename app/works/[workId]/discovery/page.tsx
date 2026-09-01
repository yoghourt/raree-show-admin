"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import * as React from "react";

import { DiscoveryComposer } from "@/components/discovery/DiscoveryComposer";
import { Button } from "@/components/ui/button";
import { useDiscoverySession } from "@/hooks/useDiscoverySession";
import { useRollout } from "@/hooks/useRollout";
import {
  DISCOVERY_GO_PRODUCTION,
  DISCOVERY_PAGE_SUBTITLE,
  DISCOVERY_PAGE_TITLE,
} from "@/lib/discovery/ui-copy";
import { getWork } from "@/lib/works";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function WorkDiscoveryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : raw ?? "";
  const initialStep =
    searchParams.get("step") === "rollout" ? ("rollout" as const) : undefined;

  const [work, setWork] = React.useState<Work | null>(null);
  const [workLoading, setWorkLoading] = React.useState(true);
  const [workError, setWorkError] = React.useState<string | null>(null);
  const [operatorId, setOperatorId] = React.useState<string | null>(null);
  const [authError, setAuthError] = React.useState<string | null>(null);

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
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) {
        return;
      }
      if (error || !data.user) {
        setAuthError("无法获取当前用户");
        setOperatorId(null);
        return;
      }
      setOperatorId(data.user.id);
      setAuthError(null);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const discovery = useDiscoverySession({
    workId,
    operatorId: operatorId ?? "",
    // IMPLEMENT-RFN-001: no production Work Canon. Accept uses Human Review +
    // Granularity. Spike catalogs must not be loaded as Canon.
  });

  const rollout = useRollout({
    workId,
    operatorId: operatorId ?? "",
  });

  const workTitle = workLoading ? "加载中…" : work?.title ?? "未知作品";

  return (
    <div className="flex h-screen flex-col overflow-hidden px-3 pb-2 pt-2">
      {workError ? (
        <div
          className="mb-1.5 shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
          role="alert"
        >
          {workError}
        </div>
      ) : null}

      {authError ? (
        <div
          className="mb-1.5 shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive"
          role="alert"
        >
          {authError}
        </div>
      ) : null}

      <header className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 pb-2">
        <div className="min-w-0">
          <nav
            className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs"
            aria-label="面包屑"
          >
            <Link href="/" className="hover:text-foreground">
              首页
            </Link>
            <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
            <Link href="/works" className="hover:text-foreground">
              作品管理
            </Link>
            <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
            <span className="text-foreground max-w-[160px] truncate font-medium">
              {workTitle}
            </span>
            <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
            <span className="text-foreground font-medium">
              {DISCOVERY_PAGE_TITLE}
            </span>
          </nav>
          <h1 className="text-base font-semibold leading-tight text-zinc-900">
            {DISCOVERY_PAGE_TITLE}
            <span className="ml-2 font-normal text-xs text-zinc-500">
              {DISCOVERY_PAGE_SUBTITLE}
            </span>
          </h1>
        </div>
        {workId ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href={`/works/${encodeURIComponent(workId)}/production`}>
              {DISCOVERY_GO_PRODUCTION}
            </Link>
          </Button>
        ) : null}
      </header>

      {operatorId ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <DiscoveryComposer
            discovery={discovery}
            rollout={rollout}
            initialStep={initialStep}
          />
        </div>
      ) : null}
    </div>
  );
}
