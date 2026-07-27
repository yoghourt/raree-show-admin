"use client";

import * as React from "react";

import { enqueueFrameDraftJobs } from "@/app/actions/enqueueFrameDraftJobs";
import { generateFrameDraft } from "@/app/actions/generateFrameDraft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listGenerateJobsForWork,
  parseHostedImageResultReference,
  type GenerateJobRow,
  type HostedImageResultReference,
} from "@/lib/generate-jobs";
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
  /** Candidate URL after obtain/generate — not Asset truth until Write */
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

function jobFrameIndex(job: GenerateJobRow): number | null {
  const raw = job.input_json.frame_index;
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0
    ? raw
    : null;
}

function jobHosted(
  job: GenerateJobRow
): HostedImageResultReference | null {
  if (job.status !== "succeeded") return null;
  return parseHostedImageResultReference(job.result_reference);
}

function frameAssetUrl(
  routes: ReadingRoute[],
  sceneTsid: string,
  frameIndex: number
): string | null {
  const route = routes.find((r) => r.tsid === sceneTsid);
  const url = route?.story_images_v2?.[frameIndex]?.url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

/**
 * Batch frame URL fill via Media Admission.
 * Channels: upload / paste URL. Preferred generate: enqueue (SPIKE-IMG-003).
 * Sync「生成草稿」= migration compatibility only.
 * Slice 3: succeeded job → ephemeral Candidate → Human Accept → Asset.
 * Job / result_reference ≠ Candidate ≠ Asset.
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
  const [jobs, setJobs] = React.useState<GenerateJobRow[]>([]);
  const [jobsError, setJobsError] = React.useState<string | null>(null);
  const [enqueueBusy, setEnqueueBusy] = React.useState(false);
  const [admitHint, setAdmitHint] = React.useState<string | null>(null);

  const refreshJobs = React.useCallback(async () => {
    try {
      const list = await listGenerateJobsForWork(workId, { limit: 40 });
      setJobs(list);
      setJobsError(null);
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : String(e));
    }
  }, [workId]);

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

  React.useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

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

  /** SPIKE-IMG-003: enqueue only — does not generate or create Candidates. */
  const enqueueRows = async (targets: PendingFill[]) => {
    if (targets.length === 0) return;
    setEnqueueBusy(true);
    setWriteError(null);
    try {
      const result = await enqueueFrameDraftJobs({
        workId,
        frames: targets.map((r) => ({
          sceneTsid: r.routeTsid,
          frameIndex: r.frameIndex,
          caption: r.caption,
          routeTitle: r.routeTitle,
        })),
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      await refreshJobs();
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnqueueBusy(false);
    }
  };

  /**
   * Migration compatibility only — sync Capability path.
   * Prefer「排队生成」+ Local Worker (slice 2).
   */
  const generateForRow = async (row: PendingFill) => {
    const key = rowKey(row.routeTsid, row.frameIndex);
    patchRow(key, { busy: true });
    setWriteError(null);
    try {
      const result = await generateFrameDraft({
        caption: row.caption,
        routeTitle: row.routeTitle,
      });
      if (!result.ok) {
        patchRow(key, { busy: false });
        setWriteError(result.message);
        return;
      }
      patchRow(key, {
        busy: false,
        candidateUrl: result.url,
        candidateLabel: "生成草稿（同步·兼容）",
      });
    } catch (e) {
      patchRow(key, { busy: false });
      setWriteError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Slice 3: Execution result_reference → ephemeral Candidate (UI only). */
  const admitJobAsCandidate = (
    job: GenerateJobRow
  ): { ok: true } | { ok: false; reason: string } => {
    const hosted = jobHosted(job);
    if (!hosted) {
      return { ok: false, reason: "job 无可用 result_reference" };
    }
    if (job.subject_type !== "scene") {
      return { ok: false, reason: "仅支持 subject_type=scene" };
    }
    const frameIndex = jobFrameIndex(job);
    if (frameIndex === null) {
      return { ok: false, reason: "input_json.frame_index 无效" };
    }
    if (frameAssetUrl(routes, job.subject_id, frameIndex)) {
      return {
        ok: false,
        reason: `${job.subject_id} 帧 ${frameIndex + 1} 已有 Asset，已跳过`,
      };
    }
    const key = rowKey(job.subject_id, frameIndex);
    const pending = rows.find(
      (r) => rowKey(r.routeTsid, r.frameIndex) === key
    );
    if (!pending) {
      return {
        ok: false,
        reason: `找不到待补帧 ${job.subject_id} · 帧 ${frameIndex + 1}`,
      };
    }
    patchRow(key, {
      candidateUrl: hosted.url,
      candidateLabel: "来自 Job result_reference",
    });
    return { ok: true };
  };

  const admitAllSucceeded = () => {
    setWriteError(null);
    let admitted = 0;
    const skipped: string[] = [];
    for (const job of jobs) {
      if (job.status !== "succeeded" || !jobHosted(job)) continue;
      const result = admitJobAsCandidate(job);
      if (result.ok) admitted += 1;
      else skipped.push(result.reason);
    }
    setAdmitHint(
      admitted > 0
        ? `已纳入候选 ${admitted} 条${skipped.length ? `；跳过 ${skipped.length}` : ""}。仍须「写入作品」才写 Asset。`
        : skipped[0] ?? "没有可纳入的 succeeded job"
    );
  };

  const acceptAndWriteJob = async (job: GenerateJobRow) => {
    const hosted = jobHosted(job);
    if (!hosted || job.subject_type !== "scene") {
      setWriteError("无法 Accept：缺少 hosted result_reference");
      return;
    }
    const frameIndex = jobFrameIndex(job);
    if (frameIndex === null) {
      setWriteError("无法 Accept：frame_index 无效");
      return;
    }
    if (frameAssetUrl(routes, job.subject_id, frameIndex)) {
      setWriteError("该帧已有 Asset，无需再写");
      return;
    }

    setWriting(true);
    setWriteError(null);
    setAdmitHint(null);
    const admit = admitJobAsCandidate(job);
    if (!admit.ok) {
      setWriting(false);
      setWriteError(admit.reason);
      return;
    }
    try {
      await scenesApi.patchSceneFrameUrls(workId, job.subject_id, [
        { frameIndex, url: hosted.url },
      ]);
      onWrote();
      await refreshJobs();
      setAdmitHint(
        `已 Accept 并写入 ${job.subject_id} · 帧 ${frameIndex + 1}`
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setWriting(false);
    }
  };

  const requeueFromJob = async (job: GenerateJobRow) => {
    if (job.subject_type !== "scene") return;
    const frameIndex = jobFrameIndex(job);
    if (frameIndex === null) return;
    const caption =
      typeof job.input_json.caption === "string"
        ? job.input_json.caption.trim()
        : "";
    if (!caption) {
      setWriteError("重新排队失败：job 无 caption");
      return;
    }
    const routeTitle =
      typeof job.input_json.route_title === "string"
        ? job.input_json.route_title
        : undefined;
    setEnqueueBusy(true);
    setWriteError(null);
    try {
      const result = await enqueueFrameDraftJobs({
        workId,
        frames: [
          {
            sceneTsid: job.subject_id,
            frameIndex,
            caption,
            routeTitle,
          },
        ],
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      await refreshJobs();
      setAdmitHint("已重新排队（新 job）；旧 succeeded 保留作历史");
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnqueueBusy(false);
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
      setAdmitHint(null);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setWriting(false);
    }
  };

  const succeededAdmittable = jobs.filter((job) => {
    const hosted = jobHosted(job);
    if (!hosted || job.subject_type !== "scene") return false;
    const frameIndex = jobFrameIndex(job);
    if (frameIndex === null) return false;
    if (frameAssetUrl(routes, job.subject_id, frameIndex)) return false;
    return rows.some(
      (r) =>
        r.routeTsid === job.subject_id && r.frameIndex === frameIndex
    );
  });

  if (incompleteCount === 0 && rows.length === 0 && jobs.length === 0) {
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
          排队 → Worker → result_reference（Job）→「纳入候选」（Candidate）→
          「写入作品」（Asset）。Job ≠ Candidate ≠ Asset。未 Accept 前不写
          story_images_v2。
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

      {admitHint ? (
        <p className="text-xs text-emerald-800" role="status">
          {admitHint}
        </p>
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
                <div className="flex min-w-0 gap-3">
                  {row.candidateUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.candidateUrl}
                      alt=""
                      className="h-16 w-28 shrink-0 rounded object-cover bg-zinc-100"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
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
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={row.busy || writing || enqueueBusy}
                    onClick={() => void enqueueRows([row])}
                  >
                    排队生成
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={row.busy || writing || enqueueBusy}
                    onClick={() => void generateForRow(row)}
                    title="迁移兼容：同步直连 Capability；新功能请用排队生成"
                  >
                    {row.busy ? "生成中…" : "同步生成（兼容）"}
                  </Button>
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
                      disabled={
                        row.busy || writing || !row.pasteUrlDraft.trim()
                      }
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

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={writing || enqueueBusy || rows.length === 0}
            onClick={() => void enqueueRows(rows)}
          >
            {enqueueBusy ? "排队中…" : `全部排队（${rows.length}）`}
          </Button>
          <p className="text-xs text-zinc-500">
            入队后跑 Local Worker；succeeded 后在下方纳入候选再写入。
          </p>
        </div>
      ) : null}

      <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-900">Generate Jobs</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                writing || enqueueBusy || succeededAdmittable.length === 0
              }
              onClick={() => admitAllSucceeded()}
            >
              全部纳入候选（{succeededAdmittable.length}）
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={enqueueBusy}
              onClick={() => void refreshJobs()}
            >
              刷新
            </Button>
          </div>
        </div>
        {jobsError ? (
          <p className="text-destructive text-xs" role="alert">
            {jobsError}
            （若提示表不存在，请先在 Supabase 执行 docs/supabase/migrations/20260726000000_generate_jobs.sql）
          </p>
        ) : null}
        {jobs.length === 0 && !jobsError ? (
          <p className="text-xs text-zinc-500">暂无任务。排队后出现于此。</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto text-xs">
            {jobs.map((job) => {
              const frameIndex = jobFrameIndex(job);
              const frameLabel =
                frameIndex !== null ? `帧 ${frameIndex + 1}` : "—";
              const hosted = jobHosted(job);
              const alreadyWritten =
                frameIndex !== null &&
                job.subject_type === "scene" &&
                Boolean(frameAssetUrl(routes, job.subject_id, frameIndex));
              const canAdmit =
                Boolean(hosted) &&
                job.subject_type === "scene" &&
                frameIndex !== null &&
                !alreadyWritten &&
                rows.some(
                  (r) =>
                    r.routeTsid === job.subject_id &&
                    r.frameIndex === frameIndex
                );
              const pendingHasCandidate =
                frameIndex !== null &&
                rows.some(
                  (r) =>
                    r.routeTsid === job.subject_id &&
                    r.frameIndex === frameIndex &&
                    Boolean(r.candidateUrl)
                );

              return (
                <li
                  key={job.id}
                  className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-zinc-200/80 pb-2 last:border-0"
                >
                  {hosted?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hosted.url}
                      alt=""
                      className="h-12 w-20 shrink-0 rounded object-cover bg-zinc-100"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-zinc-800">
                        {job.status}
                      </span>
                      <span className="text-zinc-500">
                        {job.subject_id} · {frameLabel}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(job.created_at).toLocaleString()}
                      </span>
                      {alreadyWritten ? (
                        <span className="text-emerald-700">已写入 Asset</span>
                      ) : pendingHasCandidate && hosted ? (
                        <span className="text-amber-700">已在候选</span>
                      ) : null}
                    </div>
                    {job.error ? (
                      <p className="text-destructive">{job.error}</p>
                    ) : null}
                    {hosted?.url ? (
                      <p className="truncate text-[11px] text-zinc-500">
                        Execution 结果 ≠ Candidate ≠ Asset
                        {hosted.usedFallback ? " · usedFallback" : ""}
                      </p>
                    ) : job.result_reference ? (
                      <p className="truncate text-zinc-600">
                        result_reference: {job.result_reference}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {canAdmit ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={writing || enqueueBusy}
                            onClick={() => {
                              setWriteError(null);
                              const result = admitJobAsCandidate(job);
                              if (!result.ok) {
                                setWriteError(result.reason);
                                return;
                              }
                              setAdmitHint(
                                "已纳入候选；点下方「写入作品」才写 Asset"
                              );
                            }}
                          >
                            纳入候选
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={writing || enqueueBusy}
                            onClick={() => void acceptAndWriteJob(job)}
                          >
                            Accept 并写入
                          </Button>
                        </>
                      ) : null}
                      {(job.status === "succeeded" ||
                        job.status === "failed") &&
                      job.subject_type === "scene" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={writing || enqueueBusy}
                          onClick={() => void requeueFromJob(job)}
                        >
                          重新排队
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={writing || readyCount === 0}
          onClick={() => void writeToAssets()}
        >
          {writing ? "写入中…" : `写入作品（${readyCount}）`}
        </Button>
        <p className="text-xs text-zinc-500">
          Gate E：写入前必须人工确认。仅写入已纳入候选的帧；Job succeeded
          本身不写 Asset。
        </p>
      </div>
    </section>
  );
}
