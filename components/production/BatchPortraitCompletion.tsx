"use client";

/**
 * CPP-C — character portrait jobs on Production board.
 * Job ≠ Candidate ≠ Asset; Accept writes portrait_url via characters CRUD only.
 * Rejected / unusable results: requeue (optional operator revision note) — do not Accept.
 */

import * as React from "react";

import Link from "next/link";

import { enqueueCharacterPortraitJobs } from "@/app/actions/enqueueCharacterPortraitJobs";
import { discardGenerateJob } from "@/app/actions/discardGenerateJob";
import { proposeCharacterPortraitPrep } from "@/app/actions/proposeCharacterPortraitPrep";
import {
  PortraitJobResultDialog,
  splitPortraitEnqueueDescription,
} from "@/components/generate-jobs/PortraitJobResultDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as charactersApi from "@/lib/characters";
import { formatGenerateJobErrorForOperator } from "@/lib/ai/image/operatorErrorCopy";
import { descriptionWithArchiveAppearance } from "@/lib/discovery/portrait-appearance";
import {
  listGenerateJobsForWork,
  parseCharacterPortraitJobInput,
  parseHostedImageResultReference,
  type GenerateJobRow,
  type HostedImageResultReference,
} from "@/lib/generate-jobs";
import { isMissingPortraitUrl } from "@/lib/production/completion-profile";
import type { Character } from "@/lib/types";

export type BatchPortraitCompletionProps = {
  workId: string;
  characters: Character[];
  incompleteCount: number;
  onWrote: () => void;
  /** From derived-task「打开」— highlight / scroll to this character */
  focusCharacterTsid?: string | null;
  focusNonce?: number;
  onFocusCharacterHandled?: () => void;
};

function jobHosted(
  job: GenerateJobRow
): HostedImageResultReference | null {
  if (job.status !== "succeeded") return null;
  return parseHostedImageResultReference(job.result_reference);
}

function characterName(
  characters: Character[],
  tsid: string
): string {
  return characters.find((c) => c.tsid === tsid)?.name ?? tsid;
}

function mergeRevisionNote(
  baseDescription: string | undefined,
  revisionNote: string
): string | undefined {
  const base = splitPortraitEnqueueDescription(baseDescription).base;
  const note = revisionNote.trim();
  if (!note) return base || undefined;
  if (!base) return `[操作员修改意见] ${note}`;
  return `${base}\n\n[操作员修改意见] ${note}`;
}

function portraitEnqueuePayloadFromJob(
  workId: string,
  job: GenerateJobRow,
  character: Character | undefined,
  revisionNote: string,
  visualIdentityOverride?: string,
  descriptionOverride?: string
): {
  characterTsid: string;
  name: string;
  description?: string;
  referenceUrl?: string;
  operatorRevision?: string;
} | null {
  if (job.subject_type !== "character") return null;
  let name = character?.name?.trim() || "";
  let description =
    descriptionOverride?.trim() ||
    character?.description?.trim() ||
    undefined;
  let referenceUrl: string | undefined;
  try {
    const parsed = parseCharacterPortraitJobInput(job.input_json);
    if (!name) name = parsed.name;
    if (!description) {
      description = splitPortraitEnqueueDescription(parsed.description).base || undefined;
    }
    referenceUrl = parsed.reference_url;
  } catch {
    // fall through with character / empty
  }
  if (!name) return null;
  // Do not pass bad Job result as reference — only prior Asset / enqueue reference.
  if (
    !referenceUrl &&
    character?.portraitUrl &&
    (character.portraitUrl.startsWith("http://") ||
      character.portraitUrl.startsWith("https://")) &&
    !isMissingPortraitUrl(character.portraitUrl)
  ) {
    referenceUrl = character.portraitUrl;
  }
  const note = revisionNote.trim();
  const visualIdentity =
    visualIdentityOverride !== undefined
      ? visualIdentityOverride
      : (character?.visualIdentity ?? "");
  return {
    characterTsid: job.subject_id,
    name,
    description: mergeRevisionNote(
      descriptionWithArchiveAppearance(
        workId,
        name,
        description ?? "",
        visualIdentity
      ),
      note
    ),
    ...(referenceUrl ? { referenceUrl } : {}),
    ...(note ? { operatorRevision: note } : {}),
  };
}

export function BatchPortraitCompletion({
  workId,
  characters,
  incompleteCount,
  onWrote,
  focusCharacterTsid = null,
  focusNonce = 0,
  onFocusCharacterHandled,
}: BatchPortraitCompletionProps) {
  const [jobs, setJobs] = React.useState<GenerateJobRow[]>([]);
  const [jobsError, setJobsError] = React.useState<string | null>(null);
  const [enqueueBusy, setEnqueueBusy] = React.useState(false);
  const [writingId, setWritingId] = React.useState<string | null>(null);
  const [requeueingId, setRequeueingId] = React.useState<string | null>(null);
  const [hint, setHint] = React.useState<string | null>(null);
  const [writeError, setWriteError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{
    url: string | null;
    label: string;
    inputJson: Record<string, unknown>;
    currentName?: string;
    currentDescription?: string;
    editHref?: string;
    draftRevisionNote?: string | null;
  } | null>(null);
  const [retryPanelJobId, setRetryPanelJobId] = React.useState<string | null>(
    null
  );
  const [revisionNotes, setRevisionNotes] = React.useState<
    Record<string, string>
  >({});
  /** Draft visual identity while retry panel is open (seeded from character). */
  const [visualIdentityDrafts, setVisualIdentityDrafts] = React.useState<
    Record<string, string>
  >({});
  const [proposingVisualJobId, setProposingVisualJobId] = React.useState<
    string | null
  >(null);
  /** Focus-card drafts (derived-task「打开」). */
  const [focusVisualDraft, setFocusVisualDraft] = React.useState("");
  const [focusDescriptionDraft, setFocusDescriptionDraft] = React.useState("");
  const [focusRevisionNote, setFocusRevisionNote] = React.useState("");
  const [proposingFocusVisual, setProposingFocusVisual] = React.useState(false);
  const [descriptionDrafts, setDescriptionDrafts] = React.useState<
    Record<string, string>
  >({});
  const [prepBusyLabel, setPrepBusyLabel] = React.useState<string | null>(null);

  const refreshJobs = React.useCallback(async () => {
    try {
      const list = await listGenerateJobsForWork(workId, { limit: 60 });
      setJobs(list.filter((job) => job.subject_type === "character"));
      setJobsError(null);
    } catch (e) {
      setJobsError(e instanceof Error ? e.message : String(e));
    }
  }, [workId]);

  React.useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const focusCharacter = React.useMemo(
    () =>
      focusCharacterTsid
        ? characters.find((c) => c.tsid === focusCharacterTsid) ?? null
        : null,
    [characters, focusCharacterTsid]
  );

  React.useEffect(() => {
    if (!focusCharacter) {
      setFocusVisualDraft("");
      setFocusDescriptionDraft("");
      setFocusRevisionNote("");
      return;
    }
    setFocusVisualDraft(focusCharacter.visualIdentity ?? "");
    setFocusDescriptionDraft(focusCharacter.description ?? "");
    setFocusRevisionNote("");
    // Seed when focus target / open nonce changes — not on every character field refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional seed keys
  }, [focusCharacter?.tsid, focusNonce]);

  React.useEffect(() => {
    if (!focusCharacterTsid) return;
    const id = window.setTimeout(() => {
      document
        .getElementById("batch-portraits")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document
        .getElementById(`portrait-focus-${focusCharacterTsid}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
    return () => window.clearTimeout(id);
  }, [focusCharacterTsid, focusNonce]);

  const proposeFocusVisualIdentity = async () => {
    if (!focusCharacter) return;
    setProposingFocusVisual(true);
    setWriteError(null);
    setHint(null);
    try {
      const result = await proposeCharacterPortraitPrep({
        workId,
        name: focusCharacter.name,
        house: focusCharacter.house,
        description: focusDescriptionDraft || focusCharacter.description,
        currentVisualIdentity: focusVisualDraft,
        operatorNote: focusRevisionNote,
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      setFocusDescriptionDraft(result.description);
      setFocusVisualDraft(result.visualIdentity);
      setHint("已填入纠偏简介与视觉身份（未入队、未写库；可再改后排队）。");
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setProposingFocusVisual(false);
    }
  };

  const enqueueFocusedCharacter = async () => {
    if (!focusCharacter) return;
    setEnqueueBusy(true);
    setWriteError(null);
    setHint(null);
    try {
      const visualDraft = focusVisualDraft.trim();
      const descriptionDraft = focusDescriptionDraft.trim();
      const descChanged =
        descriptionDraft !== (focusCharacter.description ?? "").trim();
      const visualChanged =
        visualDraft !== (focusCharacter.visualIdentity ?? "").trim();
      if (descChanged || visualChanged) {
        await charactersApi.update(workId, focusCharacter.tsid, {
          name: focusCharacter.name,
          house: focusCharacter.house,
          description: descriptionDraft || focusCharacter.description,
          visualIdentity: visualDraft,
          signatureQuote: focusCharacter.signatureQuote,
          portraitUrl: focusCharacter.portraitUrl,
        });
        onWrote();
      }
      const note = focusRevisionNote.trim();
      const baseDescription = descriptionWithArchiveAppearance(
        workId,
        focusCharacter.name,
        descriptionDraft || focusCharacter.description,
        visualDraft
      );
      const description = note
        ? baseDescription
          ? `${baseDescription}\n\n[操作员修改意见] ${note}`
          : `[操作员修改意见] ${note}`
        : baseDescription;
      const result = await enqueueCharacterPortraitJobs({
        workId,
        characters: [
          {
            characterTsid: focusCharacter.tsid,
            name: focusCharacter.name,
            description,
            referenceUrl:
              focusCharacter.portraitUrl?.startsWith("http://") ||
              focusCharacter.portraitUrl?.startsWith("https://")
                ? focusCharacter.portraitUrl
                : undefined,
            ...(note ? { operatorRevision: note } : {}),
          },
        ],
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      setHint(
        result.skipped.length
          ? `${focusCharacter.name} 已有 queued/running 任务。`
          : `已为 ${focusCharacter.name} 入队肖像任务。`
      );
      setFocusRevisionNote("");
      await refreshJobs();
      onFocusCharacterHandled?.();
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnqueueBusy(false);
    }
  };

  const missingPortraits = React.useMemo(
    () => characters.filter((c) => isMissingPortraitUrl(c.portraitUrl)),
    [characters]
  );

  const hasInFlightFor = (characterTsid: string) =>
    jobs.some(
      (j) =>
        j.subject_id === characterTsid &&
        j.subject_type === "character" &&
        (j.status === "queued" || j.status === "running")
    );

  const enqueueMissing = async () => {
    if (missingPortraits.length === 0) {
      setHint("没有缺肖像的角色可排队。");
      return;
    }
    setEnqueueBusy(true);
    setWriteError(null);
    setHint(null);
    try {
      const result = await enqueueCharacterPortraitJobs({
        workId,
        characters: missingPortraits.map((c) => ({
          characterTsid: c.tsid,
          name: c.name,
          description: descriptionWithArchiveAppearance(
            workId,
            c.name,
            c.description,
            c.visualIdentity
          ),
          referenceUrl:
            c.portraitUrl?.startsWith("http://") ||
            c.portraitUrl?.startsWith("https://")
              ? c.portraitUrl
              : undefined,
        })),
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      setHint(
        `已入队 ${result.jobs.length} 条肖像任务${
          result.skipped.length
            ? `；跳过 ${result.skipped.length}（已在 queued/running）`
            : ""
        }`
      );
      await refreshJobs();
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnqueueBusy(false);
    }
  };

  const batchPrepMissing = async () => {
    if (missingPortraits.length === 0) {
      setHint("没有缺肖像的角色可纠偏。");
      return;
    }
    setWriteError(null);
    setHint(null);
    let ok = 0;
    const failures: string[] = [];
    try {
      for (let i = 0; i < missingPortraits.length; i++) {
        const c = missingPortraits[i];
        setPrepBusyLabel(
          `纠偏中 ${i + 1}/${missingPortraits.length} · ${c.name}`
        );
        const result = await proposeCharacterPortraitPrep({
          workId,
          name: c.name,
          house: c.house,
          description: c.description,
          currentVisualIdentity: c.visualIdentity,
        });
        if (!result.ok) {
          failures.push(`${c.name}：${result.message}`);
          continue;
        }
        await charactersApi.update(workId, c.tsid, {
          name: c.name,
          house: c.house,
          description: result.description,
          visualIdentity: result.visualIdentity,
          signatureQuote: c.signatureQuote,
          portraitUrl: c.portraitUrl,
        });
        ok += 1;
      }
      onWrote();
      setHint(
        failures.length === 0
          ? `已为 ${ok} 名缺肖像角色写入纠偏简介与视觉身份（未出图）。可再点「缺肖像排队」。`
          : `已写入 ${ok} 名；失败 ${failures.length}：${failures
              .slice(0, 3)
              .join("；")}`
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setPrepBusyLabel(null);
    }
  };

  const acceptAndWrite = async (job: GenerateJobRow) => {
    const hosted = jobHosted(job);
    if (!hosted || job.subject_type !== "character") {
      setWriteError("无法 Accept：缺少 hosted result_reference");
      return;
    }
    const character = characters.find((c) => c.tsid === job.subject_id);
    if (!character) {
      setWriteError(`找不到角色 ${job.subject_id}`);
      return;
    }
    const currentPortrait = character.portraitUrl?.trim() || null;
    if (currentPortrait && currentPortrait === hosted.url) {
      setWriteError("该 Job 结果已与肖像 Asset 一致，无需再写");
      return;
    }

    setWritingId(job.id);
    setWriteError(null);
    setHint(null);
    try {
      await charactersApi.update(workId, character.tsid, {
        name: character.name,
        house: character.house,
        description: character.description,
        visualIdentity: character.visualIdentity,
        signatureQuote: character.signatureQuote,
        portraitUrl: hosted.url,
      });
      onWrote();
      await refreshJobs();
      setHint(
        currentPortrait
          ? `已 Accept 并覆盖 ${character.name} 肖像`
          : `已 Accept 并写入 ${character.name} 肖像`
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setWritingId(null);
    }
  };

  const proposeVisualIdentityForJob = async (job: GenerateJobRow) => {
    const character = characters.find((c) => c.tsid === job.subject_id);
    const name =
      character?.name?.trim() ||
      (() => {
        try {
          return parseCharacterPortraitJobInput(job.input_json).name;
        } catch {
          return "";
        }
      })();
    if (!name) {
      setWriteError("无法提案：缺少角色姓名");
      return;
    }
    setProposingVisualJobId(job.id);
    setWriteError(null);
    setHint(null);
    try {
      const draft =
        visualIdentityDrafts[job.id] ?? character?.visualIdentity ?? "";
      const result = await proposeCharacterPortraitPrep({
        workId,
        name,
        house: character?.house,
        description:
          descriptionDrafts[job.id] ?? character?.description,
        currentVisualIdentity: draft,
        operatorNote: revisionNotes[job.id],
      });
      if (!result.ok) {
        setWriteError(result.message);
        return;
      }
      setDescriptionDrafts((prev) => ({
        ...prev,
        [job.id]: result.description,
      }));
      setVisualIdentityDrafts((prev) => ({
        ...prev,
        [job.id]: result.visualIdentity,
      }));
      setHint("已填入纠偏简介与视觉身份（未入队、未写库；可再改后重试）。");
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setProposingVisualJobId(null);
    }
  };

  const requeuePortraitJob = async (job: GenerateJobRow) => {
    if (hasInFlightFor(job.subject_id)) {
      setWriteError("该角色已有 queued/running 任务，请勿重复入队。");
      return;
    }
    const character = characters.find((c) => c.tsid === job.subject_id);
    const note = revisionNotes[job.id] ?? "";
    const visualDraft =
      visualIdentityDrafts[job.id] ?? character?.visualIdentity ?? "";
    const descriptionDraft =
      descriptionDrafts[job.id] ?? character?.description ?? "";
    const payload = portraitEnqueuePayloadFromJob(
      workId,
      job,
      character,
      note,
      visualDraft,
      descriptionDraft
    );
    if (!payload) {
      setWriteError("重新排队失败：缺少角色姓名");
      return;
    }
    setRequeueingId(job.id);
    setWriteError(null);
    setHint(null);
    try {
      // Persist visual identity when the retry panel edited it (Creator field).
      if (
        character &&
        (visualDraft.trim() !== (character.visualIdentity ?? "").trim() ||
          descriptionDraft.trim() !== (character.description ?? "").trim())
      ) {
        await charactersApi.update(workId, character.tsid, {
          name: character.name,
          house: character.house,
          description: descriptionDraft.trim() || character.description,
          visualIdentity: visualDraft.trim(),
          signatureQuote: character.signatureQuote,
          portraitUrl: character.portraitUrl,
        });
        onWrote();
      }
      const result = await enqueueCharacterPortraitJobs({
        workId,
        characters: [payload],
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
          `已重新排队，但丢弃旧任务失败：${discarded.message}（可再点「丢弃」）`
        );
      }
      setRetryPanelJobId(null);
      setRevisionNotes((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      setVisualIdentityDrafts((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      setDescriptionDrafts((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      await refreshJobs();
      const changedVisual =
        visualDraft.trim() !== (character?.visualIdentity ?? "").trim();
      const changedDesc =
        descriptionDraft.trim() !== (character?.description ?? "").trim();
      setHint(
        note.trim() || changedVisual || changedDesc
          ? "已按简介/视觉身份/修改意见重新排队；不满意的旧结果已从列表移除。"
          : "已重新排队；不满意的旧结果已从列表移除。"
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setRequeueingId(null);
    }
  };

  const discardPortraitJob = async (job: GenerateJobRow) => {
    setRequeueingId(job.id);
    setWriteError(null);
    setHint(null);
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
      setRetryPanelJobId(null);
      setRevisionNotes((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      setVisualIdentityDrafts((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
      await refreshJobs();
      setHint(
        job.status === "queued" || job.status === "running"
          ? "已取消该进行中任务。"
          : "已丢弃该任务（不写入 Asset）。"
      );
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setRequeueingId(null);
    }
  };

  const discardAllTerminalPortraitJobs = async () => {
    const terminal = jobs.filter(
      (j) => j.status === "succeeded" || j.status === "failed"
    );
    if (terminal.length === 0) {
      setHint("没有可丢弃的 succeeded/failed 肖像任务。");
      return;
    }
    setEnqueueBusy(true);
    setWriteError(null);
    setHint(null);
    try {
      let failed = 0;
      for (const job of terminal) {
        const result = await discardGenerateJob({
          workId,
          jobId: job.id,
          reason: "operator_bulk_discard",
        });
        if (!result.ok) failed += 1;
      }
      await refreshJobs();
      setHint(
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

  return (
    <section
      id="batch-portraits"
      className="space-y-3 scroll-mt-4"
      aria-labelledby="portrait-jobs-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="portrait-jobs-heading"
            className="text-base font-semibold text-zinc-900"
          >
            角色肖像排队
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            CPP-C：排队 → Worker → Human Accept → portrait_url。白图勿
            Accept；重新排队或丢弃后旧结果会从列表移除。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={
              enqueueBusy ||
              Boolean(prepBusyLabel) ||
              missingPortraits.length === 0
            }
            onClick={() => void batchPrepMissing()}
          >
            {prepBusyLabel
              ? prepBusyLabel
              : `批量纠偏简介（${missingPortraits.length}）`}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={enqueueBusy || Boolean(prepBusyLabel) || missingPortraits.length === 0}
            onClick={() => void enqueueMissing()}
          >
            {enqueueBusy
              ? "排队中…"
              : `缺肖像排队（${missingPortraits.length}）`}
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
            onClick={() => void discardAllTerminalPortraitJobs()}
          >
            清理脏数据
          </Button>
        </div>
      </div>

      {focusCharacter ? (
        <div
          id={`portrait-focus-${focusCharacter.tsid}`}
          className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
          role="status"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              派生任务聚焦：
              <span className="font-semibold">{focusCharacter.name}</span>
              {isMissingPortraitUrl(focusCharacter.portraitUrl)
                ? "（缺肖像）"
                : "（已有 Asset，可仍查看 Job）"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                asChild
              >
                <Link
                  href={`/works/${encodeURIComponent(workId)}/characters/${encodeURIComponent(focusCharacter.tsid)}/edit`}
                >
                  去编辑页
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => onFocusCharacterHandled?.()}
              >
                关闭
              </Button>
            </div>
          </div>
          <div className="space-y-2 rounded-md border border-amber-100 bg-white/70 p-2">
            <label
              className="block text-[11px] text-amber-900/80"
              htmlFor={`focus-desc-${focusCharacter.tsid}`}
            >
              读者简介（故事身份；不要写年轻/长相。纠偏后排队会写入角色）
            </label>
            <Textarea
              id={`focus-desc-${focusCharacter.tsid}`}
              rows={2}
              value={focusDescriptionDraft}
              onChange={(e) => setFocusDescriptionDraft(e.target.value)}
              placeholder="例如：Chancellor of Wei who seizes the Han court by cunning."
              className="min-h-[3.5rem] border-amber-100 bg-white text-xs text-zinc-900"
              disabled={enqueueBusy || proposingFocusVisual || Boolean(prepBusyLabel)}
            />
            <label
              className="block text-[11px] text-amber-900/80"
              htmlFor={`focus-visual-${focusCharacter.tsid}`}
            >
              视觉身份（生图用；Local 约 220 字，优先 FACE / COSTUME / PROP；改后排队会写入角色）
            </label>
            <Textarea
              id={`focus-visual-${focusCharacter.tsid}`}
              rows={4}
              value={focusVisualDraft}
              onChange={(e) => setFocusVisualDraft(e.target.value)}
              placeholder="FACE / COSTUME / PROP / STYLE…"
              className="min-h-[5.5rem] border-amber-100 bg-white text-xs text-zinc-900"
              disabled={enqueueBusy || proposingFocusVisual}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                disabled={
                  enqueueBusy ||
                  proposingFocusVisual ||
                  Boolean(prepBusyLabel) ||
                  hasInFlightFor(focusCharacter.tsid)
                }
                onClick={() => void proposeFocusVisualIdentity()}
              >
                {proposingFocusVisual ? "提案中…" : "AI 纠偏简介并提案身份"}
              </Button>
              <span className="text-[10px] text-amber-900/70">
                只填草稿，确认后再排队
              </span>
            </div>
            <label
              className="block text-[11px] text-amber-900/80"
              htmlFor={`focus-revision-${focusCharacter.tsid}`}
            >
              修改意见（可选；并入本次生成与 AI 提案）
            </label>
            <Textarea
              id={`focus-revision-${focusCharacter.tsid}`}
              rows={2}
              value={focusRevisionNote}
              onChange={(e) => setFocusRevisionNote(e.target.value)}
              placeholder="例如：半写实、不要年画风…"
              className="min-h-[3.5rem] border-amber-100 bg-white text-xs text-zinc-900"
              disabled={enqueueBusy || proposingFocusVisual}
            />
            {isMissingPortraitUrl(focusCharacter.portraitUrl) ? (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={
                  enqueueBusy ||
                  proposingFocusVisual ||
                  hasInFlightFor(focusCharacter.tsid)
                }
                onClick={() => void enqueueFocusedCharacter()}
              >
                {hasInFlightFor(focusCharacter.tsid)
                  ? "已在队列中"
                  : enqueueBusy
                    ? "排队中…"
                    : "为此角色排队"}
              </Button>
            ) : (
              <p className="text-[10px] text-amber-900/70">
                已有肖像 Asset；若要改视觉身份后重跑，请在下方 Job
                使用「改视觉身份/意见重试」。
              </p>
            )}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">
        派生缺肖像任务约 {incompleteCount}；已 queued/running 不会重复入队。
      </p>

      {hint ? (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
          {hint}
        </p>
      ) : null}
      {writeError ? (
        <p className="text-destructive text-xs" role="alert">
          {writeError}
        </p>
      ) : null}
      {jobsError ? (
        <p className="text-destructive text-xs" role="alert">
          {jobsError}
        </p>
      ) : null}

      {jobs.length === 0 && !jobsError ? (
        <p className="text-xs text-zinc-500">
          暂无肖像任务。可在此排队，或在角色编辑页「排队生成肖像」。
        </p>
      ) : (
        <ul className="space-y-2 text-xs">
          {jobs.map((job) => {
            const hosted = jobHosted(job);
            const name = characterName(characters, job.subject_id);
            const character = characters.find((c) => c.tsid === job.subject_id);
            const currentPortrait = character?.portraitUrl?.trim() || null;
            const alreadyWritten = Boolean(
              hosted?.url &&
                currentPortrait &&
                currentPortrait === hosted.url
            );
            const isReplace = Boolean(
              hosted?.url &&
                currentPortrait &&
                currentPortrait !== hosted.url
            );
            const canAccept =
              Boolean(hosted) &&
              job.status === "succeeded" &&
              !alreadyWritten &&
              Boolean(character);
            // Discard must stay available even when another job is in-flight —
            // otherwise superseded white-screen rows become stuck with no actions.
            const canDiscard =
              job.status === "succeeded" ||
              job.status === "failed" ||
              job.status === "queued" ||
              job.status === "running";
            const isInFlight =
              job.status === "queued" || job.status === "running";
            const canRequeue =
              (job.status === "succeeded" || job.status === "failed") &&
              !hasInFlightFor(job.subject_id);
            const panelOpen = retryPanelJobId === job.id;

            return (
              <li
                key={job.id}
                className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-zinc-200/80 pb-2 last:border-0"
              >
                {hosted?.url ? (
                  <button
                    type="button"
                    className="group relative shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    onClick={() =>
                      setPreview({
                        url: hosted.url,
                        label: name,
                        inputJson: job.input_json,
                        currentName: character?.name,
                        currentDescription: character?.description,
                        editHref: `/works/${encodeURIComponent(workId)}/characters/${encodeURIComponent(job.subject_id)}/edit`,
                        draftRevisionNote: revisionNotes[job.id] ?? null,
                      })
                    }
                    aria-label={`放大预览 ${name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hosted.url}
                      alt=""
                      className="h-16 w-16 rounded object-cover bg-zinc-100 transition group-hover:opacity-90"
                    />
                    <span className="absolute inset-x-0 bottom-0 rounded-b bg-black/55 py-0.5 text-center text-[10px] text-white">
                      放大
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 px-1 text-center text-[10px] leading-snug text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    onClick={() =>
                      setPreview({
                        url: null,
                        label: name,
                        inputJson: job.input_json,
                        currentName: character?.name,
                        currentDescription: character?.description,
                        editHref: `/works/${encodeURIComponent(workId)}/characters/${encodeURIComponent(job.subject_id)}/edit`,
                        draftRevisionNote: revisionNotes[job.id] ?? null,
                      })
                    }
                    aria-label={`查看生成输入 ${name}`}
                  >
                    <span className="font-medium text-zinc-700">查看</span>
                    <span className="text-zinc-400">输入</span>
                  </button>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-zinc-800">
                      {job.status}
                    </span>
                    <span className="text-zinc-600">{name}</span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {job.subject_id}
                    </span>
                  </div>
                  {job.error ? (
                    <p className="text-destructive">
                      {formatGenerateJobErrorForOperator(job.error) ??
                        job.error}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {canAccept ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={writingId === job.id || Boolean(requeueingId)}
                        onClick={() => void acceptAndWrite(job)}
                      >
                        {writingId === job.id
                          ? "写入中…"
                          : isReplace
                            ? "Accept 并覆盖肖像"
                            : "Accept 并写入肖像"}
                      </Button>
                    ) : null}
                    {canRequeue ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={
                            enqueueBusy ||
                            requeueingId === job.id ||
                            Boolean(writingId)
                          }
                          onClick={() => void requeuePortraitJob(job)}
                        >
                          {requeueingId === job.id ? "处理中…" : "重新排队"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={
                            enqueueBusy ||
                            requeueingId === job.id ||
                            Boolean(writingId)
                          }
                          onClick={() => {
                            if (panelOpen) {
                              setRetryPanelJobId(null);
                              return;
                            }
                            const c = characters.find(
                              (x) => x.tsid === job.subject_id
                            );
                            setVisualIdentityDrafts((prev) => ({
                              ...prev,
                              [job.id]:
                                prev[job.id] ?? c?.visualIdentity ?? "",
                            }));
                            setDescriptionDrafts((prev) => ({
                              ...prev,
                              [job.id]:
                                prev[job.id] ?? c?.description ?? "",
                            }));
                            setRetryPanelJobId(job.id);
                          }}
                        >
                          {panelOpen ? "收起修改" : "改简介/身份重试"}
                        </Button>
                      </>
                    ) : null}
                    {canDiscard ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-zinc-500"
                        disabled={
                          enqueueBusy ||
                          requeueingId === job.id ||
                          Boolean(writingId)
                        }
                        onClick={() => void discardPortraitJob(job)}
                      >
                        {requeueingId === job.id
                          ? "处理中…"
                          : isInFlight
                            ? "取消"
                            : "丢弃"}
                      </Button>
                    ) : null}
                    {!canRequeue &&
                    canDiscard &&
                    hasInFlightFor(job.subject_id) ? (
                      <span className="inline-flex h-7 items-center text-zinc-400">
                        同角色有进行中任务；可先丢弃本条脏数据
                      </span>
                    ) : null}
                    {alreadyWritten && hosted ? (
                      <span className="inline-flex h-7 items-center text-emerald-700">
                        已写入 Asset
                      </span>
                    ) : null}
                    {isReplace && hosted ? (
                      <span className="inline-flex h-7 items-center text-amber-800">
                        Asset 仍是旧图 · 可覆盖
                      </span>
                    ) : null}
                  </div>
                  {panelOpen ? (
                    <div className="mt-1 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                      <label
                        className="block text-[11px] text-zinc-600"
                        htmlFor={`portrait-desc-${job.id}`}
                      >
                        读者简介（故事身份；不要写年轻/长相。改后会写入角色）
                      </label>
                      <Textarea
                        id={`portrait-desc-${job.id}`}
                        rows={2}
                        value={
                          descriptionDrafts[job.id] ??
                          characters.find((c) => c.tsid === job.subject_id)
                            ?.description ??
                          ""
                        }
                        onChange={(e) =>
                          setDescriptionDrafts((prev) => ({
                            ...prev,
                            [job.id]: e.target.value,
                          }))
                        }
                        placeholder="例如：Chancellor of Wei who seizes the Han court by cunning."
                        className="min-h-[3.5rem] text-xs"
                      />
                      <label
                        className="block text-[11px] text-zinc-600"
                        htmlFor={`portrait-visual-${job.id}`}
                      >
                        视觉身份（生图用；Local 约 220 字，优先 FACE / COSTUME / PROP；改后会写入角色并用于本次重试）
                      </label>
                      <Textarea
                        id={`portrait-visual-${job.id}`}
                        rows={4}
                        value={
                          visualIdentityDrafts[job.id] ??
                          characters.find((c) => c.tsid === job.subject_id)
                            ?.visualIdentity ??
                          ""
                        }
                        onChange={(e) =>
                          setVisualIdentityDrafts((prev) => ({
                            ...prev,
                            [job.id]: e.target.value,
                          }))
                        }
                        placeholder="FACE / COSTUME / PROP / STYLE…"
                        className="min-h-[5.5rem] text-xs"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={
                            proposingVisualJobId === job.id ||
                            requeueingId === job.id
                          }
                          onClick={() => void proposeVisualIdentityForJob(job)}
                        >
                          {proposingVisualJobId === job.id
                            ? "提案中…"
                            : "AI 纠偏简介并提案身份"}
                        </Button>
                        <span className="text-[10px] text-zinc-500">
                          只填草稿，需你确认后再排队
                        </span>
                      </div>
                      <label
                        className="block text-[11px] text-zinc-600"
                        htmlFor={`portrait-revision-${job.id}`}
                      >
                        修改意见（可选；并入下次生成与 AI 提案，不改库里的角色描述）
                      </label>
                      <Textarea
                        id={`portrait-revision-${job.id}`}
                        rows={3}
                        value={revisionNotes[job.id] ?? ""}
                        onChange={(e) =>
                          setRevisionNotes((prev) => ({
                            ...prev,
                            [job.id]: e.target.value,
                          }))
                        }
                        placeholder="例如：不要年画风；半写实皮肤质感；绿袍不要丢…"
                        className="min-h-[4.5rem] text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={
                          requeueingId === job.id ||
                          proposingVisualJobId === job.id
                        }
                        onClick={() => void requeuePortraitJob(job)}
                      >
                        {requeueingId === job.id
                          ? "排队中…"
                          : "带修改重新排队"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PortraitJobResultDialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        imageUrl={preview?.url ?? null}
        inputJson={preview?.inputJson ?? null}
        currentName={preview?.currentName}
        currentDescription={preview?.currentDescription}
        editHref={preview?.editHref}
        draftRevisionNote={preview?.draftRevisionNote}
        title={preview?.label ? `${preview.label} · Job 预览` : "Job 肖像预览"}
      />
    </section>
  );
}
