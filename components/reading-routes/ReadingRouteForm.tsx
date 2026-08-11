"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEffect } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { CopilotIcon } from "@/components/copilot/CopilotIcon";
import { NarrativeRegenButton } from "@/components/copilot/NarrativeRegenButton";
import { SuggestionPanel } from "@/components/copilot/SuggestionPanel";
import { messages } from "@/lib/locale";
import { FrameContextDrawer } from "@/components/reading-routes/FrameContextDrawer";
import { FrameListPanel } from "@/components/reading-routes/FrameListPanel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCopilotSession } from "@/hooks/useCopilotSession";
import {
  listGenerateJobsForWork,
} from "@/lib/generate-jobs";
import { collectEmptyFrameUrlPatchesFromJobs } from "@/lib/generate-jobs/recoverSceneFrameUrls";
import {
  aggregateStoryRelatedRefs,
  formatStoryRelatedAggregateLine,
} from "@/lib/scene-context/aggregate-story-refs";
import {
  removeFrameWithContexts,
  rewriteContextsReadingRouteTsid,
  swapFramesWithContexts,
} from "@/lib/scene-context/frame-context-edit";
import type { SceneContextRecord } from "@/lib/scene-context/types";
import { createScene, patchSceneFrameUrls, updateScene } from "@/lib/scenes";
import type { Character, Location, ReadingFrame, ReadingRoute } from "@/lib/types";

// ---------------------------------------------------------------------------
// Scene Copilot field labels
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  chapter_number: "章节序号",
  title:          "标题",
  summary:        "摘要",
};

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const commaListToArray = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const sceneFormSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  chapter_number: z.preprocess(
    (v) => {
      if (typeof v === "number" && !Number.isNaN(v)) return v;
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        return Number.isNaN(n) ? undefined : n;
      }
      return undefined;
    },
    z.number({ error: "请填写章节序号" }).int().min(1, "章节序号至少为 1")
  ),
  chapter_title: z.preprocess(
    (v) => (v == null ? "" : String(v)),
    z.string().transform((s) => {
      const t = s.trim();
      return t === "" ? null : t;
    })
  ),
  summary: z.preprocess(
    (v) => (v == null ? "" : String(v)),
    z.string().optional().default("")
  ),
  tags: z.preprocess((v) => (v == null ? "" : String(v)), z.string()),
  // Keep caption-only frames (Discovery→Assets). Drop only fully blank segments
  // so character-only edits can still save without forcing image upload.
  story_images_v2: z.preprocess(
    (v) => {
      if (!Array.isArray(v)) return [];
      return v
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const rec = item as { url?: unknown; caption?: unknown };
          return {
            url: typeof rec.url === "string" ? rec.url : "",
            caption: typeof rec.caption === "string" ? rec.caption : "",
          };
        })
        .filter(
          (item) => item.url.trim() !== "" || item.caption.trim() !== ""
        );
    },
    z
      .array(
        z.object({
          url: z.string(),
          caption: z.string(),
        })
      )
      .default([])
  ),
  sceneContexts: z.array(z.any()).default([]),
});

export type ReadingRouteFormValues = {
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  summary: string;
  tags: string;
  story_images_v2: ReadingFrame[];
  sceneContexts: SceneContextRecord[];
};

function sceneToFormValues(scene: ReadingRoute): ReadingRouteFormValues {
  const story_images_v2 = scene.story_images_v2 ?? [];

  return {
    title: scene.title,
    chapter_number: scene.chapter_number,
    chapter_title: scene.chapter_title ?? "",
    summary: scene.summary,
    tags: scene.tags.join(", "),
    story_images_v2,
    sceneContexts: scene.sceneContexts ?? [],
  };
}

function formValuesToPayload(
  values: ReadingRouteFormValues
): Omit<ReadingRoute, "tsid" | "workId" | "order_index"> {
  // L3-C: no Route membership. L4-A: frames + hosted Contexts.
  return {
    title: values.title.trim(),
    chapter_number: values.chapter_number,
    chapter_title: values.chapter_title,
    summary: values.summary.trim(),
    tags: commaListToArray(values.tags),
    story_images_v2: values.story_images_v2,
    sceneContexts: values.sceneContexts,
  };
}

function toSubmitError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

type ReadingRouteFormBase = {
  workId: string;
  characters: Character[];
  locations: Location[];
  entitiesLoading?: boolean;
};

type ReadingRouteFormProps =
  | (ReadingRouteFormBase & { mode: "create" })
  | (ReadingRouteFormBase & { mode: "edit"; defaultValues: ReadingRoute });

export function ReadingRouteForm(props: ReadingRouteFormProps) {
  // characters/locations: L4-A Frame+Context drawer Archive pickers (not Route membership).
  const { workId, characters, locations } = props;
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [recoverHint, setRecoverHint] = React.useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = React.useState(false);
  const [drawerIndex, setDrawerIndex] = React.useState<number | null>(null);
  const listHref = `/works/${encodeURIComponent(workId)}/reading-routes`;

  const defaultValues: ReadingRouteFormValues =
    props.mode === "edit"
      ? sceneToFormValues(props.defaultValues)
      : {
          title: "",
          chapter_number: 1,
          chapter_title: "",
          summary: "",
          tags: "",
          story_images_v2: [],
          sceneContexts: [],
        };

  const form = useForm<ReadingRouteFormValues>({
    resolver: zodResolver(sceneFormSchema) as Resolver<ReadingRouteFormValues>,
    defaultValues,
  });

  const watchedTitle =
    useWatch({ control: form.control, name: "title" }) ?? "";

  // ── Copilot session (scope field = title, §4.1) ───────────────────────────

  const entityId = props.mode === "edit" ? props.defaultValues.tsid : "new";

  const copilot = useCopilotSession({
    entityType: "scene",
    workId,
    entityId,
  });

  // Trigger duplicate check on title change (AC-24, §4.2)
  const titleStr =
    typeof watchedTitle === "string" ? watchedTitle : (watchedTitle ?? "");

  useEffect(() => {
    copilot.onScopeFieldChange(titleStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleStr]);

  // Teardown on unmount (RT-INV-07)
  useEffect(() => {
    return () => copilot.teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recover frame images that were generated but never saved (job succeeded, Asset empty).
  useEffect(() => {
    if (props.mode !== "edit") return;
    const tsid = props.defaultValues.tsid;
    let cancelled = false;

    void (async () => {
      const currentFrames = form.getValues("story_images_v2") ?? [];
      if (!currentFrames.some((f) => !f.url?.trim())) return;

      try {
        const jobs = await listGenerateJobsForWork(workId, { limit: 80 });
        if (cancelled) return;
        const patches = collectEmptyFrameUrlPatchesFromJobs({
          sceneTsid: tsid,
          frames: currentFrames,
          jobs,
        });
        if (patches.length === 0) return;

        await patchSceneFrameUrls(workId, tsid, patches);
        if (cancelled) return;

        const next = [...(form.getValues("story_images_v2") ?? [])];
        for (const patch of patches) {
          const frame = next[patch.frameIndex];
          if (!frame) continue;
          next[patch.frameIndex] = { ...frame, url: patch.url };
        }
        form.setValue("story_images_v2", next, { shouldDirty: false });
        setRecoverHint(messages.forms.frameImageRecovered(patches.length));
      } catch (e) {
        console.warn("[ReadingRouteForm] recover frame urls failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Once per edit mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Form submission ────────────────────────────────────────────────────────

  const frames = useWatch({ control: form.control, name: "story_images_v2" }) ?? [];
  const sceneContexts =
    useWatch({ control: form.control, name: "sceneContexts" }) ?? [];

  const relatedLine = formatStoryRelatedAggregateLine(
    aggregateStoryRelatedRefs({ contexts: sceneContexts })
  );

  const readingRouteTsid =
    props.mode === "edit" ? props.defaultValues.tsid : "new";

  const setFramesAndContexts = (next: {
    frames: ReadingFrame[];
    contexts: SceneContextRecord[];
  }) => {
    form.setValue("story_images_v2", next.frames, { shouldDirty: true });
    form.setValue("sceneContexts", next.contexts, { shouldDirty: true });
  };

  const onSubmit = form.handleSubmit(
    async (values) => {
      setSubmitError(null);
      try {
        const payload = formValuesToPayload(values);
        if (props.mode === "create") {
          const tsid = `scene_${Date.now()}`;
          await createScene(workId, {
            ...payload,
            tsid,
            sceneContexts: rewriteContextsReadingRouteTsid(
              payload.sceneContexts ?? [],
              tsid
            ),
          });
        } else {
          await updateScene(workId, props.defaultValues.tsid, payload);
        }
        router.push(listHref);
      } catch (e) {
        setSubmitError(toSubmitError(e));
      }
    },
    (errors) => {
      const first =
        errors.title?.message ||
        errors.chapter_number?.message ||
        errors.summary?.message ||
        errors.story_images_v2?.message ||
        errors.story_images_v2?.root?.message ||
        (Array.isArray(errors.story_images_v2)
          ? errors.story_images_v2.find((e) => e?.url?.message || e?.caption?.message)
              ?.url?.message ||
            errors.story_images_v2.find((e) => e?.caption?.message)?.caption
              ?.message
          : undefined);
      setSubmitError(
        typeof first === "string" && first.trim()
          ? first
          : "表单校验未通过，请检查标红或未完成的字段（例如未上传图片的阅读帧片段）。"
      );
    }
  );

  // ── Copilot helpers ────────────────────────────────────────────────────────

  /**
   * Build form value map for empty-field enumeration.
   * chapter_number is treated as empty only if it equals the default (1) AND
   * the field has not been touched — to avoid always suggesting it.
   * All other fields use standard empty check.
   */
  const getFormValuesForCopilot = (): Record<string, unknown> => {
    const v = form.getValues();
    return {
      chapter_number: v.chapter_number,
      chapter_title: v.chapter_title,
      summary: v.summary,
      // Route membership demoted (L3-A) — excluded from Copilot / persist
      locationId: null,
      characterIds: [],
      story_images_v2: v.story_images_v2,
      tags: v.tags,
    };
  };

  const handleAccept = (field: string, value: string) => {
    // chapter_number requires numeric conversion
    if (field === "chapter_number") {
      const num = parseInt(value, 10);
      if (!Number.isNaN(num)) {
        const currentVal = form.getValues("chapter_number");
        // RT-INV-09: don't overwrite non-default (operator-set) chapter numbers
        if (currentVal === 1 || currentVal === undefined) {
          form.setValue("chapter_number", num, { shouldDirty: true });
          copilot.accept(
            field,
            value,
            "",   // treat as empty to allow the accept
            () => {} // setValue already called above
          );
        }
      }
      return;
    }

    copilot.accept(
      field,
      value,
      form.getValues(field as keyof ReadingRouteFormValues),
      (f, v) => form.setValue(f as keyof ReadingRouteFormValues, v as never, { shouldDirty: true })
    );
  };

  const handleAcceptAll = () => {
    const currentSuggestions = copilot.suggestions;
    currentSuggestions.forEach((s) => {
      handleAccept(s.field, s.value);
    });
    // Clear suggestions after accepting all
  };

  const handleBatchRetry = () => {
    copilot.batchRetry(titleStr);
  };

  const handleRegen = (field: string, feedback?: string | null) => {
    const currentValue = String(
      form.getValues(field as keyof ReadingRouteFormValues) ?? ""
    );
    return copilot.narrativeRegen(field, currentValue, titleStr, feedback);
  };

  const handleAcceptRegen = (field: string) => {
    copilot.acceptRegen(
      field,
      (f, v) => form.setValue(f as keyof ReadingRouteFormValues, v as never, { shouldDirty: true })
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
      {recoverHint ? (
        <div className="bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-sm">
          {recoverHint}
        </div>
      ) : null}

      {/* ── Title (Scope Field) — with CopilotIcon ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="title">标题</Label>
          {copilot.dupConflict && (
            <span className="text-xs text-destructive">该标题已存在</span>
          )}
          <CopilotIcon
            state={copilot.isSuggesting ? "loading" : copilot.iconState}
            onClick={() => copilot.triggerSuggest(getFormValuesForCopilot())}
          />
        </div>
        <Input
          id="title"
          {...form.register("title")}
          aria-invalid={!!form.formState.errors.title}
        />
        {form.formState.errors.title && (
          <p className="text-destructive text-sm">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      {/* ── Chapter Number + Chapter Title ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="chapter_number">章节序号</Label>
          <Input
            id="chapter_number"
            type="number"
            min={1}
            step={1}
            {...form.register("chapter_number", { valueAsNumber: true })}
            aria-invalid={!!form.formState.errors.chapter_number}
          />
          {form.formState.errors.chapter_number && (
            <p className="text-destructive text-sm">
              {form.formState.errors.chapter_number.message}
            </p>
          )}
        </div>

        {/* ── Chapter Title (optional POV label) ── */}
        <div className="space-y-2">
          <Label htmlFor="chapter_title">章节标题</Label>
          <Input
            id="chapter_title"
            placeholder={messages.forms.chapterTitlePlaceholder}
            {...form.register("chapter_title")}
            aria-invalid={!!form.formState.errors.chapter_title}
          />
        </div>
      </div>

      {/* ── Summary (narrative) ── */}
      <div className="space-y-2">
        <Label htmlFor="summary">{messages.forms.summaryOptional}</Label>
        <Textarea
          id="summary"
          {...form.register("summary")}
          aria-invalid={!!form.formState.errors.summary}
        />
        {form.formState.errors.summary && (
          <p className="text-destructive text-sm">
            {form.formState.errors.summary.message}
          </p>
        )}
        <NarrativeRegenButton
          field="summary"
          currentValue={form.watch("summary") ?? ""}
          entityType="scene"
          pendingItem={copilot.pendingRegen["summary"]}
          onRegen={(feedback) => handleRegen("summary", feedback)}
          onAcceptRegen={() => handleAcceptRegen("summary")}
          onDismissRegen={() => copilot.dismissRegen("summary")}
        />
      </div>

      {/* ── Frame list + drawer (L4-A; Context owns cast/place) ── */}
      <div className="space-y-2">
        <Label>{messages.domain.readingFrame}</Label>
        <p className="text-muted-foreground text-xs">
          {messages.forms.readingFrameHint}
        </p>
        <FrameListPanel
          frames={frames}
          contexts={sceneContexts}
          onMoveUp={(i) => {
            const next = swapFramesWithContexts(frames, sceneContexts, i, i - 1);
            setFramesAndContexts(next);
            if (drawerIndex === i) setDrawerIndex(i - 1);
            else if (drawerIndex === i - 1) setDrawerIndex(i);
          }}
          onMoveDown={(i) => {
            const next = swapFramesWithContexts(frames, sceneContexts, i, i + 1);
            setFramesAndContexts(next);
            if (drawerIndex === i) setDrawerIndex(i + 1);
            else if (drawerIndex === i + 1) setDrawerIndex(i);
          }}
          onRemove={(i) => {
            const next = removeFrameWithContexts(frames, sceneContexts, i);
            setFramesAndContexts(next);
            if (drawerIndex == null) return;
            if (drawerIndex === i) setDrawerIndex(null);
            else if (drawerIndex > i) setDrawerIndex(drawerIndex - 1);
          }}
          onAdd={() => {
            setFramesAndContexts({
              frames: [...frames, { url: "", caption: "" }],
              contexts: sceneContexts,
            });
            setDrawerIndex(frames.length);
          }}
          onOpen={(i) => setDrawerIndex(i)}
        />
        {form.formState.errors.story_images_v2 ? (
          <p className="text-destructive text-sm">
            {form.formState.errors.story_images_v2.message ||
              form.formState.errors.story_images_v2.root?.message ||
              "阅读帧校验失败。空白片段会被忽略；有说明无图的帧可先保存，再在制作页补图。"}
          </p>
        ) : null}
      </div>

      <FrameContextDrawer
        open={drawerIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerIndex(null);
        }}
        workId={workId}
        readingRouteTsid={readingRouteTsid}
        routeTitle={titleStr}
        chapter_number={form.watch("chapter_number") || 1}
        chapter_title={form.watch("chapter_title")}
        frameIndex={drawerIndex}
        frames={frames}
        contexts={sceneContexts}
        characters={characters}
        locations={locations}
        onChange={setFramesAndContexts}
        onUploadingChange={setUploadingImages}
        onNavigate={setDrawerIndex}
      />

      {/* ── Related cast/place aggregate (read-only overview) ── */}
      <div className="space-y-1 rounded-lg border border-dashed px-3 py-2">
        <p className="text-xs font-medium">
          {messages.rollout.storyRelatedFromContexts}
        </p>
        <p className="text-muted-foreground text-xs">
          {messages.rollout.routeMembershipDemotedHint}
        </p>
        <p className="text-muted-foreground text-xs">
          {relatedLine?.trim()
            ? relatedLine
            : messages.rollout.storyRelatedFromContextsEmpty}
        </p>
      </div>

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
          disabled={form.formState.isSubmitting || uploadingImages}
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
