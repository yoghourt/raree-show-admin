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
import type { Location } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LocationTableProps = {
  workId: string;
  locations: Location[];
  loading: boolean;
  error: string | null;
  onDelete: (tsid: string) => Promise<void>;
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

export function LocationTable({
  workId,
  locations,
  loading,
  error,
  onDelete,
}: LocationTableProps) {
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
    null
  );
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);

  const base = `/works/${encodeURIComponent(workId)}/locations`;

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleteSubmitting(true);
    try {
      await onDelete(deleteTargetId);
      setDeleteTargetId(null);
    } catch {
      /* 错误由父级展示 */
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
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
                <Inbox
                  className="size-7 text-zinc-300"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
              <p className="mt-5 text-sm font-medium text-zinc-800">
                暂无地点
              </p>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                点击右上角「新增地点」创建第一条记录。
              </p>
            </div>
          ) : (
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="border-zinc-200 bg-zinc-50 hover:bg-zinc-50">
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    TSID
                  </TableHead>
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                    名称
                  </TableHead>
                  <TableHead className="hidden h-10 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 sm:table-cell">
                    地区
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
                {locations.map((loc) => (
                  <TableRow
                    key={loc.tsid}
                    className="border-zinc-100 transition-colors hover:bg-zinc-50/90"
                  >
                    <TableCell className="whitespace-nowrap py-3">
                      <span
                        className={cn(
                          "inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-700"
                        )}
                        title={loc.tsid}
                      >
                        {loc.tsid}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 font-medium whitespace-nowrap text-zinc-900">
                      {loc.name}
                    </TableCell>
                    <TableCell className="hidden py-3 whitespace-nowrap text-zinc-600 sm:table-cell">
                      {loc.region || "—"}
                    </TableCell>
                    <TableCell className="hidden max-w-[280px] py-3 text-sm text-zinc-600 lg:table-cell">
                      <span className="line-clamp-2">{loc.description}</span>
                    </TableCell>
                    <TableCell className="py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`${base}/${encodeURIComponent(loc.tsid)}/edit`}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            编辑
                          </Link>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          type="button"
                          onClick={() => setDeleteTargetId(loc.tsid)}
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
              确定要删除该地点吗？此操作将从数据库中永久移除该记录。
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
