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
  const fileInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const captionTextareaRefs = React.useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusCaptionIndexAfterCommit = React.useRef<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = React.useState<number | null>(
    null
  );
  const isUploading = uploadingIndex !== null;

  React.useEffect(() => {
    console.log("[MultiImageUploader] value shape check", {
      isArray: Array.isArray(value),
      length: value?.length,
      firstEntry: value?.[0],
      firstIsPlainObject:
        value?.[0] != null &&
        typeof value[0] === "object" &&
        !Array.isArray(value[0]),
      hasUrlCaptionKeys:
        value?.[0] != null &&
        "url" in value[0] &&
        "caption" in value[0],
    });
    // One-time mount log to verify `{ url, caption }[]` vs string[] (see SceneForm / types).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, []);

  React.useLayoutEffect(() => {
    const i = focusCaptionIndexAfterCommit.current;
    if (i === null) return;
    if (i >= 0 && i < value.length) {
      captionTextareaRefs.current[i]?.focus();
    }
    focusCaptionIndexAfterCommit.current = null;
  }, [value]);

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

  const updateUrl = (index: number, url: string) => {
    const next = [...value];
    next[index] = { ...next[index], url };
    onChange(next);
  };

  const addSegment = () => {
    const newIndex = value.length;
    focusCaptionIndexAfterCommit.current = newIndex;
    onChange([...value, { url: "", caption: "" }]);
  };

  const triggerFilePick = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const handleFileForIndex = async (index: number, file: File | undefined) => {
    if (!file) return;
    setUploadingIndex(index);
    onUploadingChange?.(true);
    try {
      const url = await uploadToCloudinary(file);
      updateUrl(index, url);
    } catch (e) {
      console.error("[MultiImageUploader] upload failed", e);
    } finally {
      setUploadingIndex(null);
      onUploadingChange?.(false);
      const input = fileInputRefs.current[index];
      if (input) input.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {value.map((item, index) => (
        <div
          key={`segment-${index}`}
          className="relative rounded-lg border border-border p-4 pt-12"
        >
          <div className="absolute right-3 top-3 flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={index === 0}
              onClick={() => moveUp(index)}
              aria-label="Move up"
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              disabled={index === value.length - 1}
              onClick={() => moveDown(index)}
              aria-label="Move down"
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8 text-destructive hover:text-destructive"
              onClick={() => remove(index)}
              aria-label="Remove segment"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <Textarea
            ref={(el) => {
              captionTextareaRefs.current[index] = el;
            }}
            rows={3}
            placeholder="What's happening in this scene?"
            value={item.caption}
            onChange={(e) => updateCaption(index, e.target.value)}
            className="w-full max-w-none resize-y"
            aria-invalid={item.caption === ""}
          />
          {item.caption === "" ? (
            <p className="text-destructive mt-1 text-sm">Caption is required</p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="bg-muted/30 flex min-h-[5rem] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-dashed border-border p-2">
              {isUploading && uploadingIndex === index ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2Icon className="size-4 shrink-0 animate-spin" />
                  Uploading...
                </div>
              ) : item.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.url}
                  alt=""
                  className="max-h-32 w-full max-w-xs object-contain"
                />
              ) : (
                <span className="text-muted-foreground text-sm">
                  No image yet
                </span>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <input
                ref={(el) => {
                  fileInputRefs.current[index] = el;
                }}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  void handleFileForIndex(index, file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading && uploadingIndex === index}
                onClick={() => triggerFilePick(index)}
              >
                {isUploading && uploadingIndex === index ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" aria-hidden />
                    Uploading...
                  </>
                ) : item.url ? (
                  <>
                    <UploadIcon className="size-4" aria-hidden />
                    Replace image
                  </>
                ) : (
                  <>
                    <UploadIcon className="size-4" aria-hidden />
                    Add image
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        onClick={addSegment}
      >
        + Add new segment
      </Button>
    </div>
  );
}
