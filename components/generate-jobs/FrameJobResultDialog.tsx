"use client";

/**
 * Scene-frame job result preview: image + enqueue caption so operators can compare.
 * Does not admit Candidate or write Asset.
 * input_json is a snapshot at enqueue — later route edits do not rewrite it.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseSceneFrameJobInput,
  type SceneFrameJobInput,
} from "@/lib/generate-jobs";
import { splitFrameCaption } from "@/lib/prompts/frame-draft";

export type FrameJobResultDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  /** Raw job.input_json; parse failures → empty fields */
  inputJson?: Record<string, unknown> | null;
  title?: string;
  /** Live route/frame fields for对照（不参与已跑完的生成） */
  currentCaption?: string | null;
  currentRouteTitle?: string | null;
  /** In-progress textarea draft for the next requeue (not yet enqueued) */
  draftRevisionNote?: string | null;
};

function tryParseFrameInput(
  inputJson: Record<string, unknown> | null | undefined
): SceneFrameJobInput | null {
  if (!inputJson) return null;
  try {
    return parseSceneFrameJobInput(inputJson);
  } catch {
    return null;
  }
}

function FieldBlock({
  label,
  value,
}: {
  label: string;
  value: string | undefined | null;
}) {
  const text = value?.trim() ? value.trim() : "—";
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-zinc-900">{text}</p>
    </div>
  );
}

function resolveEnqueueRevision(
  input: SceneFrameJobInput | null,
  inputJson: Record<string, unknown> | null | undefined
): string {
  const fromField =
    (typeof input?.operator_revision === "string" &&
      input.operator_revision.trim()) ||
    (typeof inputJson?.operator_revision === "string" &&
      inputJson.operator_revision.trim()) ||
    "";
  if (fromField) return fromField;
  return splitFrameCaption(input?.caption ?? "").revisionNote;
}

export function FrameJobResultDialog({
  open,
  onOpenChange,
  imageUrl,
  inputJson,
  title = "Job 画面预览",
  currentCaption,
  currentRouteTitle,
  draftRevisionNote,
}: FrameJobResultDialogProps) {
  const input = tryParseFrameInput(inputJson);
  const { base: jobBaseCaption } = splitFrameCaption(input?.caption ?? "");
  const revisionNote = resolveEnqueueRevision(input, inputJson);
  const draft = draftRevisionNote?.trim() ?? "";
  const jobRouteTitle = input?.route_title?.trim() ?? "";
  const liveCaption = currentCaption?.trim() ?? "";
  const liveRouteTitle = currentRouteTitle?.trim() ?? "";
  // Revision notes are enqueue-only — not a route-field drift.
  const showLive =
    Boolean(liveCaption || liveRouteTitle) &&
    (liveCaption !== jobBaseCaption ||
      (Boolean(liveRouteTitle) && liveRouteTitle !== jobRouteTitle));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)]">
          {imageUrl ? (
            <div className="flex min-h-0 items-center justify-center rounded bg-zinc-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="max-h-[min(85vh,56rem)] w-full object-contain"
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">无图片</p>
          )}
          <div className="flex max-h-[min(85vh,56rem)] min-h-0 flex-col space-y-3 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <div
              className={
                revisionNote
                  ? "rounded-md border border-amber-200 bg-amber-50 p-2"
                  : "rounded-md border border-dashed border-zinc-200 p-2"
              }
            >
              <p className="text-xs font-medium text-amber-900">
                本轮入队时的修改意见
              </p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-900">
                {revisionNote || "本轮未附修改意见"}
              </p>
            </div>
            {draft ? (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-2">
                <p className="text-xs font-medium text-sky-900">
                  正在编辑的下一轮意见（尚未重新排队）
                </p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-900">{draft}</p>
              </div>
            ) : null}
            <p className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
              入队时字段（生成实际用的快照）
            </p>
            <p className="text-[11px] leading-snug text-zinc-500">
              之后在路线编辑页改的 caption 不会改写本 Job。要用新描述请「重新排队」或「附修改意见重试」。
            </p>
            <FieldBlock label="路线标题" value={jobRouteTitle || undefined} />
            {input ? (
              <FieldBlock
                label="帧序号"
                value={`第 ${input.frame_index + 1} 帧`}
              />
            ) : null}
            <FieldBlock
              label="画面描述（caption）"
              value={jobBaseCaption || undefined}
            />
            {showLive ? (
              <div className="space-y-3 border-t border-zinc-200 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  当前路线（标题/描述与入队快照不同）
                </p>
                <FieldBlock
                  label="当前路线标题"
                  value={liveRouteTitle || undefined}
                />
                <FieldBlock
                  label="当前画面描述"
                  value={liveCaption || undefined}
                />
              </div>
            ) : null}
            {!input ? (
              <p className="text-xs text-zinc-500">
                无法解析 input_json（可能不是 scene_frame job）。
              </p>
            ) : null}
            <p className="text-[11px] text-zinc-500">
              Execution 结果预览（≠ Candidate ≠ Asset）。关闭后可继续 Accept。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
