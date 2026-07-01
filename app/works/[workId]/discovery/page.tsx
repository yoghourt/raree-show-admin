"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { DiscoveryComposer } from "@/components/discovery/DiscoveryComposer";
import { useDiscoverySession } from "@/hooks/useDiscoverySession";
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
  const raw = params.workId;
  const workId = Array.isArray(raw) ? raw[0] : raw ?? "";

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
  });

  const workTitle = workLoading ? "加载中…" : work?.title ?? "未知作品";

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      {workError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {workError}
        </div>
      ) : null}

      {authError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {authError}
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
        <span className="font-medium text-zinc-800">Discovery</span>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Discovery
        </h1>
        <p className="text-muted-foreground text-sm">
          叙事优先的 Discovery 会话（SPEC-D3-001）。锁定叙事后方可进入 Propose（D3-003）。
        </p>
      </header>

      {operatorId ? <DiscoveryComposer discovery={discovery} /> : null}
    </div>
  );
}
