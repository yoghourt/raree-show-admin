"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEffect } from "react";
import {
  Controller,
  type Resolver,
  useForm,
  useWatch,
} from "react-hook-form";
import { z } from "zod";

import { EntityMultiFuzzyPicker } from "@/components/entity/EntityMultiFuzzyPicker";
import { FuzzyEntityCombobox } from "@/components/entity/FuzzyEntityCombobox";
import type { EntityOption } from "@/components/entity/types";
import { CopilotIcon } from "@/components/copilot/CopilotIcon";
import { SuggestionPanel } from "@/components/copilot/SuggestionPanel";
import { messages } from "@/lib/locale";
import { MultiImageUploader } from "@/components/reading-routes/MultiImageUploader";
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
import { getClassification } from "@/lib/ai/field-registry";
import { createScene, updateScene } from "@/lib/scenes";
import type { SuggestionItem } from "@/lib/ai/copilot-types";
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
      if (typeof v === "string" && v.trim() !== "") return Number(v);
      return undefined;
    },
    z.number().int().min(1, "章节序号至少为 1")
  ),
  chapter_title: z
    .string()
    .transform((s) => {
      const t = s.trim();
      return t === "" ? null : t;
    })
    .nullable(),
  summary: z.string().optional().default(""),
  tags: z.string(),
  story_images_v2: z
    .array(
      z.object({
        url: z.string().min(1),
        caption: z.string(),
      })
    )
    .default([]),
  locationId: z.string(),
  characterIdsTsids: z.array(z.string()),
  characterIdsFallback: z.string(),
});

export type ReadingRouteFormValues = {
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  summary: string;
  tags: string;
  story_images_v2: ReadingFrame[];
  locationId: string;
  characterIdsTsids: string[];
  characterIdsFallback: string;
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
    locationId: scene.locationId ?? "",
    characterIdsTsids: [...scene.characterIds],
    characterIdsFallback: "",
  };
}

function formValuesToPayload(
  values: ReadingRouteFormValues,
  hasCharacterPicker: boolean
): Omit<ReadingRoute, "tsid" | "workId"> {
  const characterIds = hasCharacterPicker
    ? values.characterIdsTsids
    : commaListToArray(values.characterIdsFallback);

  return {
    title: values.title.trim(),
    chapter_number: values.chapter_number,
    chapter_title: values.chapter_title,
    summary: values.summary.trim(),
    tags: commaListToArray(values.tags),
    story_images_v2: values.story_images_v2,
    locationId: values.locationId.trim() || null,
    characterIds,
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
  const { workId, characters, locations, entitiesLoading = false } = props;
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = React.useState(false);
  const listHref = `/works/${encodeURIComponent(workId)}/reading-routes`;

  const hasLocationPicker = locations.length > 0 || entitiesLoading;
  const hasCharacterPicker = characters.length > 0 || entitiesLoading;

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
          locationId: "",
          characterIdsTsids: [],
          characterIdsFallback: "",
        };

  const form = useForm<ReadingRouteFormValues>({
    resolver: zodResolver(sceneFormSchema) as Resolver<ReadingRouteFormValues>,
    defaultValues,
  });

  const watchedTitle =
    useWatch({ control: form.control, name: "title" }) ?? "";
  const watchedLocationId =
    useWatch({ control: form.control, name: "locationId" }) ?? "";

  const locationEntityOptions = React.useMemo((): EntityOption[] => {
    const list = [...locations];
    const base = list.map((l) => ({
      id: l.tsid,
      label: l.name,
      aliases: [l.tsid],
    }));
    if (
      watchedLocationId &&
      !list.some((l) => l.tsid === watchedLocationId)
    ) {
      return [
        {
          id: watchedLocationId,
          label: `${watchedLocationId}（不在当前地点库）`,
          aliases: [watchedLocationId],
        },
        ...base,
      ];
    }
    return base;
  }, [locations, watchedLocationId]);

  const characterEntityOptions = React.useMemo((): EntityOption[] => {
    return characters.map((c) => ({
      id: c.tsid,
      label: c.name,
      aliases: [c.tsid],
    }));
  }, [characters]);

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

  // ── Form submission ────────────────────────────────────────────────────────

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const payload = formValuesToPayload(values, hasCharacterPicker);
      if (props.mode === "create") {
        await createScene(workId, payload);
      } else {
        await updateScene(workId, props.defaultValues.tsid, payload);
      }
      router.push(listHref);
    } catch (e) {
      setSubmitError(toSubmitError(e));
    }
  });

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
      // reference and asset fields — excluded by registry (v1)
      locationId: v.locationId,
      characterIds: v.characterIdsTsids,
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

  const handleRegen = (field: string) => {
    const currentValue = String(form.getValues(field as keyof ReadingRouteFormValues) ?? "");
    copilot.narrativeRegen(field, currentValue, titleStr);
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
        <SceneNarrativeRegen
          field="summary"
          currentValue={form.watch("summary") ?? ""}
          pendingItem={copilot.pendingRegen["summary"]}
          onRegen={() => handleRegen("summary")}
          onAcceptRegen={() => handleAcceptRegen("summary")}
          onDismissRegen={() => copilot.dismissRegen("summary")}
        />
      </div>

      {/* ── Reading Frame (asset — excluded from Copilot, FC-03) ── */}
      <div className="space-y-2">
        <Label>{messages.domain.readingFrame}</Label>
        <p className="text-muted-foreground text-xs">
          {messages.forms.readingFrameHint}
        </p>
        <Controller
          name="story_images_v2"
          control={form.control}
          render={({ field }) => (
            <MultiImageUploader
              value={field.value}
              onChange={field.onChange}
              onUploadingChange={setUploadingImages}
            />
          )}
        />
      </div>

      {/* ── Location (reference — excluded in v1, OQ-03) ── */}
      <div className="space-y-2">
        <Label>地点（可选）</Label>
        {hasLocationPicker ? (
          <Controller
            name="locationId"
            control={form.control}
            render={({ field }) => (
              <FuzzyEntityCombobox
                value={field.value || undefined}
                options={locationEntityOptions}
                placeholder="选择地点"
                loading={entitiesLoading}
                disabled={form.formState.isSubmitting}
                onSelect={(opt) => field.onChange(opt.id)}
              />
            )}
          />
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              {messages.forms.noLocationDataHint}
            </p>
            <Input
              id="locationId"
              {...form.register("locationId")}
              placeholder={messages.forms.locationIdPlaceholder}
              aria-invalid={!!form.formState.errors.locationId}
            />
          </>
        )}
        {form.formState.errors.locationId && (
          <p className="text-destructive text-sm">
            {form.formState.errors.locationId.message}
          </p>
        )}
      </div>

      {/* ── Characters (reference — excluded in v1, OQ-03) ── */}
      <div className="space-y-2">
        <Label>角色</Label>
        {hasCharacterPicker ? (
          <Controller
            name="characterIdsTsids"
            control={form.control}
            render={({ field }) => {
              const orphans = field.value.filter(
                (id) => !characters.some((c) => c.tsid === id)
              );
              return (
                <div className="space-y-3">
                  <EntityMultiFuzzyPicker
                    options={characterEntityOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={messages.forms.searchCharacters}
                    loading={entitiesLoading}
                    disabled={form.formState.isSubmitting}
                  />
                  {orphans.length > 0 ? (
                    <div className="rounded-lg border border-border p-3 pt-2">
                      <p className="text-muted-foreground mb-2 text-xs">
                        {messages.works.orphanTsidWriteHint}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {orphans.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs"
                            onClick={() =>
                              field.onChange(
                                field.value.filter((x: string) => x !== id)
                              )
                            }
                          >
                            {id}
                            <span className="text-destructive">×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }}
          />
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              {messages.forms.noCharacterDataHint}
            </p>
            <Input
              id="characterIdsFallback"
              {...form.register("characterIdsFallback")}
              placeholder={messages.forms.characterIdsPlaceholder}
            />
          </>
        )}
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

// ---------------------------------------------------------------------------
// SceneNarrativeRegen — Narrative Regenerate button for scenes (§9.5)
// ---------------------------------------------------------------------------

interface SceneNarrativeRegenProps {
  field: string;
  currentValue: string;
  pendingItem: SuggestionItem | undefined;
  onRegen: () => void;
  onAcceptRegen: () => void;
  onDismissRegen: () => void;
}

function SceneNarrativeRegen({
  field,
  currentValue,
  pendingItem,
  onRegen,
  onAcceptRegen,
  onDismissRegen,
}: SceneNarrativeRegenProps) {
  // AC-26: derived from registry — no field name literals in condition
  const classification = getClassification("scene", field);
  if (classification !== "narrative") return null;
  if (!currentValue?.trim()) return null;

  if (pendingItem) {
    return (
      <div className="rounded-md border border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20 p-2.5 space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">再生成建议：</p>
        <p className="text-sm whitespace-pre-wrap">{pendingItem.value}</p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="h-7 text-xs" onClick={onAcceptRegen}>
            接受并覆写
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onDismissRegen}>
            忽略
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
      onClick={onRegen}
    >
      <RegenIcon />
      再生成
    </Button>
  );
}

function RegenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-1 h-3 w-3"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
