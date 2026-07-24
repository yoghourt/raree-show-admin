"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createMediaAdmissionProviders,
  type MediaAdmissionProviderId,
} from "@/lib/media-admission";
import { isEmptyFrameUrl } from "@/lib/production/completion-profile";
import * as scenesApi from "@/lib/scenes";
import type { ReadingRoute } from "@/lib/types";

type PendingFill = {
  routeTsid: string;
  frameIndex: number;
  caption: string;
  routeTitle: string;
  providerId: MediaAdmissionProviderId;
  /** Candidate URL after provider — not Asset truth until Write */
  candidateUrl: string | null;
  candidateLabel: string | null;
  busy: boolean;
  pasteUrlDraft: string;
};

export type BatchFrameCompletionProps = {
  workId: string;
  routes: ReadingRoute[];
  incompleteCount: number;
  onWrote: () => void;
};

const providers = createMediaAdmissionProviders();

function rowKey(routeTsid: string, frameIndex: number): string {
  return `${routeTsid}:${frameIndex}`;
}

/**
 * Batch frame URL fill via Media Admission providers.
 * Provider success = candidate only. Write = Human Accept into Assets (Gate E).
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
          providerId: "local_upload",
          candidateUrl: null,
          candidateLabel: null,
          busy: false,
          pasteUrlDraft: "",
        });
      });
    }
    setRows(next);
  }, [routes]);

  const readyCount = rows.filter((r) => r.candidateUrl).length;

  const patchRow = (key: string, patch: Partial<PendingFill>) => {
    setRows((prev) =>
      prev.map((r) =>
        rowKey(r.routeTsid, r.frameIndex) === key ? { ...r, ...patch } : r
      )
    );
  };

  const obtainForRow = async (
    row: PendingFill,
    input: { file?: File; url?: string }
  ) => {
    const key = rowKey(row.routeTsid, row.frameIndex);
    const provider = providers.find((p) => p.id === row.providerId);
    if (!provider) return;

    patchRow(key, { busy: true });
    setWriteError(null);
    try {
      const candidate = await provider.obtainCandidate({
        caption: row.caption,
        routeTitle: row.routeTitle,
        ...input,
      });
      patchRow(key, {
        busy: false,
        candidateUrl: candidate.url,
        candidateLabel: candidate.label ?? null,
      });
    } catch (e) {
      patchRow(key, { busy: false });
      setWriteError(e instanceof Error ? e.message : String(e));
    }
  };

  const writeToAssets = async () => {
    const ready = rows.filter((r) => r.candidateUrl);
    if (ready.length === 0) return;
    setWriting(true);
    setWriteError(null);
    try {
      const byRoute = new Map<
        string,
        Array<{ frameIndex: number; url: string }>
      >();
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
          上传 / 粘贴 URL 仅产生候选（candidate ≠ Asset）。点击「写入作品」才进入
          Assets（Human Accept）。Job/候选成功 ≠ Production Plan 完成。
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
        <ul className="space-y-3">
          {rows.map((row) => {
            const key = rowKey(row.routeTsid, row.frameIndex);
            return (
              <li
                key={key}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {row.routeTitle} · 帧 {row.frameIndex + 1}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{row.caption}</p>
                  {row.candidateUrl ? (
                    <p className="mt-1 truncate text-[11px] text-emerald-700">
                      候选已就绪（未写入）
                      {row.candidateLabel ? ` · ${row.candidateLabel}` : ""}
                    </p>
                  ) : row.busy ? (
                    <p className="mt-1 text-xs text-zinc-500">获取候选中…</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2" role="group" aria-label="来源">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={row.busy || writing}
                      onClick={() =>
                        patchRow(key, {
                          providerId: p.id,
                          candidateUrl: null,
                          candidateLabel: null,
                        })
                      }
                      className={
                        row.providerId === p.id
                          ? "rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-xs text-white"
                          : "rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {row.providerId === "local_upload" ? (
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm">
                    <span className="rounded-md border border-zinc-200 px-3 py-1.5 text-zinc-800 hover:bg-zinc-50">
                      选择图片
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={row.busy || writing}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void obtainForRow(row, { file });
                      }}
                    />
                  </label>
                ) : null}

                {row.providerId === "paste_url" ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="url"
                      placeholder="https://…"
                      value={row.pasteUrlDraft}
                      disabled={row.busy || writing}
                      onChange={(e) =>
                        patchRow(key, { pasteUrlDraft: e.target.value })
                      }
                      className="max-w-md"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={row.busy || writing || !row.pasteUrlDraft.trim()}
                      onClick={() =>
                        void obtainForRow(row, { url: row.pasteUrlDraft })
                      }
                    >
                      使用 URL
                    </Button>
                  </div>
                ) : null}
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
          Gate E：写入前必须人工确认；候选成功 ≠ 业务完成。
        </p>
      </div>
    </section>
  );
}
