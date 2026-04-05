import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { WorkForm } from "@/components/works/WorkForm";
import { Button } from "@/components/ui/button";

export default function NewWorkPage() {
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
        <span className="font-medium text-zinc-800">新增作品</span>
      </nav>

      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/works">← 返回列表</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">新增作品</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          填写标题、描述与封面图片链接。
        </p>
      </div>
      <WorkForm mode="create" />
    </div>
  );
}
