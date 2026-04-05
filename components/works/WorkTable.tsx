"use client";

import { Inbox, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Work } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WorkTableProps = {
  works: Work[];
  loading: boolean;
  error: string | null;
  onDelete: (id: string) => Promise<void>;
};

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="加载中">
      <div className="bg-muted h-4 w-1/3 animate-pulse rounded-md" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-muted/70 h-10 w-full animate-pulse rounded-md"
        />
      ))}
      <p className="text-muted-foreground pt-2 text-center text-sm">加载中…</p>
    </div>
  );
}

export function WorkTable({
  works,
  loading,
  error,
  onDelete,
}: WorkTableProps) {
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
    null
  );
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleteSubmitting(true);
    try {
      await onDelete(deleteTargetId);
      setDeleteTargetId(null);
    } catch {
      /* 错误由父级 error 展示 */
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <>
      {error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm ring-0">
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              无法加载列表，请查看上方错误信息。
            </div>
          ) : works.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
                <Inbox
                  className="size-7 text-zinc-300"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
              <p className="mt-5 text-sm font-medium text-zinc-800">
                暂无作品
              </p>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                点击右上角「新增作品」创建第一条记录。
              </p>
            </div>
          ) : (
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="border-zinc-200 bg-zinc-50 hover:bg-zinc-50">
                  <TableHead className="h-10 w-20 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    封面
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    标题
                  </TableHead>
                  <TableHead className="hidden h-10 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:table-cell">
                    TSID
                  </TableHead>
                  <TableHead className="hidden h-10 max-w-[280px] text-[11px] font-semibold uppercase tracking-wide text-zinc-600 lg:table-cell">
                    描述
                  </TableHead>
                  <TableHead className="h-10 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {works.map((work) => (
                  <TableRow
                    key={work.id}
                    className="border-zinc-100 transition-colors hover:bg-zinc-50/90"
                  >
                    <TableCell className="py-2">
                      {/* 封面为任意外链 URL，不使用 next/image 远程域名配置 */}
                      {work.coverImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={work.coverImage}
                          alt=""
                          className="h-10 w-14 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <div className="h-10 w-14 rounded-md border border-border bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="py-3 font-medium whitespace-nowrap text-zinc-900">
                      {work.title}
                    </TableCell>
                    <TableCell className="hidden py-3 sm:table-cell">
                      <span
                        className={cn(
                          "inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700"
                        )}
                        title={work.tsid}
                      >
                        {work.tsid}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-[280px] py-3 text-sm text-zinc-600 lg:table-cell">
                      <span className="line-clamp-2">{work.description}</span>
                    </TableCell>
                    <TableCell className="py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/works/${encodeURIComponent(work.id)}/scenes`}
                          >
                            进入内容
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/works/${encodeURIComponent(work.id)}/edit`}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            编辑
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          type="button"
                          onClick={() => setDeleteTargetId(work.id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除该作品吗？若数据库未配置级联删除，请先处理其下的场景数据。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleteSubmitting}
              onClick={() => setDeleteTargetId(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSubmitting}
              onClick={() => void confirmDelete()}
            >
              {deleteSubmitting ? "删除中…" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
