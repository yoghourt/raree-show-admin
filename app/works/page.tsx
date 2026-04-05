"use client";

import { ChevronRight, Plus as PlusIcon } from "lucide-react";
import Link from "next/link";

import { WorkTable } from "@/components/works/WorkTable";
import { Button } from "@/components/ui/button";
import { useWorks } from "@/hooks/useWorks";

export default function WorksPage() {
  const { works, loading, error, deleteWork } = useWorks();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <nav
        className="flex flex-wrap items-center gap-1 text-sm text-zinc-500"
        aria-label="面包屑"
      >
        <Link href="/" className="transition-colors hover:text-zinc-800">
          首页
        </Link>
        <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-zinc-800">作品管理</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Works
          </h1>
          <p className="text-muted-foreground text-sm">管理所有作品与内容入口</p>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link href="/works/new">
            <PlusIcon className="size-4" aria-hidden />
            新增作品
          </Link>
        </Button>
      </header>

      <WorkTable
        works={works}
        loading={loading}
        error={error}
        onDelete={deleteWork}
      />
    </div>
  );
}
