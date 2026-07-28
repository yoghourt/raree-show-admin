"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { CopilotIcon } from "@/components/copilot/CopilotIcon";
import { NarrativeRegenButton } from "@/components/copilot/NarrativeRegenButton";
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
import { messages } from "@/lib/locale";
import * as locationsApi from "@/lib/locations";
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
  | { workId: string; mode: "create"; initialValues?: Partial<LocationFormValues>; successRedirectHref?: string }
  | { workId: string; mode: "edit"; defaultValues: Location; successRedirectHref?: string };

export function LocationForm(props: LocationFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const listHref = `/works/${encodeURIComponent(props.workId)}/locations`;
  const successHref = props.successRedirectHref ?? listHref;

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
      router.push(successHref);
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

  const handleRegen = (field: string, feedback?: string | null) => {
    return copilot.narrativeRegen(
      field,
      String(form.getValues(field as keyof LocationFormValues) ?? ""),
      watchedName,
      feedback
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
        <NarrativeRegenButton
          field="description"
          currentValue={String(form.watch("description") ?? "")}
          entityType="location"
          pendingItem={copilot.pendingRegen["description"]}
          onRegen={(feedback) => handleRegen("description", feedback)}
          onAcceptRegen={() => handleAcceptRegen("description")}
          onDismissRegen={() => copilot.dismissRegen("description")}
        />
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
