"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  Controller,
  type Resolver,
  useForm,
  useWatch,
} from "react-hook-form";
import { z } from "zod";

import { MultiImageUploader } from "@/components/scenes/MultiImageUploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createScene, updateScene } from "@/lib/scenes";
import type { Character, Location, Scene, StoryImage } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  locationId: z.string().min(1, "请选择或填写地点"),
  characterIdsTsids: z.array(z.string()),
  characterIdsFallback: z.string(),
});

export type SceneFormValues = {
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  summary: string;
  tags: string;
  story_images_v2: StoryImage[];
  locationId: string;
  characterIdsTsids: string[];
  characterIdsFallback: string;
};

function sceneToFormValues(scene: Scene): SceneFormValues {
  const story_images_v2 = scene.story_images_v2 ?? [];

  return {
    title: scene.title,
    chapter_number: scene.chapter_number,
    chapter_title: scene.chapter_title ?? "",
    summary: scene.summary,
    tags: scene.tags.join(", "),
    story_images_v2,
    locationId: scene.locationId,
    characterIdsTsids: [...scene.characterIds],
    characterIdsFallback: "",
  };
}

function formValuesToPayload(
  values: SceneFormValues,
  hasCharacterPicker: boolean
): Omit<Scene, "tsid" | "workId"> {
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
    locationId: values.locationId.trim(),
    characterIds,
  };
}

function toSubmitError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

type SceneFormBase = {
  workId: string;
  characters: Character[];
  locations: Location[];
};

type SceneFormProps =
  | (SceneFormBase & { mode: "create" })
  | (SceneFormBase & { mode: "edit"; defaultValues: Scene });

export function SceneForm(props: SceneFormProps) {
  const { workId, characters, locations } = props;
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = React.useState(false);
  const listHref = `/works/${encodeURIComponent(workId)}/scenes`;

  const hasLocationPicker = locations.length > 0;
  const hasCharacterPicker = characters.length > 0;

  const defaultValues: SceneFormValues =
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

  const form = useForm<SceneFormValues>({
    resolver: zodResolver(sceneFormSchema) as Resolver<SceneFormValues>,
    defaultValues,
  });

  const watchedLocationId =
    useWatch({ control: form.control, name: "locationId" }) ?? "";

  const selectLocationOptions = React.useMemo(() => {
    if (!hasLocationPicker) {
      return [];
    }
    const list = [...locations];
    if (
      watchedLocationId &&
      !list.some((l) => l.tsid === watchedLocationId)
    ) {
      return [
        {
          tsid: watchedLocationId,
          label: `${watchedLocationId}（不在当前地点库）`,
        },
        ...list.map((l) => ({ tsid: l.tsid, label: l.name })),
      ];
    }
    return list.map((l) => ({ tsid: l.tsid, label: l.name }));
  }, [hasLocationPicker, locations, watchedLocationId]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      console.log(
        "[SceneForm] submit story_images_v2 (uploader state)",
        values.story_images_v2
      );
      const payload = formValuesToPayload(values, hasCharacterPicker);
      console.log("[SceneForm] Supabase scene payload (story_images_v2 only)", payload);
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
        <div className="space-y-2">
          <Label htmlFor="chapter_title">章节标题</Label>
          <Input
            id="chapter_title"
            placeholder="可选，如：凛冬将至"
            {...form.register("chapter_title")}
            aria-invalid={!!form.formState.errors.chapter_title}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">摘要 (可选)</Label>
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
        <Label>Story Sequence</Label>
        <p className="text-muted-foreground text-xs">
          Each segment is one frame of the scene. Caption first, then add the
          image.
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

      <div className="space-y-2">
        <Label>地点</Label>
        {hasLocationPicker ? (
          <Controller
            name="locationId"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id="locationId"
                  className="w-full max-w-md"
                  aria-invalid={!!form.formState.errors.locationId}
                >
                  <SelectValue placeholder="选择地点" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {selectLocationOptions.map((opt) => (
                    <SelectItem key={opt.tsid} value={opt.tsid}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              当前作品暂无地点数据，请手动填写地点 TSID。
            </p>
            <Input
              id="locationId"
              {...form.register("locationId")}
              placeholder="例如：loc_winterfell"
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
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {characters.map((c) => (
                      <label
                        key={c.tsid}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md py-1 pr-2 hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={field.value.includes(c.tsid)}
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              field.onChange([...field.value, c.tsid]);
                            } else {
                              field.onChange(
                                field.value.filter(
                                  (id: string) => id !== c.tsid
                                )
                              );
                            }
                          }}
                        />
                        <span className="text-sm">{c.name}</span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {c.tsid}
                        </span>
                      </label>
                    ))}
                  </div>
                  {orphans.length > 0 ? (
                    <div className="border-t pt-2">
                      <p className="text-muted-foreground mb-2 text-xs">
                        以下 TSID 不在当前角色库中，仍将写入场景；可移除。
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
              当前作品暂无角色数据，请用英文逗号分隔填写角色 TSID。
            </p>
            <Input
              id="characterIdsFallback"
              {...form.register("characterIdsFallback")}
              placeholder="例如：char_arya, char_jon"
            />
          </>
        )}
      </div>

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
