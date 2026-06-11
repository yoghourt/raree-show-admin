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
import { CopilotIcon } from "@/components/copilot/CopilotIcon";
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
import { useCopilotSession } from "@/hooks/useCopilotSession";
import * as charactersApi from "@/lib/characters";
import { getClassification } from "@/lib/ai/field-registry";
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
  | { workId: string; mode: "create" }
  | { workId: string; mode: "edit"; defaultValues: Character };

export function CharacterForm(props: CharacterFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [imageUploading, setImageUploading] = React.useState(false);
  const listHref = `/works/${encodeURIComponent(props.workId)}/characters`;

  const [avatarGenState, avatarGenAction, avatarGenPending] = useActionState<
    GenerateCharacterAvatarState | null,
    FormData
  >(generateCharacterAvatar, null);

  const defaultValues: CharacterFormValues =
    props.mode === "edit"
      ? characterToFormValues(props.defaultValues)
      : {
          name: "",
          house: "",
          description: "",
          signatureQuote: null,
          portraitUrl: "",
        };

  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues,
  });

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

  // ── Avatar generation ──────────────────────────────────────────────────────

  useEffect(() => {
    if (avatarGenState?.ok) {
      form.setValue("portraitUrl", avatarGenState.url, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else if (avatarGenState && !avatarGenState.ok) {
      // C: AI generation failed — auto-fill placeholder so character creation is not blocked
      const current = form.getValues("portraitUrl");
      if (!current) {
        form.setValue("portraitUrl", PORTRAIT_PLACEHOLDER, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }, [avatarGenState, form]);

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
      router.push(listHref);
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

  const handleRegen = (field: string, currentValue: string) => {
    copilot.narrativeRegen(field, currentValue, watchedName);
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
        <NarrativeRegenButton
          field="house"
          currentValue={watchedDescription}
          entityType="character"
          pendingItem={copilot.pendingRegen["house"]}
          onRegen={() => handleRegen("house", form.getValues("house"))}
          onAcceptRegen={() => handleAcceptRegen("house")}
          onDismissRegen={() => copilot.dismissRegen("house")}
        />
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
          onRegen={() => handleRegen("description", form.getValues("description"))}
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
          onRegen={() => handleRegen("signatureQuote", form.getValues("signatureQuote") ?? "")}
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={avatarGenPending}
                className="min-w-[9.5rem]"
                onClick={() => {
                  const fd = new FormData();
                  fd.append("name", watchedName);
                  fd.append("description", watchedDescription);
                  if (props.mode === "edit") {
                    fd.append("characterTsid", props.defaultValues.tsid);
                  }
                  startTransition(() => {
                    avatarGenAction(fd);
                  });
                }}
              >
                {avatarGenPending ? "Generating..." : "AI Generate"}
              </Button>
              {avatarGenState && !avatarGenState.ok ? (
                <p className="text-destructive max-w-md text-sm">
                  {avatarGenState.message}
                </p>
              ) : null}
            </div>
            {form.formState.errors.portraitUrl && (
              <p className="text-destructive text-sm">
                {form.formState.errors.portraitUrl.message}
              </p>
            )}
          </div>
        )}
      />

      {/* ── Suggestion Panel (right-side drawer) ── */}
      <Sheet open={copilot.panelOpen} onOpenChange={(open) => { if (!open) copilot.closePanel(); }}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto flex flex-col gap-0">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center gap-2">
              <SheetTitle>Copilot 建议</SheetTitle>
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

// ---------------------------------------------------------------------------
// NarrativeRegenButton — Phase 2 (§9.5)
//
// Renders a Regenerate button ONLY if classification === "narrative".
// Button visibility is derived from FIELD_REGISTRY — no field name literals
// in the eligibility condition (AC-26, MD-01).
// ---------------------------------------------------------------------------

interface NarrativeRegenButtonProps {
  field: string;
  currentValue: string;
  entityType: "character" | "location" | "scene";
  pendingItem: import("@/lib/ai/copilot-types").SuggestionItem | undefined;
  onRegen: () => void;
  onAcceptRegen: () => void;
  onDismissRegen: () => void;
}

function NarrativeRegenButton({
  field,
  currentValue,
  entityType,
  pendingItem,
  onRegen,
  onAcceptRegen,
  onDismissRegen,
}: NarrativeRegenButtonProps) {
  // AC-26: classification derived from registry — no field name literals in condition
  const classification = getClassification(entityType, field);

  // Regenerate only available on narrative-classified fields with existing content (§9.5)
  if (classification !== "narrative") return null;
  if (!currentValue?.trim()) return null;

  if (pendingItem) {
    return (
      <div className="rounded-md border border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20 p-2.5 space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">再生成建议：</p>
        <p className="text-sm whitespace-pre-wrap">{pendingItem.value}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            onClick={onAcceptRegen}
          >
            接受并覆写
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onDismissRegen}
          >
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
