"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { CopilotIcon } from "@/components/copilot/CopilotIcon";
import { SuggestionPanel } from "@/components/copilot/SuggestionPanel";
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
import { MapPicker } from "@/components/locations/MapPicker";
import { useCopilotSession } from "@/hooks/useCopilotSession";
import { getClassification } from "@/lib/ai/field-registry";
import * as locationsApi from "@/lib/locations";
import type { SuggestionItem } from "@/lib/ai/copilot-types";
import type { Location } from "@/lib/types";

// ---------------------------------------------------------------------------
// Location Copilot field labels
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  region:      "地区",
  description: "描述",
};

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const locationFormSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  region: z.string(),
  map_focus_x: z.number().min(0).max(1).nullable().optional(),
  map_focus_y: z.number().min(0).max(1).nullable().optional(),
  description: z.string(),
});

export type LocationFormValues = z.infer<typeof locationFormSchema>;

function locationToFormValues(loc: Location): LocationFormValues {
  return {
    name: loc.name,
    region: loc.region,
    map_focus_x: loc.map_focus_x ?? null,
    map_focus_y: loc.map_focus_y ?? null,
    description: loc.description,
  };
}

function toPayload(
  values: LocationFormValues
): Omit<Location, "id" | "tsid" | "workId" | "createdAt"> {
  return {
    name: values.name.trim(),
    region: values.region.trim(),
    map_focus_x: values.map_focus_x ?? null,
    map_focus_y: values.map_focus_y ?? null,
    description: values.description.trim(),
  };
}

function toSubmitError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

type LocationFormProps =
  | { workId: string; mode: "create"; initialValues?: Partial<LocationFormValues> }
  | { workId: string; mode: "edit"; defaultValues: Location };

export function LocationForm(props: LocationFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const listHref = `/works/${encodeURIComponent(props.workId)}/locations`;

  const defaultValues: LocationFormValues =
    props.mode === "edit"
      ? locationToFormValues(props.defaultValues)
      : {
          name: props.initialValues?.name ?? "",
          region: props.initialValues?.region ?? "",
          map_focus_x: props.initialValues?.map_focus_x ?? null,
          map_focus_y: props.initialValues?.map_focus_y ?? null,
          description: props.initialValues?.description ?? "",
        };

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (props.mode !== "create" || !props.initialValues) {
      return;
    }
    form.reset({
      name: props.initialValues.name ?? "",
      region: props.initialValues.region ?? "",
      map_focus_x: props.initialValues.map_focus_x ?? null,
      map_focus_y: props.initialValues.map_focus_y ?? null,
      description: props.initialValues.description ?? "",
    });
  }, [form, props]);

  const watchedName = useWatch({ control: form.control, name: "name" }) ?? "";
  const mapFocusX = useWatch({ control: form.control, name: "map_focus_x" });
  const mapFocusY = useWatch({ control: form.control, name: "map_focus_y" });

  // ── Copilot session ────────────────────────────────────────────────────────

  const entityId = props.mode === "edit" ? props.defaultValues.tsid : "new";

  const copilot = useCopilotSession({
    entityType: "location",
    workId: props.workId,
    entityId,
  });

  // Trigger duplicate check on name change (AC-24)
  useEffect(() => {
    copilot.onScopeFieldChange(watchedName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName]);

  // Teardown on unmount (RT-INV-07)
  useEffect(() => {
    return () => copilot.teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Form submission ────────────────────────────────────────────────────────

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (props.mode === "create") {
        await locationsApi.create(props.workId, toPayload(values));
      } else {
        await locationsApi.update(
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

  // ── Copilot helpers ────────────────────────────────────────────────────────

  const handleAccept = (field: string, value: string) => {
    copilot.accept(
      field,
      value,
      form.getValues(field as keyof LocationFormValues),
      (f, v) => form.setValue(f as keyof LocationFormValues, v as never, { shouldDirty: true })
    );
  };

  const handleAcceptAll = () => {
    copilot.acceptAll(
      (f, v) => form.setValue(f as keyof LocationFormValues, v as never, { shouldDirty: true }),
      (f) => form.getValues(f as keyof LocationFormValues)
    );
  };

  const handleBatchRetry = () => {
    copilot.batchRetry(watchedName);
  };

  const handleRegen = (field: string) => {
    copilot.narrativeRegen(
      field,
      String(form.getValues(field as keyof LocationFormValues) ?? ""),
      watchedName
    );
  };

  const handleAcceptRegen = (field: string) => {
    copilot.acceptRegen(
      field,
      (f, v) => form.setValue(f as keyof LocationFormValues, v as never, { shouldDirty: true })
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
          <Label htmlFor="loc-name">名称</Label>
          {copilot.dupConflict && (
            <span className="text-xs text-destructive">该名称已存在</span>
          )}
          <CopilotIcon
            state={copilot.isSuggesting ? "loading" : copilot.iconState}
            onClick={() => copilot.triggerSuggest(form.getValues())}
          />
        </div>
        <Input
          id="loc-name"
          {...form.register("name")}
          aria-invalid={!!form.formState.errors.name}
        />
        {form.formState.errors.name && (
          <p className="text-destructive text-sm">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      {/* ── Region (canonical — fact route) ── */}
      <div className="space-y-2">
        <Label htmlFor="loc-region">地区</Label>
        <Input id="loc-region" {...form.register("region")} />
        <LocationNarrativeRegen
          field="region"
          currentValue={String(form.watch("region") ?? "")}
          pendingItem={copilot.pendingRegen["region"]}
          onRegen={() => handleRegen("region")}
          onAcceptRegen={() => handleAcceptRegen("region")}
          onDismissRegen={() => copilot.dismissRegen("region")}
        />
      </div>

      {/* ── Map coordinates (asset — excluded from Copilot, FC-03) ── */}
      <div className="space-y-2">
        <Label>地图坐标</Label>
        <MapPicker
          value={{ x: mapFocusX ?? null, y: mapFocusY ?? null }}
          onChange={({ x, y }) => {
            form.setValue("map_focus_x", x, { shouldDirty: true });
            form.setValue("map_focus_y", y, { shouldDirty: true });
          }}
        />
      </div>

      {/* ── Description (narrative) ── */}
      <div className="space-y-2">
        <Label htmlFor="loc-description">描述</Label>
        <Textarea id="loc-description" {...form.register("description")} />
        <LocationNarrativeRegen
          field="description"
          currentValue={String(form.watch("description") ?? "")}
          pendingItem={copilot.pendingRegen["description"]}
          onRegen={() => handleRegen("description")}
          onAcceptRegen={() => handleAcceptRegen("description")}
          onDismissRegen={() => copilot.dismissRegen("description")}
        />
      </div>

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
        <Button type="submit" disabled={form.formState.isSubmitting}>
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
// LocationNarrativeRegen — Narrative Regenerate button (§9.5)
// ---------------------------------------------------------------------------

interface LocationNarrativeRegenProps {
  field: string;
  currentValue: string;
  pendingItem: SuggestionItem | undefined;
  onRegen: () => void;
  onAcceptRegen: () => void;
  onDismissRegen: () => void;
}

function LocationNarrativeRegen({
  field,
  currentValue,
  pendingItem,
  onRegen,
  onAcceptRegen,
  onDismissRegen,
}: LocationNarrativeRegenProps) {
  // AC-26: derived from registry — not from field name literal
  const classification = getClassification("location", field);
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
