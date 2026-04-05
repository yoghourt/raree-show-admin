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
import * as charactersApi from "@/lib/characters";
import type { Character } from "@/lib/types";

const characterFormSchema = z.object({
  name: z.string().min(1, "姓名不能为空"),
  house: z.string(),
  description: z.string(),
  portraitUrl: z.string().min(1, "肖像链接不能为空"),
});

export type CharacterFormValues = z.infer<typeof characterFormSchema>;

function characterToFormValues(c: Character): CharacterFormValues {
  return {
    name: c.name,
    house: c.house,
    description: c.description,
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

  const defaultValues: CharacterFormValues =
    props.mode === "edit"
      ? characterToFormValues(props.defaultValues)
      : {
          name: "",
          house: "",
          description: "",
          portraitUrl: "",
        };

  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues,
  });

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
        <Label htmlFor="char-name">姓名</Label>
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

      <div className="space-y-2">
        <Label htmlFor="char-house">家族</Label>
        <Input id="char-house" {...form.register("house")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="char-description">描述</Label>
        <Textarea id="char-description" {...form.register("description")} />
      </div>

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
            {form.formState.errors.portraitUrl && (
              <p className="text-destructive text-sm">
                {form.formState.errors.portraitUrl.message}
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
          <Link href={listHref}>取消</Link>
        </Button>
      </div>
    </form>
  );
}
