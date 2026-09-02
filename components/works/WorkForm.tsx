"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { ImageUploader } from "@/components/ui/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { messages } from "@/lib/locale";
import {
  WORK_VISUAL_CONVENTION_MAX_CHARS,
  WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS,
} from "@/lib/prompts/work-visual-convention";
import { createWork, updateWork } from "@/lib/works";

const workFormSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  description: z.string(),
  coverImage: z.string().min(1, "封面链接不能为空"),
  sourceProfileId: z.string(),
  visualConvention: z.string(),
});

export type WorkFormValues = z.infer<typeof workFormSchema>;

type SourceProfileOption = {
  profileId: string;
  displayName: string;
  kind: string;
  workPattern: string;
};

function toSubmitError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return String(e);
}

type WorkFormProps =
  | { mode: "create" }
  | {
      mode: "edit";
      workId: string;
      defaultValues: WorkFormValues;
    };

export function WorkForm(props: WorkFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [imageUploading, setImageUploading] = React.useState(false);
  const [profiles, setProfiles] = React.useState<SourceProfileOption[]>([]);
  const [profilesLoading, setProfilesLoading] = React.useState(true);
  const [profilesError, setProfilesError] = React.useState<string | null>(null);

  const defaultValues: WorkFormValues =
    props.mode === "edit"
      ? props.defaultValues
      : {
          title: "",
          description: "",
          coverImage: "",
          sourceProfileId: "",
          visualConvention: "",
        };

  const form = useForm<WorkFormValues>({
    resolver: zodResolver(workFormSchema),
    defaultValues,
  });

  const savedSourceProfileId =
    props.mode === "edit" ? props.defaultValues.sourceProfileId : "";

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setProfilesLoading(true);
      try {
        const res = await fetch("/api/admin/source-profiles");
        if (!res.ok) {
          throw new Error(`加载来源配置失败 (${res.status})`);
        }
        const data = (await res.json()) as { profiles?: SourceProfileOption[] };
        if (!cancelled) {
          setProfiles(data.profiles ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setProfilesError(toSubmitError(e));
        }
      } finally {
        if (!cancelled) {
          setProfilesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-sync select after options load (native <select> ignores value without matching <option>)
  React.useEffect(() => {
    if (profilesLoading || profilesError) return;
    form.setValue("sourceProfileId", savedSourceProfileId, { shouldDirty: false });
  }, [profilesLoading, profilesError, profiles, savedSourceProfileId, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const sourceProfileId = values.sourceProfileId.trim() || null;
    try {
      if (props.mode === "create") {
        await createWork({
          title: values.title.trim(),
          description: values.description.trim(),
          coverImage: values.coverImage.trim(),
          sourceProfileId,
          visualConvention: values.visualConvention,
        });
      } else {
        await updateWork(props.workId, {
          title: values.title.trim(),
          description: values.description.trim(),
          coverImage: values.coverImage.trim(),
          sourceProfileId,
          visualConvention: values.visualConvention,
        });
      }
      router.push("/works");
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
        <Label htmlFor="work-title">标题</Label>
        <Input
          id="work-title"
          {...form.register("title")}
          aria-invalid={!!form.formState.errors.title}
        />
        {form.formState.errors.title && (
          <p className="text-destructive text-sm">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="work-source-profile">来源配置（Source Profile）</Label>
        <Controller
          name="sourceProfileId"
          control={form.control}
          render={({ field }) => (
            <select
              id="work-source-profile"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              value={profilesLoading ? "" : field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={profilesLoading}
            >
              <option value="">
                {profilesLoading ? "加载来源配置…" : "无（原创 / SC-03 路径）"}
              </option>
              {profiles.map((p) => (
                <option key={p.profileId} value={p.profileId}>
                  {p.displayName} ({p.workPattern})
                </option>
              ))}
            </select>
          )}
        />
        <p className="text-muted-foreground text-xs">
          绑定公共作品来源以启用外源证据；原创作品请留空。
        </p>
        {profilesError ? (
          <p className="text-destructive text-sm">{profilesError}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="work-description">描述</Label>
        <Textarea
          id="work-description"
          {...form.register("description")}
          aria-invalid={!!form.formState.errors.description}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="work-visual-convention">
          {messages.works.visualConvention}
          <span className="ml-1 text-xs text-muted-foreground">
            （保存最多 {WORK_VISUAL_CONVENTION_MAX_CHARS} 字，生图取前{" "}
            {WORK_VISUAL_CONVENTION_PROMPT_MAX_CHARS}）
          </span>
        </Label>
        <Textarea
          id="work-visual-convention"
          rows={4}
          placeholder={messages.works.visualConventionPlaceholder}
          {...form.register("visualConvention")}
        />
        <p className="text-muted-foreground text-xs">
          {messages.works.visualConventionHint}
        </p>
      </div>

      <Controller
        name="coverImage"
        control={form.control}
        render={({ field }) => (
          <div className="space-y-2">
            <ImageUploader
              id="work-cover"
              label="封面图片"
              value={field.value}
              onChange={field.onChange}
              onUploadingChange={setImageUploading}
            />
            {form.formState.errors.coverImage && (
              <p className="text-destructive text-sm">
                {form.formState.errors.coverImage.message}
              </p>
            )}
          </div>
        )}
      />

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting || imageUploading}
        >
          {form.formState.isSubmitting
            ? "提交中…"
            : props.mode === "create"
              ? "创建"
              : "保存"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/works">取消</Link>
        </Button>
      </div>
    </form>
  );
}
