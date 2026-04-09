"use client";

import {
  ArrowDown,
  ArrowUp,
  Loader2Icon,
  UploadIcon,
  X,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { uploadToCloudinary } from "@/lib/cloudinary";
import type { StoryImage } from "@/lib/types";

type MultiImageUploaderProps = {
  value: StoryImage[];
  onChange: (next: StoryImage[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
};

export function MultiImageUploader({
  value,
  onChange,
  onUploadingChange,
}: MultiImageUploaderProps) {
  const addInputRef = React.useRef<HTMLInputElement>(null);
  const [addingCount, setAddingCount] = React.useState(0);
  const isAdding = addingCount > 0;

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...value];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };

  const moveDown = (index: number) => {
    if (index >= value.length - 1) return;
    const next = [...value];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateCaption = (index: number, caption: string) => {
    const next = [...value];
    next[index] = { ...next[index], caption };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.map((item, index) => (
        <div key={`${item.url}-${index}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="rounded border bg-muted/30 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                className="max-h-20 object-contain"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={index === 0}
              onClick={() => moveUp(index)}
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={index === value.length - 1}
              onClick={() => moveDown(index)}
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => remove(index)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <Textarea
            rows={2}
            placeholder="Caption for this image (optional)"
            value={item.caption}
            onChange={(e) => updateCaption(index, e.target.value)}
            className="max-w-md"
          />
        </div>
      ))}

      <input
        ref={addInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          setAddingCount(files.length);
          onUploadingChange?.(true);
          const results = await Promise.allSettled(
            files.map((f) => uploadToCloudinary(f))
          );
          const newUrls = results
            .filter(
              (r): r is PromiseFulfilledResult<string> =>
                r.status === "fulfilled"
            )
            .map((r) => r.value);
          const newItems: StoryImage[] = newUrls.map((url) => ({
            url,
            caption: "",
          }));
          onChange([...value, ...newItems]);
          setAddingCount(0);
          onUploadingChange?.(false);
          if (addInputRef.current) {
            addInputRef.current.value = "";
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isAdding}
        onClick={() => addInputRef.current?.click()}
      >
        {isAdding ? (
          <>
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            上传中 {addingCount} 张…
          </>
        ) : (
          <>
            <UploadIcon className="size-4" aria-hidden />
            添加图片（可多选）
          </>
        )}
      </Button>
    </div>
  );
}
