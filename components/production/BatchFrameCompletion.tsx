"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { isEmptyFrameUrl } from "@/lib/production/completion-profile";
import * as scenesApi from "@/lib/scenes";
import type { ReadingRoute } from "@/lib/types";

type PendingFill = {
  routeTsid: string;
  frameIndex: number;
  caption: string;
  routeTitle: string;
  /** Candidate URL after upload — not Asset truth until Write */
  candidateUrl: string | null;
  uploading: boolean;
  fileName: string | null;
};

export type BatchFrameCompletionProps = {
  workId: string;
  routes: ReadingRoute[];
  incompleteCount: number;
  onWrote: () => void;
};

/**
 * Batch frame URL fill.
 * Upload = Execution (candidate). Write = Human Accept into Assets (Gate E).
 * Does not use ReadingRouteForm (which filters empty urls on submit).
 */
export function BatchFrameCompletion({
  workId,
  routes,
  incompleteCount,
  onWrote,
}: BatchFrameCompletionProps) {
  const [rows, setRows] = React.useState<PendingFill[]>([]);
  const [writeError, setWriteError] = React.useState<string | null>(null);
  const [writing, setWriting] = React.useState(false);

  React.useEffect(() => {
    const next: PendingFill[] = [];
    for (const route of routes) {
      const frames = route.story_images_v2 ?? [];
      frames.forEach((frame, frameIndex) => {
        if (!frame.caption?.trim()) return;
        if (!isEmptyFrameUrl(frame.url)) return;
        next.push({
          routeTsid: route.tsid,
          frameIndex,
          caption: frame.caption,
          routeTitle: route.title || route.tsid,
          candidateUrl: null,
          uploading: false,
          fileName: null,
        });
      });
    }
    setRows(next);
  }, [routes]);

  const readyCount = rows.filter((r) => r.candidateUrl).length;

  const onPickFile = async (key: string, file: File | undefined) => {
    if (!file) return;
    setRows((prev) =>
      prev.map((r) =>
        `${r.routeTsid}:${r.frameIndex}` === key
          ? { ...r, uploading: true, fileName: file.name }
          : r
      )
    );
    setWriteError(null);
    try {
      const url = await uploadToCloudinary(file);
      setRows((prev) =>
        prev.map((r) =>
          `${r.routeTsid}:${r.frameIndex}` === key
            ? { ...r, uploading: false, candidateUrl: url }
            : r
        )
      );
    } catch (e) {
      setRows((prev) =>
        prev.map((r) =>
          `${r.routeTsid}:${r.frameIndex}` === key
            ? { ...r, uploading: false }
            : r
        )
      );
      setWriteError(e instanceof Error ? e.message : String(e));
    }
  };

  const writeToAssets = async () => {
    const ready = rows.filter((r) => r.candidateUrl);
    if (ready.length === 0) return;
    setWriting(true);
    setWriteError(null);
    try {
      const byRoute = new Map<string, Array<{ frameIndex: number; url: string }>>();
      for (const r of ready) {
        const list = byRoute.get(r.routeTsid) ?? [];
        list.push({ frameIndex: r.frameIndex, url: r.candidateUrl! });
        byRoute.set(r.routeTsid, list);
      }
      for (const [tsid, patches] of byRoute) {
        await scenesApi.patchSceneFrameUrls(workId, tsid, patches);
      }
      onWrote();
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setWriting(false);
    }
  };

  if (incompleteCount === 0 && rows.length === 0) {
    return null;
  }

  return (
    <section
      id="batch-frames"
      className="space-y-3 scroll-mt-8"
      aria-labelledby="batch-frames-heading"
    >
      <div>
        <h2
          id="batch-frames-heading"
          className="text-base font-semibold text-zinc-900"
        >
          批量补齐画面图
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          上传仅为执行（候选 URL）。点击「写入作品」才进入 Assets（Human
          Accept）。不会自动完成 Production Plan。
        </p>
      </div>

      {writeError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {writeError}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">没有待补图的帧。</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const key = `${row.routeTsid}:${row.frameIndex}`;
            return (
              <li
                key={key}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {row.routeTitle} · 帧 {row.frameIndex + 1}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{row.caption}</p>
                  {row.candidateUrl ? (
                    <p className="mt-1 truncate font-mono text-[11px] text-emerald-700">
                      候选已就绪（未写入）
                    </p>
                  ) : row.uploading ? (
                    <p className="mt-1 text-xs text-zinc-500">上传中…</p>
                  ) : null}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <span className="rounded-md border border-zinc-200 px-3 py-1.5 text-zinc-800 hover:bg-zinc-50">
                    选择图片
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={row.uploading || writing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      void onPickFile(key, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={writing || readyCount === 0}
          onClick={() => void writeToAssets()}
        >
          {writing ? "写入中…" : `写入作品（${readyCount}）`}
        </Button>
        <p className="text-xs text-zinc-500">
          Gate E：写入前必须人工确认；Job/上传成功 ≠ 业务完成。
        </p>
      </div>
    </section>
  );
}
