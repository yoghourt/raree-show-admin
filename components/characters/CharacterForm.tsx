"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { startTransition, useActionState, useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  generateCharacterAvatar,
  type GenerateCharacterAvatarState,
} from "@/app/actions/generateCharacterAvatar";
import { enqueueCharacterPortraitJobs } from "@/app/actions/enqueueCharacterPortraitJobs";
import { discardGenerateJob } from "@/app/actions/discardGenerateJob";
import { CopilotIcon } from "@/components/copilot/CopilotIcon";
import { NarrativeRegenButton } from "@/components/copilot/NarrativeRegenButton";
import { SuggestionPanel } from "@/components/copilot/SuggestionPanel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PortraitJobResultDialog } from "@/components/generate-jobs/PortraitJobResultDialog";
import { useCopilotSession } from "@/hooks/useCopilotSession";
import { formatGenerateJobErrorForOperator } from "@/lib/ai/image/operatorErrorCopy";
import { descriptionWithArchiveAppearance } from "@/lib/discovery/portrait-appearance";
import { messages } from "@/lib/locale";
import * as charactersApi from "@/lib/characters";
import {
  listGenerateJobsForWork,
  parseHostedImageResultReference,
  type GenerateJobRow,
} from "@/lib/generate-jobs";
import type { Character } from "@/lib/types";

const PORTRAIT_PLACEHOLDER = "https://placehold.co/400x400/e5e7eb/6b7280?text=No+Portrait";

// ---------------------------------------------------------------------------
// Character Copilot field labels (for SuggestionPanel display)
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  house:          "家族",
  description:    "描述",
  signatureQuote: "标志性台词",
};

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const characterFormSchema = z.object({
  name: z.string().min(1, "姓名不能为空"),
  house: z.string(),
  description: z.string(),
  signatureQuote: z.string().nullable().optional(),
  portraitUrl: z.string(),
});

export type CharacterFormValues = z.infer<typeof characterFormSchema>;

function characterToFormValues(c: Character): CharacterFormValues {
  return {
    name: c.name,
    house: c.house,
    description: c.description,
    signatureQuote: c.signatureQuote,
    portraitUrl: c.portraitUrl,
  };
}

function toPayload(
  values: CharacterFormValues
): Omit<Character, "id" | "tsid" | "workId" | "createdAt"> {
  return {
    name: values.name.trim(),
    house: values.house.trim(),
    description: values.description.trim(),
    signatureQuote: values.signatureQuote?.trim() || null,
    portraitUrl: values.portraitUrl.trim(),
  };
}

function toSubmitError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

type CharacterFormProps =
  | { workId: string; mode: "create"; initialValues?: Partial<CharacterFormValues>; successRedirectHref?: string }
  | { workId: string; mode: "edit"; defaultValues: Character; successRedirectHref?: string };

export function CharacterForm(props: CharacterFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [imageUploading, setImageUploading] = React.useState(false);
  const listHref = `/works/${encodeURIComponent(props.workId)}/characters`;
  const successHref = props.successRedirectHref ?? listHref;

  const [avatarGenState, avatarGenAction, avatarGenPending] = useActionState<
    GenerateCharacterAvatarState | null,
    FormData
  >(generateCharacterAvatar, null);

  const defaultValues: CharacterFormValues =
    props.mode === "edit"
      ? characterToFormValues(props.defaultValues)
      : {
          name: props.initialValues?.name ?? "",
          house: props.initialValues?.house ?? "",
          description: props.initialValues?.description ?? "",
          signatureQuote: props.initialValues?.signatureQuote ?? null,
          portraitUrl: props.initialValues?.portraitUrl ?? "",
        };

  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (props.mode !== "create" || !props.initialValues) {
      return;
    }
    form.reset({
      name: props.initialValues.name ?? "",
      house: props.initialValues.house ?? "",
      description: props.initialValues.description ?? "",
      signatureQuote: props.initialValues.signatureQuote ?? null,
      portraitUrl: props.initialValues.portraitUrl ?? "",
    });
  }, [form, props]);

  const watchedName = useWatch({ control: form.control, name: "name" }) ?? "";
  const watchedDescription =
    useWatch({ control: form.control, name: "description" }) ?? "";

  // ── Copilot session ────────────────────────────────────────────────────────

  const entityId = props.mode === "edit" ? props.defaultValues.tsid : "new";

  const copilot = useCopilotSession({
    entityType: "character",
    workId: props.workId,
    entityId,
  });

  // Trigger duplicate check whenever the name field changes (AC-24)
  useEffect(() => {
    copilot.onScopeFieldChange(watchedName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName]);

  // Teardown on unmount — destroys all pending Copilot state (RT-INV-07)
  useEffect(() => {
    return () => copilot.teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!avatarGenPending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [avatarGenPending]);

  // ── Avatar generation ──────────────────────────────────────────────────────
  // Gate A/E: generation only fills the form (candidate). Asset write requires
  // human Accept via form Save or「接受肖像并保存」(edit only).

  const [portraitAcceptPending, setPortraitAcceptPending] = React.useState(false);
  const [acceptSavePending, setAcceptSavePending] = React.useState(false);
  const [portraitJobs, setPortraitJobs] = React.useState<GenerateJobRow[]>([]);
  const [portraitEnqueueBusy, setPortraitEnqueueBusy] = React.useState(false);
  const [portraitJobHint, setPortraitJobHint] = React.useState<string | null>(
    null
  );
  const [jobPreviewOpen, setJobPreviewOpen] = React.useState(false);
  const [portraitRevisionNote, setPortraitRevisionNote] = React.useState("");

  const characterTsid =
    props.mode === "edit" ? props.defaultValues.tsid : null;

  const refreshPortraitJobs = React.useCallback(async () => {
    if (!characterTsid) {
      setPortraitJobs([]);
      return;
    }
    try {
      const list = await listGenerateJobsForWork(props.workId, { limit: 40 });
      setPortraitJobs(
        list.filter(
          (job) =>
            job.subject_type === "character" &&
            job.subject_id === characterTsid
        )
      );
    } catch {
      // soft-fail — form still usable without job list
    }
  }, [characterTsid, props.workId]);

  React.useEffect(() => {
    void refreshPortraitJobs();
  }, [refreshPortraitJobs]);

  const activePortraitJob = React.useMemo(() => {
    const inFlight = portraitJobs.find(
      (j) => j.status === "queued" || j.status === "running"
    );
    if (inFlight) return inFlight;
    return portraitJobs.find((j) => j.status === "succeeded") ?? null;
  }, [portraitJobs]);

  const succeededPortraitJob = React.useMemo(
    () => portraitJobs.find((j) => j.status === "succeeded") ?? null,
    [portraitJobs]
  );

  const succeededPortraitUrl = React.useMemo(() => {
    if (!succeededPortraitJob) return null;
    return (
      parseHostedImageResultReference(succeededPortraitJob.result_reference)
        ?.url ?? null
    );
  }, [succeededPortraitJob]);

  const watchedPortraitUrl = useWatch({
    control: form.control,
    name: "portraitUrl",
  });
  const jobAlreadyInForm =
    Boolean(succeededPortraitUrl) &&
    watchedPortraitUrl === succeededPortraitUrl;

  const enqueuePortraitJob = async (opts?: { withRevision?: boolean }) => {
    if (!characterTsid) return;
    setPortraitEnqueueBusy(true);
    setPortraitJobHint(null);
    try {
      const existingPortrait = form.getValues("portraitUrl")?.trim();
      const baseDescription = descriptionWithArchiveAppearance(
        props.workId,
        form.getValues("name"),
        form.getValues("description")?.trim() ?? ""
      );
      const note = portraitRevisionNote.trim();
      const description =
        opts?.withRevision && note
          ? baseDescription
            ? `${baseDescription}\n\n[操作员修改意见] ${note}`
            : `[操作员修改意见] ${note}`
          : baseDescription || undefined;
      const result = await enqueueCharacterPortraitJobs({
        workId: props.workId,
        characters: [
          {
            characterTsid,
            name: form.getValues("name"),
            description,
            referenceUrl:
              existingPortrait &&
              (existingPortrait.startsWith("http://") ||
                existingPortrait.startsWith("https://")) &&
              existingPortrait !== succeededPortraitUrl
                ? existingPortrait
                : undefined,
          },
        ],
      });
      if (!result.ok) {
        setPortraitJobHint(result.message);
        return;
      }
      const newIds = new Set(result.jobs.map((j) => j.id));
      const toDiscard = portraitJobs.filter(
        (j) =>
          (j.status === "succeeded" || j.status === "failed") &&
          !newIds.has(j.id)
      );
      for (const old of toDiscard) {
        const discarded = await discardGenerateJob({
          workId: props.workId,
          jobId: old.id,
          reason:
            opts?.withRevision && note
              ? `operator_superseded_with_revision: ${note.slice(0, 200)}`
              : "operator_superseded_requeue",
        });
        if (!discarded.ok) {
          setPortraitJobHint(
            `已重新排队，但丢弃旧任务失败：${discarded.message}`
          );
          await refreshPortraitJobs();
          return;
        }
      }
      if (opts?.withRevision && note) {
        setPortraitRevisionNote("");
      }
      setPortraitJobHint(
        result.skipped.length
          ? "已有 queued/running 任务，未重复入队。请等 Worker 或点刷新。"
          : toDiscard.length > 0
            ? opts?.withRevision && note
              ? "已按修改意见重新排队；不满意的旧结果已移除。"
              : "已重新排队；不满意的旧结果已移除。"
            : "已排队。Worker 完成后可预览 Job 结果；纳入表单后保存才写 Asset。"
      );
      await refreshPortraitJobs();
    } catch (e) {
      setPortraitJobHint(e instanceof Error ? e.message : String(e));
    } finally {
      setPortraitEnqueueBusy(false);
    }
  };

  const acceptJobPortraitToForm = () => {
    if (!succeededPortraitUrl) return;
    form.setValue("portraitUrl", succeededPortraitUrl, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setPortraitAcceptPending(true);
    setPortraitJobHint(
      "已纳入表单候选。须「接受肖像并保存」或「保存」才写入 Assets。"
    );
  };

  useEffect(() => {
    if (avatarGenState?.ok) {
      form.setValue("portraitUrl", avatarGenState.url, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setPortraitAcceptPending(true);
    } else if (avatarGenState && !avatarGenState.ok) {
      // C: AI generation failed — auto-fill placeholder so character creation is not blocked
      const current = form.getValues("portraitUrl");
      if (!current) {
        form.setValue("portraitUrl", PORTRAIT_PLACEHOLDER, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      setPortraitAcceptPending(false);
    }
  }, [avatarGenState, form]);

  const acceptPortraitAndSave = async () => {
    if (props.mode !== "edit") return;
    setSubmitError(null);
    setAcceptSavePending(true);
    try {
      const values = form.getValues();
      await charactersApi.update(
        props.workId,
        props.defaultValues.tsid,
        toPayload(values)
      );
      setPortraitAcceptPending(false);
      form.reset(values);
      router.push(successHref);
    } catch (e) {
      setSubmitError(toSubmitError(e));
    } finally {
      setAcceptSavePending(false);
    }
  };

  // ── Form submission ────────────────────────────────────────────────────────

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (props.mode === "create") {
        await charactersApi.create(props.workId, toPayload(values));
      } else {
        await charactersApi.update(
          props.workId,
          props.defaultValues.tsid,
          toPayload(values)
        );
      }
      setPortraitAcceptPending(false);
      router.push(successHref);
    } catch (e) {
      setSubmitError(toSubmitError(e));
    }
  });

  // ── Copilot Panel accept/retry helpers ─────────────────────────────────────

  const handleAccept = (field: string, value: string) => {
    copilot.accept(
      field,
      value,
      form.getValues(field as keyof CharacterFormValues),
      (f, v) => form.setValue(f as keyof CharacterFormValues, v, { shouldDirty: true })
    );
  };

  const handleAcceptAll = () => {
    copilot.acceptAll(
      (f, v) => form.setValue(f as keyof CharacterFormValues, v, { shouldDirty: true }),
      (f) => form.getValues(f as keyof CharacterFormValues)
    );
  };

  const handleBatchRetry = () => {
    copilot.batchRetry(watchedName);
  };

  // ── Narrative Regenerate helper (§9.5) ─────────────────────────────────────

  const handleRegen = (
    field: string,
    currentValue: string,
    feedback?: string | null
  ) => {
    return copilot.narrativeRegen(field, currentValue, watchedName, feedback);
  };

  const handleAcceptRegen = (field: string) => {
    copilot.acceptRegen(
      field,
      (f, v) => form.setValue(f as keyof CharacterFormValues, v, { shouldDirty: true })
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {submitError ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </div>
      ) : null}

      {/* ── Name (Scope Field) — with CopilotIcon ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="char-name">姓名</Label>
          {/* Duplicate conflict indicator (§4.2) */}
          {copilot.dupConflict && (
            <span className="text-xs text-destructive">该名称已存在</span>
          )}
          {/* CopilotIcon — sole suggestion trigger (RT-INV-13) */}
          <CopilotIcon
            state={copilot.isSuggesting ? "loading" : copilot.iconState}
            onClick={() => copilot.triggerSuggest(form.getValues())}
          />
        </div>
        <Input
          id="char-name"
          {...form.register("name")}
          aria-invalid={!!form.formState.errors.name}
        />
        {form.formState.errors.name && (
          <p className="text-destructive text-sm">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      {/* ── House (canonical — fact route) ── */}
      <div className="space-y-2">
        <Label htmlFor="char-house">家族</Label>
        <Input id="char-house" {...form.register("house")} />
      </div>

      {/* ── Description (narrative) ── */}
      <div className="space-y-2">
        <Label htmlFor="char-description">描述</Label>
        <Textarea id="char-description" {...form.register("description")} />
        <NarrativeRegenButton
          field="description"
          currentValue={form.watch("description")}
          entityType="character"
          pendingItem={copilot.pendingRegen["description"]}
          onRegen={(feedback) =>
            handleRegen("description", form.getValues("description"), feedback)
          }
          onAcceptRegen={() => handleAcceptRegen("description")}
          onDismissRegen={() => copilot.dismissRegen("description")}
        />
      </div>

      {/* ── Signature Quote (narrative) ── */}
      <div className="space-y-2">
        <Label htmlFor="char-signature-quote">
          标志性台词
          <span className="ml-1 text-xs text-muted-foreground">（选填）</span>
        </Label>
        <Textarea
          id="char-signature-quote"
          placeholder="角色的标志性语句…"
          {...form.register("signatureQuote")}
        />
        <NarrativeRegenButton
          field="signatureQuote"
          currentValue={form.watch("signatureQuote") ?? ""}
          entityType="character"
          pendingItem={copilot.pendingRegen["signatureQuote"]}
          onRegen={(feedback) =>
            handleRegen(
              "signatureQuote",
              form.getValues("signatureQuote") ?? "",
              feedback
            )
          }
          onAcceptRegen={() => handleAcceptRegen("signatureQuote")}
          onDismissRegen={() => copilot.dismissRegen("signatureQuote")}
        />
      </div>

      {/* ── Portrait URL (asset — excluded from Copilot, FC-03) ── */}
      <Controller
        name="portraitUrl"
        control={form.control}
        render={({ field }) => (
          <div className="space-y-2">
            <ImageUploader
              id="char-portrait"
              label="肖像图片"
              value={field.value}
              onChange={field.onChange}
              onUploadingChange={setImageUploading}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              {props.mode === "edit" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    portraitEnqueueBusy ||
                    activePortraitJob?.status === "queued" ||
                    activePortraitJob?.status === "running"
                  }
                  onClick={() => void enqueuePortraitJob()}
                >
                  {portraitEnqueueBusy
                    ? "排队中…"
                    : activePortraitJob?.status === "queued"
                      ? "已排队"
                      : activePortraitJob?.status === "running"
                        ? "生成中…"
                        : succeededPortraitUrl ||
                            activePortraitJob?.status === "failed"
                          ? "重新排队"
                          : "排队生成肖像"}
                </Button>
              ) : null}
              {props.mode === "edit" && succeededPortraitUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={acceptJobPortraitToForm}
                  disabled={jobAlreadyInForm}
                >
                  {jobAlreadyInForm ? "已纳入表单" : "纳入表单"}
                </Button>
              ) : null}
              {props.mode === "edit" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={portraitEnqueueBusy}
                  onClick={() => void refreshPortraitJobs()}
                >
                  刷新任务
                </Button>
              ) : null}
              {props.mode === "edit" &&
              (activePortraitJob?.status === "queued" ||
                activePortraitJob?.status === "running") ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500"
                  disabled={portraitEnqueueBusy}
                  onClick={() => {
                    void (async () => {
                      if (!activePortraitJob) return;
                      setPortraitEnqueueBusy(true);
                      setPortraitJobHint(null);
                      try {
                        const result = await discardGenerateJob({
                          workId: props.workId,
                          jobId: activePortraitJob.id,
                          reason: "operator_aborted",
                        });
                        if (!result.ok) {
                          setPortraitJobHint(result.message);
                          return;
                        }
                        setPortraitJobHint("已取消进行中任务。");
                        await refreshPortraitJobs();
                      } catch (e) {
                        setPortraitJobHint(
                          e instanceof Error ? e.message : String(e)
                        );
                      } finally {
                        setPortraitEnqueueBusy(false);
                      }
                    })();
                  }}
                >
                  取消任务
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={avatarGenPending}
                className="min-w-[9.5rem]"
                title="同步生成须留在本页；离开会丢失结果。可离开时请用「排队生成肖像」。"
                onClick={() => {
                  const fd = new FormData();
                  fd.append("name", watchedName);
                  fd.append(
                    "description",
                    descriptionWithArchiveAppearance(
                      props.workId,
                      watchedName,
                      watchedDescription
                    )
                  );
                  if (props.mode === "edit") {
                    fd.append("characterTsid", props.defaultValues.tsid);
                  }
                  const existingPortrait = form.getValues("portraitUrl")?.trim();
                  if (
                    existingPortrait &&
                    (existingPortrait.startsWith("http://") ||
                      existingPortrait.startsWith("https://"))
                  ) {
                    fd.append("referencePortraitUrl", existingPortrait);
                  }
                  startTransition(() => {
                    avatarGenAction(fd);
                  });
                }}
              >
                {avatarGenPending
                  ? messages.forms.generating
                  : `${messages.forms.aiGenerateAvatar}（同步·兼容）`}
              </Button>
              {props.mode === "edit" && portraitAcceptPending ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    acceptSavePending ||
                    avatarGenPending ||
                    imageUploading ||
                    form.formState.isSubmitting
                  }
                  onClick={() => void acceptPortraitAndSave()}
                >
                  {acceptSavePending ? "写入中…" : "接受肖像并保存"}
                </Button>
              ) : null}
              {avatarGenPending ? (
                <p
                  className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                  role="status"
                >
                  同步生成中，请留在本页。跳转或关闭后结果无法写回表单。
                  {props.mode === "edit"
                    ? "若要离开去做别的，请改用「排队生成肖像」。"
                    : "新建角色需先保存后再用排队生成。"}
                </p>
              ) : (
                <p className="w-full text-xs text-zinc-500">
                  「同步·兼容」须等本页出结果；离开会丢。
                  {props.mode === "edit"
                    ? "可离开时用上方「排队生成肖像」。"
                    : "保存角色后可在编辑页排队生成。"}
                </p>
              )}
              {avatarGenState && !avatarGenState.ok ? (
                <p className="text-destructive max-w-md text-sm">
                  {avatarGenState.message}
                </p>
              ) : null}
              {portraitJobHint ? (
                <p className="w-full text-xs text-zinc-500">{portraitJobHint}</p>
              ) : null}
              {props.mode === "edit" && activePortraitJob ? (
                <p className="w-full text-[11px] text-zinc-500">
                  job {activePortraitJob.status}
                  {activePortraitJob.error
                    ? ` · ${formatGenerateJobErrorForOperator(activePortraitJob.error) ?? activePortraitJob.error}`
                    : ""}
                </p>
              ) : null}
              {props.mode === "edit" && succeededPortraitUrl ? (
                <div className="flex w-full flex-wrap items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                  <button
                    type="button"
                    className="group relative shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    onClick={() => setJobPreviewOpen(true)}
                    aria-label="放大预览 Job 生成结果"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={succeededPortraitUrl}
                      alt=""
                      className="h-20 w-20 rounded object-cover bg-zinc-100 transition group-hover:opacity-90"
                    />
                    <span className="absolute inset-x-0 bottom-0 rounded-b bg-black/55 py-0.5 text-center text-[10px] text-white">
                      放大
                    </span>
                  </button>
                  <div className="min-w-0 flex-1 space-y-2 text-xs text-zinc-600">
                    <p className="font-medium text-zinc-800">
                      Job 结果预览（尚未写入表单 / Asset）
                    </p>
                    <p>
                      白图或不可用：勿「纳入表单」。可改下方意见后「带意见重新排队」，或点「重新排队」。
                    </p>
                    <Textarea
                      rows={2}
                      value={portraitRevisionNote}
                      onChange={(e) => setPortraitRevisionNote(e.target.value)}
                      placeholder="修改意见（可选）：例如不要白屏、需清晰脸部…"
                      className="min-h-[3.5rem] text-xs"
                      disabled={
                        portraitEnqueueBusy ||
                        activePortraitJob?.status === "queued" ||
                        activePortraitJob?.status === "running"
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={
                        !portraitRevisionNote.trim() ||
                        portraitEnqueueBusy ||
                        activePortraitJob?.status === "queued" ||
                        activePortraitJob?.status === "running"
                      }
                      onClick={() =>
                        void enqueuePortraitJob({ withRevision: true })
                      }
                    >
                      带意见重新排队
                    </Button>
                    {succeededPortraitJob &&
                    (succeededPortraitJob.status === "succeeded" ||
                      succeededPortraitJob.status === "failed") ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-zinc-500"
                        disabled={portraitEnqueueBusy}
                        onClick={() => {
                          void (async () => {
                            setPortraitEnqueueBusy(true);
                            setPortraitJobHint(null);
                            try {
                              const result = await discardGenerateJob({
                                workId: props.workId,
                                jobId: succeededPortraitJob.id,
                                reason: "operator_discarded",
                              });
                              if (!result.ok) {
                                setPortraitJobHint(result.message);
                                return;
                              }
                              setPortraitJobHint("已丢弃该 Job 结果。");
                              await refreshPortraitJobs();
                            } catch (e) {
                              setPortraitJobHint(
                                e instanceof Error ? e.message : String(e)
                              );
                            } finally {
                              setPortraitEnqueueBusy(false);
                            }
                          })();
                        }}
                      >
                        丢弃此结果
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {props.mode === "edit" && portraitAcceptPending ? (
                <p className="w-full text-xs text-zinc-500">
                  表单内为候选。须点「接受肖像并保存」或「保存」才写入
                  Assets（Gate E）。不会自动完成制作进度。
                </p>
              ) : null}
              {props.mode === "create" ? (
                <p className="w-full text-xs text-zinc-500">
                  排队生成需先保存角色（有 tsid）。创建后可在编辑页或制作页入队。
                </p>
              ) : null}
            </div>
            {form.formState.errors.portraitUrl && (
              <p className="text-destructive text-sm">
                {form.formState.errors.portraitUrl.message}
              </p>
            )}
            <PortraitJobResultDialog
              open={jobPreviewOpen}
              onOpenChange={setJobPreviewOpen}
              imageUrl={succeededPortraitUrl}
              inputJson={succeededPortraitJob?.input_json ?? null}
              currentName={watchedName}
              currentDescription={watchedDescription}
              editHref={
                props.mode === "edit"
                  ? `/works/${encodeURIComponent(props.workId)}/characters/${encodeURIComponent(props.defaultValues.tsid)}/edit#char-description`
                  : null
              }
            />
          </div>
        )}
      />

      {/* ── Suggestion Panel (right-side drawer) ── */}
      <Sheet open={copilot.panelOpen} onOpenChange={(open) => { if (!open) copilot.closePanel(); }}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto flex flex-col gap-0">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center gap-2">
              <SheetTitle>{messages.copilot.suggestions}</SheetTitle>
              {copilot.suggestions.length > 0 && (
                <span className="rounded-full bg-violet-100 dark:bg-violet-900 px-2 py-0.5 text-xs text-violet-700 dark:text-violet-300 font-medium">
                  {copilot.suggestions.length} 条
                </span>
              )}
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto pt-4">
            <SuggestionPanel
              suggestions={copilot.suggestions}
              retryQueue={copilot.retryQueue}
              isRetrying={copilot.isRetrying}
              suggestErrors={copilot.suggestErrors}
              fieldLabels={FIELD_LABELS}
              showHeader={false}
              onAccept={handleAccept}
              onSkip={copilot.skip}
              onAddToRetryQueue={copilot.addToRetryQueue}
              onAcceptAll={handleAcceptAll}
              onBatchRetry={handleBatchRetry}
              onClose={copilot.closePanel}
              isSuggesting={copilot.isSuggesting}
              onRetryFailed={() => {
                void copilot.triggerSuggest(form.getValues());
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Form actions ── */}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={
            form.formState.isSubmitting || imageUploading || avatarGenPending
          }
        >
          {form.formState.isSubmitting
            ? "提交中…"
            : props.mode === "create"
              ? "创建"
              : "保存"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={listHref}>取消</Link>
        </Button>
      </div>
    </form>
  );
}
