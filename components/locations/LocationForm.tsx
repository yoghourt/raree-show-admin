"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPicker } from "@/components/locations/MapPicker";
import * as locationsApi from "@/lib/locations";
import type { Location } from "@/lib/types";

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
  | { workId: string; mode: "create" }
  | { workId: string; mode: "edit"; defaultValues: Location };

export function LocationForm(props: LocationFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const listHref = `/works/${encodeURIComponent(props.workId)}/locations`;

  const defaultValues: LocationFormValues =
    props.mode === "edit"
      ? locationToFormValues(props.defaultValues)
      : {
          name: "",
          region: "",
          map_focus_x: null,
          map_focus_y: null,
          description: "",
        };

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues,
  });

  const mapFocusX = useWatch({ control: form.control, name: "map_focus_x" });
  const mapFocusY = useWatch({ control: form.control, name: "map_focus_y" });

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

      <div className="space-y-2">
        <Label htmlFor="loc-name">名称</Label>
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

      <div className="space-y-2">
        <Label htmlFor="loc-region">地区</Label>
        <Input id="loc-region" {...form.register("region")} />
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="loc-description">描述</Label>
        <Textarea id="loc-description" {...form.register("description")} />
      </div>

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
