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
import { createWork, updateWork } from "@/lib/works";

const workFormSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  description: z.string(),
  coverImage: z.string().min(1, "封面链接不能为空"),
});

export type WorkFormValues = z.infer<typeof workFormSchema>;

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

  const defaultValues: WorkFormValues =
    props.mode === "edit"
      ? props.defaultValues
      : { title: "", description: "", coverImage: "" };

  const form = useForm<WorkFormValues>({
    resolver: zodResolver(workFormSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (props.mode === "create") {
        await createWork({
          title: values.title.trim(),
          description: values.description.trim(),
          coverImage: values.coverImage.trim(),
        });
      } else {
        await updateWork(props.workId, {
          title: values.title.trim(),
          description: values.description.trim(),
          coverImage: values.coverImage.trim(),
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
        <Label htmlFor="work-description">描述</Label>
        <Textarea
          id="work-description"
          {...form.register("description")}
          aria-invalid={!!form.formState.errors.description}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="work-cover">封面图片 URL</Label>
        <Input
          id="work-cover"
          {...form.register("coverImage")}
          placeholder="https://..."
          aria-invalid={!!form.formState.errors.coverImage}
        />
        {form.formState.errors.coverImage && (
          <p className="text-destructive text-sm">
            {form.formState.errors.coverImage.message}
          </p>
        )}
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
          <Link href="/works">取消</Link>
        </Button>
      </div>
    </form>
  );
}
