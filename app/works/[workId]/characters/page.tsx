"use client";

import { ChevronRight, Plus as PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { CharacterTable } from "@/components/characters/CharacterTable";
import { Button } from "@/components/ui/button";
import { useCharacters } from "@/hooks/useCharacters";
import { getWork } from "@/lib/works";
import type { Work } from "@/lib/types";

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

export default function WorkCharactersPage() {
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

  const { characters, loading, error, deleteCharacter } =
    useCharacters(workId);

  const workTitle =
    workLoading ? "加载中…" : work?.title ?? "未知作品";

  const listBase = `/works/${encodeURIComponent(workId)}/characters`;

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
        <span className="font-medium text-zinc-800">角色</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Characters
          </h1>
          <p className="text-muted-foreground text-sm">
            管理当前作品下的角色数据
          </p>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link href={`${listBase}/new`}>
            <PlusIcon className="size-4" aria-hidden />
            新增角色
          </Link>
        </Button>
      </header>

      <CharacterTable
        workId={workId}
        characters={characters}
        loading={loading}
        error={error}
        onDelete={deleteCharacter}
      />
    </div>
  );
}
