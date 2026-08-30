"use client";

import * as React from "react";

import { discardGenerateJob } from "@/app/actions/discardGenerateJob";
import { proposeFrameExpression } from "@/app/actions/proposeFrameExpression";
import { enqueueFrameDraftJobs } from "@/app/actions/enqueueFrameDraftJobs";
import { generateFrameDraft } from "@/app/actions/generateFrameDraft";
import { FrameJobResultDialog } from "@/components/generate-jobs/FrameJobResultDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatGenerateJobErrorForOperator } from "@/lib/ai/image/operatorErrorCopy";
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
import { FRAME_REVISION_MARKER, splitFrameCaption } from "@/lib/prompts/frame-draft";
import * as scenesApi from "@/lib/scenes";
import { parseRendererExpression } from "@/lib/discovery/visual-contract";
import type { ReadingRoute } from "@/lib/types";

type PendingFill = {
  routeTsid: string;
  frameIndex: number;
  caption: string;
  routeTitle: string;
  /** Creator: Expression present on frame_provenance_v1 for this frame. */
  hasRendererExpression: boolean;
  /** Creator: Expression includes lighting/atmosphere/threat/emphasis (A5). */
  hasNarrativeCues: boolean;
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

function mergeRevisionNote(
  baseCaption: string,
  revisionNote: string
): string {
  const base = splitFrameCaption(baseCaption).base;
  const note = revisionNote.trim();
  if (!note) return base;
  if (!base) return `${FRAME_REVISION_MARKER} ${note}`;
  return `${base}\n\n${FRAME_REVISION_MARKER} ${note}`;
}

function frameEnqueueCaptionFromJob(
  job: GenerateJobRow,
  routes: ReadingRoute[],
  frameIndex: number,
  revisionNote: string
): { caption: string; routeTitle?: string } | null {
  const route = routes.find((r) => r.tsid === job.subject_id);
  const liveCaption = route?.story_images_v2?.[frameIndex]?.caption?.trim() ?? "";
  const jobCaption =
    typeof job.input_json.caption === "string"
      ? job.input_json.caption.trim()
      : "";
  const captionBase = liveCaption || splitFrameCaption(jobCaption).base;
  if (!captionBase && !revisionNote.trim()) return null;
  const routeTitle =
    route?.title?.trim() ||
    (typeof job.input_json.route_title === "string"
      ? job.input_json.route_title.trim()
      : "") ||
    undefined;
  return {
    caption: mergeRevisionNote(captionBase, revisionNote),
    ...(routeTitle ? { routeTitle } : {}),
  };
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

/** True when Asset URL is exactly this job's hosted result (not merely "frame has some url"). */
function frameAssetMatchesJobUrl(
  routes: ReadingRoute[],
  sceneTsid: string,
  frameIndex: number,
  jobUrl: string | null | undefined
): boolean {
  const asset = frameAssetUrl(routes, sceneTsid, frameIndex);
  const hosted = jobUrl?.trim() ?? "";
  return Boolean(asset && hosted && asset === hosted);
}

function jobHasRendererExpression(job: GenerateJobRow): boolean {
  return Boolean(job.input_json?.renderer_expression);
}

function jobHasNarrativeCues(job: GenerateJobRow): boolean {
  const expr = job.input_json?.renderer_expression as
    | {
        lighting?: string;
        atmosphere?: string;
        threatPerception?: string;
        visualEmphasis?: string;
      }
    | undefined;
  if (!expr) return false;
  return Boolean(
    expr.lighting?.trim() ||
      expr.atmosphere?.trim() ||
      expr.threatPerception?.trim() ||
      expr.visualEmphasis?.trim()
  );
}

function ExpressionBadge({
  has,
  hasNarrativeCues,
}: {
  has: boolean;
  hasNarrativeCues?: boolean;
}) {
  if (!has) {
    return (
      <span
        className="inline-flex shrink-0 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900"
        title="frame_provenance_v1 无 rendererExpression：将走 caption 长包装（旧帧或未重新 Propose/Accept）"
      >
        仅 Caption
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 flex-wrap items-center gap-1">
      <span
        className="inline-flex rounded border border-teal-700/40 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-900"
        title="frame_provenance_v1 有 Canonical Expression；生成走 Expression → Projection"
      >
        有 Expression
      </span>
      {hasNarrativeCues ? (
        <span
          className="inline-flex rounded border border-sky-600/30 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-900"
          title="含 lighting / atmosphere / threatPerception / visualEmphasis 之一"
        >
          含氛围字段
        </span>
      ) : (
        <span
          className="inline-flex rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
          title="有 Expression，但无 lighting/atmosphere/threat/emphasis（Cloud 叙事增益有限）"
        >
          基础几何
        </span>
      )}
    </span>
  );
}

/** Structured failure → OPERATOR revision note (WS4). */
const FAILURE_TYPE_NOTES = {
  missing_identity:
    "OPERATOR: 主角须有稳定身份 cue（长须/专属兵器/甲色）；敌军标识只放敌军，勿戴在主角身上。Heroes need fixed identity cues (beard, iconic weapon, armor color); enemy markers (e.g. rebel colors) must stay on enemies only, never on heroes.",
  wrong_beat:
    "OPERATOR: 须画本帧 caption 的瞬间，勿画无关对峙。Must depict this frame caption’s beat, not an unrelated standoff.",
  missing_prop:
    "OPERATOR: 须有 blank unmarked wooden board centered。Must include blank unmarked wooden board centered.",
  cast_count:
    "OPERATOR: 人物数量/关系须匹配 Expression。Cast count/relations must match Expression.",
} as const;

type FailureTypeId = keyof typeof FAILURE_TYPE_NOTES;

function mergeFailureTypeNote(
  existing: string,
  failureType: FailureTypeId
): string {
  const note = FAILURE_TYPE_NOTES[failureType];
  const trimmed = existing.trim();
  if (!trimmed) return note;
  if (trimmed.includes(note)) return trimmed;
  return `${trimmed}\n${note}`;
}

function isExprDraftDirty(
  draft: string | undefined,
  baseline: string | undefined
): boolean {
  return (draft ?? "").trim() !== (baseline ?? "").trim();
}

/** In-flight Execution jobs: block duplicate enqueue for the same frame. */
function activeJobForFrame(
  jobs: GenerateJobRow[],
  sceneTsid: string,
  frameIndex: number
): GenerateJobRow | null {
  for (const job of jobs) {
    if (job.subject_type !== "scene" || job.subject_id !== sceneTsid) continue;
    if (job.status !== "queued" && job.status !== "running") continue;
    if (jobFrameIndex(job) !== frameIndex) continue;
    return job;
  }
  return null;
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
  const [requeueingId, setRequeueingId] = React.useState<string | null>(null);
  const [retryPanelJobId, setRetryPanelJobId] = React.useState<string | null>(
    null
  );
  const [revisionNotes, setRevisionNotes] = React.useState<
    Record<string, string>
  >({});
  const [exprDraftByJob, setExprDraftByJob] = React.useState<
    Record<string, string>
  >({});
  const [exprBaselineByJob, setExprBaselineByJob] = React.useState<
    Record<string, string>
  >({});
  const [exprBusyId, setExprBusyId] = React.useState<string | null>(null);
  const [proposingExprId, setProposingExprId] = React.useState<string | null>(
    null
  );
  const [preview, setPreview] = React.useState<{
    url: string | null;
    label: string;
    inputJson: Record<string, unknown>;
    currentCaption?: string | null;
    currentRouteTitle?: string | null;
    draftRevisionNote?: string | null;
  } | null>(null);

  const refreshJobs = React.useCallback(async () => {
    try {
      const list = await listGenerateJobsForWork(workId, { limit: 40 });
      setJobs(list.filter((job) => job.subject_type === "scene"));
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
          hasRendererExpression: Boolean(
            route.frameHasRendererExpression?.[frameIndex]
          ),
          hasNarrativeCues: Boolean(
            route.frameExpressionHasNarrativeCues?.[frameIndex]
          ),
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

  const enqueueableRows = rows.filter(
    (r) => !activeJobForFrame(jobs, r.routeTsid, r.frameIndex)
  );

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
    const fresh = targets.filter(
      (r) => !activeJobForFrame(jobs, r.routeTsid, r.frameIndex)
    );
    const skipped = targets.length - fresh.length;
    if (fresh.length === 0) {
      setWriteError(
        skipped > 0
          ? "所选帧已在排队或生成中，请勿重复入队。"
          : "没有可入队的帧。"
      );
      return;
    }
    if (fresh.some((r) => !r.hasRendererExpression)) {
      const ok = window.confirm(
        "有帧缺少 Expression，将走 caption 兜底。建议先在读帧补 Expression。仍要排队？"
      );
      if (!ok) return;
    }
    setEnqueueBusy(true);
    setWriteError(null);
    try {
      const result = await enqueueFrameDraftJobs({
        workId,
        frames: fresh.map((r) => ({
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
      if (skipped > 0) {
        setAdmitHint(
          `已入队 ${fresh.length} 条；跳过 ${skipped} 条（已在 queued/running）`
        );
      } else {
        setAdmitHint(`已入队 ${fresh.length} 条`);
      }
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
    if (
      frameAssetMatchesJobUrl(routes, job.subject_id, frameIndex, hosted.url)
    ) {
      return {
        ok: false,
        reason: `${job.subject_id} 帧 ${frameIndex + 1} 已与本 Job 结果一致`,
      };
    }
    const key = rowKey(job.subject_id, frameIndex);
    const pending = rows.find(
      (r) => rowKey(r.routeTsid, r.frameIndex) === key
    );
    if (!pending) {
      // Frame already has a different Asset — use 「Accept 并覆盖」 instead of candidate lane.
      if (frameAssetUrl(routes, job.subject_id, frameIndex)) {
        return {
          ok: false,
          reason: `${job.subject_id} 帧 ${frameIndex + 1} 已有 Asset；请用「Accept 并覆盖」写入本 Job 结果`,
        };
      }
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
    const currentUrl = frameAssetUrl(routes, job.subject_id, frameIndex);
    if (currentUrl && currentUrl === hosted.url) {
      setWriteError("该 Job 结果已与 Asset 一致，无需再写");
      return;
    }

    setWriting(true);
    setWriteError(null);
    setAdmitHint(null);
    // Empty-frame candidate lane is optional; replace writes skip it.
    if (!currentUrl) {
      const admit = admitJobAsCandidate(job);
      if (!admit.ok) {
        setWriting(false);
        setWriteError(admit.reason);
        return;
      }
    }
    try {
      await scenesApi.patchSceneFrameUrls(workId, job.subject_id, [
        { frameIndex, url: hosted.url },
      ]);
      onWrote();
      await refreshJobs();
      setAdmitHint(
        currentUrl
          ? `已 Accept 并覆盖 ${job.subject_id} · 帧 ${frameIndex + 1}`
          : `已 Accept 并写入 ${job.subject_id} · 帧 ${frameIndex + 1}`
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setWriting(false);
    }
  };

  const discardFrameJob = async (job: GenerateJobRow) => {
    setRequeueingId(job.id);
    setWriteError(null);
    try {
      const result = await discardGenerateJob({
        workId,
        jobId: job.id,
        reason: "operator_discarded",
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      const frameIndex = jobFrameIndex(job);
      const hosted = jobHosted(job);
      if (frameIndex !== null && hosted?.url) {
        const key = rowKey(job.subject_id, frameIndex);
        setRows((prev) =>
          prev.map((r) =>
            rowKey(r.routeTsid, r.frameIndex) === key &&
            r.candidateUrl === hosted.url
              ? { ...r, candidateUrl: null, candidateLabel: null }
              : r
          )
        );
      }
      setRetryPanelJobId(null);
      setRevisionNotes((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      await refreshJobs();
      setAdmitHint("已丢弃该任务（不写入 Asset）。");
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setRequeueingId(null);
    }
  };

  const discardAllTerminalFrameJobs = async () => {
    const terminal = jobs.filter(
      (j) => j.status === "succeeded" || j.status === "failed"
    );
    if (terminal.length === 0) {
      setAdmitHint("没有可丢弃的 succeeded/failed 画面任务。");
      return;
    }
    setEnqueueBusy(true);
    setWriteError(null);
    setAdmitHint(null);
    try {
      let failed = 0;
      const hostedUrlsToClear = new Set<string>();
      for (const job of terminal) {
        const result = await discardGenerateJob({
          workId,
          jobId: job.id,
          reason: "operator_bulk_discard",
        });
        if (!result.ok) {
          failed += 1;
          continue;
        }
        const hosted = jobHosted(job);
        if (hosted?.url) hostedUrlsToClear.add(hosted.url);
      }
      if (hostedUrlsToClear.size > 0) {
        setRows((prev) =>
          prev.map((r) =>
            r.candidateUrl && hostedUrlsToClear.has(r.candidateUrl)
              ? { ...r, candidateUrl: null, candidateLabel: null }
              : r
          )
        );
      }
      setRetryPanelJobId(null);
      await refreshJobs();
      setAdmitHint(
        failed === 0
          ? `已丢弃 ${terminal.length} 条终端任务（queued/running 保留）。`
          : `丢弃完成，其中 ${failed} 条失败；请刷新后对剩余项逐条丢弃。`
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnqueueBusy(false);
    }
  };

  const clearCandidateForRow = (row: PendingFill) => {
    const key = rowKey(row.routeTsid, row.frameIndex);
    patchRow(key, { candidateUrl: null, candidateLabel: null });
    setAdmitHint("已清除该帧候选（未写 Asset）。");
  };

  const requeueFromJob = async (job: GenerateJobRow) => {
    if (job.subject_type !== "scene") return;
    const frameIndex = jobFrameIndex(job);
    if (frameIndex === null) return;
    if (activeJobForFrame(jobs, job.subject_id, frameIndex)) {
      setWriteError("该帧已有 queued/running 任务，请勿重复入队。");
      return;
    }
    const note = revisionNotes[job.id] ?? "";
    const payload = frameEnqueueCaptionFromJob(
      job,
      routes,
      frameIndex,
      note
    );
    if (!payload?.caption.trim()) {
      setWriteError("重新排队失败：job 无 caption");
      return;
    }

    // Persist Expression draft from the retry panel before enqueue — otherwise
    // requeue only reads stale frame_provenance_v1 and ignores the edited JSON.
    const exprRaw = (exprDraftByJob[job.id] ?? "").trim();
    const exprDirty = isExprDraftDirty(
      exprDraftByJob[job.id],
      exprBaselineByJob[job.id]
    );
    if (exprDirty && exprRaw) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(exprRaw);
      } catch {
        setWriteError("Expression JSON 解析失败，请先修正后再重试");
        return;
      }
      const parsed = parseRendererExpression(parsedJson);
      if (!parsed.ok) {
        setWriteError(`Expression 无效：${parsed.errors.join("; ")}`);
        return;
      }
      try {
        await scenesApi.patchFrameProvenanceExpression(
          workId,
          job.subject_id,
          frameIndex,
          parsed.value
        );
      } catch (e) {
        setWriteError(
          `保存 Expression 失败：${e instanceof Error ? e.message : String(e)}`
        );
        return;
      }
    }

    setRequeueingId(job.id);
    setEnqueueBusy(true);
    setWriteError(null);
    try {
      const result = await enqueueFrameDraftJobs({
        workId,
        frames: [
          {
            sceneTsid: job.subject_id,
            frameIndex,
            caption: payload.caption,
            routeTitle: payload.routeTitle,
            ...(note.trim() ? { operatorRevision: note.trim() } : {}),
          },
        ],
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      const discarded = await discardGenerateJob({
        workId,
        jobId: job.id,
        reason: note.trim()
          ? `operator_superseded_with_revision: ${note.trim().slice(0, 200)}`
          : "operator_superseded_requeue",
      });
      if (!discarded.ok) {
        setWriteError(
          `已重新排队，但丢弃旧任务失败：${discarded.message}（可再点「重新排队」后处理）`
        );
      }
      setRetryPanelJobId(null);
      setRevisionNotes((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      setExprDraftByJob((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      setExprBaselineByJob((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      await refreshJobs();
      setAdmitHint(
        exprDirty && exprRaw
          ? note.trim()
            ? "已保存 Expression 并按修改意见重新排队；旧结果已从列表移除。"
            : "已保存 Expression 并重新排队；旧结果已从列表移除。"
          : note.trim()
            ? "已按修改意见重新排队；不满意的旧结果已从列表移除。"
            : "已重新排队；不满意的旧结果已从列表移除。"
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setRequeueingId(null);
      setEnqueueBusy(false);
    }
  };

  const proposeExprForJob = async (job: GenerateJobRow) => {
    if (job.subject_type !== "scene") return;
    const frameIndex = jobFrameIndex(job);
    if (frameIndex === null) {
      setWriteError("无法提案：job 无 frame_index");
      return;
    }
    const route = routes.find((r) => r.tsid === job.subject_id);
    const liveCaption =
      route?.story_images_v2?.[frameIndex]?.caption?.trim() ?? "";
    const jobCaption =
      typeof job.input_json.caption === "string"
        ? job.input_json.caption
        : "";
    const caption = splitFrameCaption(liveCaption || jobCaption).base;
    if (!caption) {
      setWriteError("无法提案：缺少画面说明");
      return;
    }
    setProposingExprId(job.id);
    setWriteError(null);
    try {
      const result = await proposeFrameExpression({
        workId,
        caption,
        currentExpression: exprDraftByJob[job.id],
        operatorNote: revisionNotes[job.id],
        routeTitle: route?.title,
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      setExprDraftByJob((prev) => ({
        ...prev,
        [job.id]: JSON.stringify(result.rendererExpression, null, 2),
      }));
      setAdmitHint(
        "已填入 AI Expression（未写入 provenance；可再改后保存或重新排队）"
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setProposingExprId(null);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="batch-frames-heading"
            className="text-base font-semibold text-zinc-900"
          >
            批量补齐画面图
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            排队 → Worker → Candidate → Accept 写 Asset。Job ≠ Candidate ≠ Asset。
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            徽章：
            <span className="text-teal-800">有 Expression</span>
            （Canonical，可走 Projection）·
            <span className="text-sky-800">含氛围字段</span>
            （lighting/atmosphere/threat…）·
            <span className="text-amber-800">仅 Caption</span>
            （旧帧/未写 provenance，走长包装）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={
              writing || enqueueBusy || enqueueableRows.length === 0
            }
            onClick={() => void enqueueRows(rows)}
          >
            {enqueueBusy
              ? "排队中…"
              : `缺画面排队（${enqueueableRows.length}）`}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              enqueueBusy ||
              !jobs.some(
                (j) => j.status === "succeeded" || j.status === "failed"
              )
            }
            onClick={() => void discardAllTerminalFrameJobs()}
          >
            清理脏数据
          </Button>
        </div>
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
        <>
          <p className="text-xs text-zinc-600" role="status">
            待补 {rows.length} 帧 · 有 Expression{" "}
            {rows.filter((r) => r.hasRendererExpression).length} · 含氛围字段{" "}
            {rows.filter((r) => r.hasNarrativeCues).length} · 仅 Caption{" "}
            {rows.filter((r) => !r.hasRendererExpression).length}
          </p>
        <ul className="space-y-3">
          {rows.map((row) => {
            const key = rowKey(row.routeTsid, row.frameIndex);
            const activeJob = activeJobForFrame(
              jobs,
              row.routeTsid,
              row.frameIndex
            );
            const enqueueBlocked = Boolean(activeJob);
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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {row.routeTitle} · 帧 {row.frameIndex + 1}
                      </p>
                      <ExpressionBadge
                        has={row.hasRendererExpression}
                        hasNarrativeCues={row.hasNarrativeCues}
                      />
                    </div>
                    {!row.hasRendererExpression ? (
                      <p className="mt-1 text-[11px] text-amber-800">
                        缺 Expression：建议先在读帧（Frame Context）补写，再排队；否则走
                        caption 兜底。
                      </p>
                    ) : null}
                    <p className="truncate text-xs text-zinc-500">{row.caption}</p>
                    {enqueueBlocked ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        {activeJob?.status === "running"
                          ? "Job 生成中（不可再排队）"
                          : "已入队（不可再排队）"}
                      </p>
                    ) : null}
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
                    disabled={
                      row.busy || writing || enqueueBusy || enqueueBlocked
                    }
                    onClick={() => void enqueueRows([row])}
                  >
                    {enqueueBlocked
                      ? activeJob?.status === "running"
                        ? "生成中…"
                        : "已排队"
                      : "排队生成"}
                  </Button>
                  {row.candidateUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={row.busy || writing || enqueueBusy}
                      onClick={() => clearCandidateForRow(row)}
                      className="text-zinc-500"
                    >
                      清除候选
                    </Button>
                  ) : null}
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
        </>
      )}

      {rows.length > 0 ? (
        <p className="text-xs text-zinc-500">
          顶部「缺画面排队」可一次入队全部可排帧；已 queued/running 的不会重复入队。
        </p>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                enqueueBusy ||
                !jobs.some(
                  (j) => j.status === "succeeded" || j.status === "failed"
                )
              }
              onClick={() => void discardAllTerminalFrameJobs()}
            >
              清理脏数据
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
          <ul className="space-y-2 text-xs">
            {jobs.map((job) => {
              const frameIndex = jobFrameIndex(job);
              const frameLabel =
                frameIndex !== null ? `帧 ${frameIndex + 1}` : "—";
              const hosted = jobHosted(job);
              const currentAssetUrl =
                frameIndex !== null && job.subject_type === "scene"
                  ? frameAssetUrl(routes, job.subject_id, frameIndex)
                  : null;
              const alreadyWritten = Boolean(
                hosted?.url &&
                  currentAssetUrl &&
                  currentAssetUrl === hosted.url
              );
              const isReplace = Boolean(
                hosted?.url &&
                  currentAssetUrl &&
                  currentAssetUrl !== hosted.url
              );
              const canAcceptWrite =
                Boolean(hosted) &&
                job.subject_type === "scene" &&
                frameIndex !== null &&
                !alreadyWritten;
              const canAdmit =
                canAcceptWrite &&
                !isReplace &&
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
              const canSubmitRetryPanel =
                Boolean((revisionNotes[job.id] ?? "").trim()) ||
                isExprDraftDirty(
                  exprDraftByJob[job.id],
                  exprBaselineByJob[job.id]
                );

              return (
                <li
                  key={job.id}
                  className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-zinc-200/80 pb-2 last:border-0"
                >
                  {hosted?.url ? (
                    <button
                      type="button"
                      className="group relative shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                      onClick={() => {
                        const route = routes.find(
                          (r) => r.tsid === job.subject_id
                        );
                        const liveFrame =
                          frameIndex !== null
                            ? route?.story_images_v2?.[frameIndex]
                            : undefined;
                        setPreview({
                          url: hosted.url,
                          label: `${job.subject_id} · ${frameLabel}`,
                          inputJson: job.input_json,
                          currentCaption: liveFrame?.caption ?? null,
                          currentRouteTitle:
                            route?.title || route?.tsid || null,
                          draftRevisionNote: revisionNotes[job.id] ?? null,
                        });
                      }}
                      aria-label={`放大预览 ${job.subject_id} ${frameLabel}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={hosted.url}
                        alt=""
                        className="h-16 w-28 rounded object-cover bg-zinc-100 transition group-hover:opacity-90"
                      />
                      <span className="absolute inset-x-0 bottom-0 rounded-b bg-black/55 py-0.5 text-center text-[10px] text-white">
                        点击放大
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex h-16 w-28 shrink-0 flex-col items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 px-1 text-center text-[10px] leading-snug text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                      onClick={() => {
                        const route = routes.find(
                          (r) => r.tsid === job.subject_id
                        );
                        const liveFrame =
                          frameIndex !== null
                            ? route?.story_images_v2?.[frameIndex]
                            : undefined;
                        setPreview({
                          url: null,
                          label: `${job.subject_id} · ${frameLabel}`,
                          inputJson: job.input_json,
                          currentCaption: liveFrame?.caption ?? null,
                          currentRouteTitle:
                            route?.title || route?.tsid || null,
                          draftRevisionNote: revisionNotes[job.id] ?? null,
                        });
                      }}
                      aria-label={`查看生成输入 ${job.subject_id} ${frameLabel}`}
                    >
                      <span className="font-medium text-zinc-700">
                        查看输入
                      </span>
                      <span className="text-zinc-400">画面描述 / 入队快照</span>
                    </button>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-zinc-800">
                        {job.status}
                      </span>
                      <ExpressionBadge
                        has={jobHasRendererExpression(job)}
                        hasNarrativeCues={jobHasNarrativeCues(job)}
                      />
                      <span className="text-zinc-500">
                        {job.subject_id} · {frameLabel}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(job.created_at).toLocaleString()}
                      </span>
                      {alreadyWritten ? (
                        <span className="text-emerald-700">已写入 Asset</span>
                      ) : isReplace ? (
                        <span className="text-amber-800">
                          Asset 仍是旧图 · 可覆盖
                        </span>
                      ) : pendingHasCandidate && hosted ? (
                        <span className="text-amber-700">已在候选</span>
                      ) : null}
                    </div>
                    {!jobHasRendererExpression(job) ? (
                      <p className="text-[11px] text-amber-800">
                        无 Expression：下次可先在读帧 / Frame Context
                        补写再重试，避免 caption 兜底。
                      </p>
                    ) : null}
                    {job.error ? (
                      <p className="text-destructive">
                        {formatGenerateJobErrorForOperator(job.error) ??
                          job.error}
                      </p>
                    ) : null}
                    {hosted?.faceSafety &&
                    hosted.faceSafety.safety_status !== "allowed" ? (
                      <p className="text-[11px] text-amber-800">
                        Face Safety: {hosted.faceSafety.safety_status}
                        {" · "}
                        {hosted.faceSafety.reason}
                        {" — Human Accept 前请人工确认脸部是否惊悚"}
                      </p>
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={
                            writing ||
                            enqueueBusy ||
                            requeueingId === job.id
                          }
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
                      ) : null}
                      {canAcceptWrite ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={
                            writing ||
                            enqueueBusy ||
                            requeueingId === job.id
                          }
                          onClick={() => void acceptAndWriteJob(job)}
                        >
                          {isReplace ? "Accept 并覆盖" : "Accept 并写入"}
                        </Button>
                      ) : null}
                      {(job.status === "succeeded" ||
                        job.status === "failed") &&
                      job.subject_type === "scene" ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={
                              writing ||
                              enqueueBusy ||
                              requeueingId === job.id ||
                              (frameIndex !== null &&
                                Boolean(
                                  activeJobForFrame(
                                    jobs,
                                    job.subject_id,
                                    frameIndex
                                  )
                                ))
                            }
                            onClick={() => void requeueFromJob(job)}
                          >
                            {requeueingId === job.id
                              ? "处理中…"
                              : "重新排队"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={
                              writing ||
                              enqueueBusy ||
                              requeueingId === job.id ||
                              (frameIndex !== null &&
                                Boolean(
                                  activeJobForFrame(
                                    jobs,
                                    job.subject_id,
                                    frameIndex
                                  )
                                ))
                            }
                            onClick={() => {
                              const nextId =
                                retryPanelJobId === job.id ? null : job.id;
                              setRetryPanelJobId(nextId);
                              if (nextId && frameIndex !== null) {
                                void scenesApi
                                  .getFrameProvenance(workId, job.subject_id)
                                  .then((entries) => {
                                    const entry = entries.find(
                                      (p) => p.frameIndex === frameIndex
                                    );
                                    const json = entry?.rendererExpression
                                      ? JSON.stringify(
                                          entry.rendererExpression,
                                          null,
                                          2
                                        )
                                      : "";
                                    setExprDraftByJob((prev) => ({
                                      ...prev,
                                      [job.id]: json,
                                    }));
                                    setExprBaselineByJob((prev) => ({
                                      ...prev,
                                      [job.id]: json,
                                    }));
                                  })
                                  .catch(() => {
                                    setExprDraftByJob((prev) => ({
                                      ...prev,
                                      [job.id]: "",
                                    }));
                                    setExprBaselineByJob((prev) => ({
                                      ...prev,
                                      [job.id]: "",
                                    }));
                                  });
                              }
                            }}
                          >
                            {retryPanelJobId === job.id
                              ? "收起修改意见"
                              : "附修改意见重试"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-zinc-500"
                            disabled={
                              writing ||
                              enqueueBusy ||
                              requeueingId === job.id
                            }
                            onClick={() => void discardFrameJob(job)}
                          >
                            {requeueingId === job.id ? "处理中…" : "丢弃"}
                          </Button>
                        </>
                      ) : null}
                      {(job.status === "queued" || job.status === "running") &&
                      job.subject_type === "scene" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-zinc-500"
                          disabled={
                            writing ||
                            enqueueBusy ||
                            requeueingId === job.id
                          }
                          onClick={() => void discardFrameJob(job)}
                        >
                          {requeueingId === job.id ? "处理中…" : "取消"}
                        </Button>
                      ) : null}
                    </div>
                    {retryPanelJobId === job.id ? (
                      <div className="mt-1 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                        <label
                          className="block text-[11px] text-zinc-600"
                          htmlFor={`frame-failure-type-${job.id}`}
                        >
                          失败类型（填入修改意见）
                        </label>
                        <select
                          id={`frame-failure-type-${job.id}`}
                          className="h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-800"
                          defaultValue=""
                          onChange={(e) => {
                            const value = e.target.value as FailureTypeId | "";
                            if (!value) return;
                            setRevisionNotes((prev) => ({
                              ...prev,
                              [job.id]: mergeFailureTypeNote(
                                prev[job.id] ?? "",
                                value
                              ),
                            }));
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>
                            选择结构化纠偏…
                          </option>
                          <option value="missing_identity">
                            missing_identity · 主角身份 cue（兵器/胡须/甲色）；敌标勿贴主角
                          </option>
                          <option value="wrong_beat">
                            wrong_beat · 须画本帧 caption 的瞬间，勿画无关对峙
                          </option>
                          <option value="missing_prop">
                            missing_prop · 须有 blank unmarked wooden board
                            centered
                          </option>
                          <option value="cast_count">
                            cast_count · 人物数量/关系须匹配 Expression
                          </option>
                        </select>
                        <label
                          className="block text-[11px] text-zinc-600"
                          htmlFor={`frame-expr-${job.id}`}
                        >
                          Expression（点下方重新排队时会写入 provenance
                          再入队；也可先单独保存。修改意见可留空）
                        </label>
                        <Textarea
                          id={`frame-expr-${job.id}`}
                          rows={5}
                          value={exprDraftByJob[job.id] ?? ""}
                          onChange={(e) =>
                            setExprDraftByJob((prev) => ({
                              ...prev,
                              [job.id]: e.target.value,
                            }))
                          }
                          placeholder='{"environment":"…","characters":[],"action":"…","composition":"…"}'
                          className="min-h-[5rem] font-mono text-[11px]"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            disabled={
                              proposingExprId === job.id ||
                              exprBusyId === job.id ||
                              frameIndex === null ||
                              writing ||
                              enqueueBusy
                            }
                            onClick={() => void proposeExprForJob(job)}
                          >
                            {proposingExprId === job.id
                              ? "提案中…"
                              : "AI 提案 Expression"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={
                              proposingExprId === job.id ||
                              exprBusyId === job.id ||
                              frameIndex === null ||
                              writing ||
                              enqueueBusy
                            }
                            onClick={() => {
                            if (frameIndex === null) return;
                            const raw = (exprDraftByJob[job.id] ?? "").trim();
                            if (!raw) {
                              setWriteError("Expression JSON 为空");
                              return;
                            }
                            let parsedJson: unknown;
                            try {
                              parsedJson = JSON.parse(raw);
                            } catch {
                              setWriteError("Expression JSON 解析失败");
                              return;
                            }
                            const parsed = parseRendererExpression(parsedJson);
                            if (!parsed.ok) {
                              setWriteError(parsed.errors.join("; "));
                              return;
                            }
                            setExprBusyId(job.id);
                            setWriteError(null);
                            void scenesApi
                              .patchFrameProvenanceExpression(
                                workId,
                                job.subject_id,
                                frameIndex,
                                parsed.value
                              )
                              .then(() =>
                                setAdmitHint("Expression 已写入 provenance")
                              )
                              .catch((e) =>
                                setWriteError(
                                  e instanceof Error ? e.message : String(e)
                                )
                              )
                              .finally(() => setExprBusyId(null));
                          }}
                        >
                          {exprBusyId === job.id
                            ? "保存 Expression…"
                            : "保存 Expression"}
                        </Button>
                        </div>
                        <label
                          className="block text-[11px] text-zinc-600"
                          htmlFor={`frame-revision-${job.id}`}
                        >
                          修改意见（可选；会并入下次生成 caption；不改库里的画面描述）
                        </label>
                        <Textarea
                          id={`frame-revision-${job.id}`}
                          rows={3}
                          value={revisionNotes[job.id] ?? ""}
                          onChange={(e) =>
                            setRevisionNotes((prev) => ({
                              ...prev,
                              [job.id]: e.target.value,
                            }))
                          }
                          placeholder="例如：更暗的夜景；少一点人物；构图偏左；雨夜火光更强…"
                          className="min-h-[4.5rem] text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          title={
                            canSubmitRetryPanel
                              ? undefined
                              : "请修改 Expression 或填写修改意见"
                          }
                          disabled={
                            !canSubmitRetryPanel ||
                            requeueingId === job.id ||
                            writing ||
                            enqueueBusy ||
                            (frameIndex !== null &&
                              Boolean(
                                activeJobForFrame(
                                  jobs,
                                  job.subject_id,
                                  frameIndex
                                )
                              ))
                          }
                          onClick={() => void requeueFromJob(job)}
                        >
                          {requeueingId === job.id
                            ? "排队中…"
                            : "按当前修改重新排队"}
                        </Button>
                      </div>
                    ) : null}
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

      <FrameJobResultDialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        imageUrl={preview?.url ?? null}
        inputJson={preview?.inputJson ?? null}
        currentCaption={preview?.currentCaption}
        currentRouteTitle={preview?.currentRouteTitle}
        draftRevisionNote={preview?.draftRevisionNote}
        title={preview?.label ? `${preview.label} · Job 预览` : "Job 画面预览"}
      />
    </section>
  );
}
