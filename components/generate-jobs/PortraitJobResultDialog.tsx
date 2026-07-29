"use client";

/**
 * Job result preview: image + enqueue input text so operators can compare.
 * Does not admit Candidate or write Asset.
 * input_json is a snapshot at enqueue — later form/DB edits do not rewrite it.
 */

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseCharacterPortraitJobInput,
  type CharacterPortraitJobInput,
} from "@/lib/generate-jobs";
import { AVATAR_REVISION_MARKER } from "@/lib/prompts/avatar";

export type PortraitJobResultDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  /** Raw job.input_json; parse failures → empty fields */
  inputJson?: Record<string, unknown> | null;
  title?: string;
  /** Live character/form fields for对照（不参与已跑完的生成） */
  currentName?: string | null;
  currentDescription?: string | null;
  /**
   * When enqueue-time description is empty, link to character edit
   * (e.g. `/works/{id}/characters/{tsid}/edit`).
   */
  editHref?: string | null;
};

function tryParsePortraitInput(
  inputJson: Record<string, unknown> | null | undefined
): CharacterPortraitJobInput | null {
  if (!inputJson) return null;
  try {
    return parseCharacterPortraitJobInput(inputJson);
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

/** Strip enqueue-only operator revision so live character fields can be compared fairly. */
export function splitPortraitEnqueueDescription(description: string | undefined | null): {
  base: string;
  revisionNote: string;
} {
  const raw = description?.trim() ?? "";
  if (!raw) return { base: "", revisionNote: "" };
  const idx = raw.indexOf(AVATAR_REVISION_MARKER);
  if (idx < 0) return { base: raw, revisionNote: "" };
  const base = raw.slice(0, idx).trim();
  const revisionNote = raw.slice(idx + AVATAR_REVISION_MARKER.length).trim();
  return { base, revisionNote };
}

export function PortraitJobResultDialog({
  open,
  onOpenChange,
  imageUrl,
  inputJson,
  title = "Job 肖像预览",
  currentName,
  currentDescription,
  editHref,
}: PortraitJobResultDialogProps) {
  const input = tryParsePortraitInput(inputJson);
  const { base: jobBaseDesc, revisionNote } = splitPortraitEnqueueDescription(
    input?.description
  );
  const liveDesc = currentDescription?.trim() ?? "";
  const jobName = input?.name?.trim() ?? "";
  const liveName = currentName?.trim() ?? "";
  // Revision notes are enqueue-only — not a character-field drift.
  const showLive =
    Boolean(liveName || liveDesc) &&
    (liveName !== jobName || liveDesc !== jobBaseDesc);
  const showEditDescriptionCta = !jobBaseDesc && Boolean(editHref?.trim());

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
            <p className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
              入队时字段（生成实际用的快照）
            </p>
            <p className="text-[11px] leading-snug text-zinc-500">
              之后在编辑页改的描述不会改写本 Job。要用新描述请「重新排队」或「附修改意见重试」。
            </p>
            <FieldBlock label="姓名" value={input?.name} />
            <div>
              <p className="text-xs text-zinc-500">描述</p>
              <p className="mt-0.5 whitespace-pre-wrap text-zinc-900">
                {jobBaseDesc || "—"}
              </p>
              {showEditDescriptionCta ? (
                <Button
                  asChild
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs"
                >
                  <Link
                    href={editHref!}
                    onClick={() => onOpenChange(false)}
                  >
                    去角色编辑页补描述
                  </Link>
                </Button>
              ) : null}
            </div>
            {revisionNote ? (
              <FieldBlock label="操作员修改意见（仅本次入队）" value={revisionNote} />
            ) : null}
            {input?.reference_url ? (
              <div>
                <p className="text-xs text-zinc-500">参考图 URL</p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-600">
                  {input.reference_url}
                </p>
              </div>
            ) : null}
            {showLive ? (
              <div className="space-y-3 border-t border-zinc-200 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                  当前角色（姓名/描述与入队快照不同）
                </p>
                <FieldBlock label="当前姓名" value={liveName || undefined} />
                <FieldBlock
                  label="当前描述"
                  value={liveDesc || undefined}
                />
              </div>
            ) : null}
            {!input ? (
              <p className="text-xs text-zinc-500">
                无法解析 input_json（可能不是 portrait job）。
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
