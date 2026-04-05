"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createScene, updateScene } from "@/lib/scenes";
import type { Scene } from "@/lib/types";

const commaListToArray = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const sceneFormSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  chapterInfo: z.string().min(1, "章节信息不能为空"),
  summary: z.string().min(1, "摘要不能为空"),
  tags: z.string(),
  locationId: z.string().min(1, "地点 ID 不能为空"),
  characterIds: z.string(),
});

export type SceneFormValues = z.infer<typeof sceneFormSchema>;

function sceneToFormValues(scene: Scene): SceneFormValues {
  return {
    title: scene.title,
    chapterInfo: scene.chapterInfo,
    summary: scene.summary,
    tags: scene.tags.join(", "),
    locationId: scene.locationId,
    characterIds: scene.characterIds.join(", "),
  };
}

function formValuesToPayload(
  values: SceneFormValues
): Omit<Scene, "tsid" | "workId"> {
  return {
    title: values.title.trim(),
    chapterInfo: values.chapterInfo.trim(),
    summary: values.summary.trim(),
    tags: commaListToArray(values.tags),
    locationId: values.locationId.trim(),
    characterIds: commaListToArray(values.characterIds),
  };
}

function toSubmitError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

type SceneFormProps =
  | { workId: string; mode: "create"; defaultValues?: undefined }
  | { workId: string; mode: "edit"; defaultValues: Scene };

export function SceneForm(props: SceneFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const listHref = `/works/${encodeURIComponent(props.workId)}/scenes`;

  const defaultValues: SceneFormValues =
    props.mode === "edit"
      ? sceneToFormValues(props.defaultValues)
      : {
          title: "",
          chapterInfo: "",
          summary: "",
          tags: "",
          locationId: "",
          characterIds: "",
        };

  const form = useForm<SceneFormValues>({
    resolver: zodResolver(sceneFormSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (props.mode === "create") {
        await createScene(props.workId, formValuesToPayload(values));
      } else {
        await updateScene(
          props.workId,
          props.defaultValues.tsid,
          formValuesToPayload(values)
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
        <Label htmlFor="title">标题</Label>
        <Input id="title" {...form.register("title")} aria-invalid={!!form.formState.errors.title} />
        {form.formState.errors.title && (
          <p className="text-destructive text-sm">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="chapterInfo">章节信息</Label>
        <Input
          id="chapterInfo"
          {...form.register("chapterInfo")}
          aria-invalid={!!form.formState.errors.chapterInfo}
        />
        {form.formState.errors.chapterInfo && (
          <p className="text-destructive text-sm">
            {form.formState.errors.chapterInfo.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">摘要</Label>
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">标签（逗号分隔）</Label>
        <Input id="tags" {...form.register("tags")} placeholder="例如：序幕, 异鬼" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="locationId">地点 ID</Label>
        <Input
          id="locationId"
          {...form.register("locationId")}
          aria-invalid={!!form.formState.errors.locationId}
        />
        {form.formState.errors.locationId && (
          <p className="text-destructive text-sm">
            {form.formState.errors.locationId.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="characterIds">角色 ID（逗号分隔）</Label>
        <Input
          id="characterIds"
          {...form.register("characterIds")}
          placeholder="例如：char_arya, char_jon"
        />
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
