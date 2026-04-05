"use client";

import { Loader2Icon, UploadIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

export type ImageUploaderProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (url: string) => void;
  /** 上传过程中为 true，用于禁用表单提交 */
  onUploadingChange?: (uploading: boolean) => void;
  className?: string;
};

export function ImageUploader({
  id = "image-uploader",
  label = "图片",
  value,
  onChange,
  onUploadingChange,
  className,
}: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const setUploadingState = React.useCallback(
    (v: boolean) => {
      setUploading(v);
      onUploadingChange?.(v);
    },
    [onUploadingChange]
  );

  const handleFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }
    setUploadError(null);
    setUploadingState(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingState(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor={id}>{label}</Label>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id={`${id}-file`}
            disabled={uploading}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
                上传中…
              </>
            ) : (
              <>
                <UploadIcon className="size-4" aria-hidden />
                选择本地图片
              </>
            )}
          </Button>
        </div>
        {value ? (
          <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- 任意外链预览 */}
            <img
              src={value}
              alt=""
              className="max-h-24 max-w-[200px] rounded-md object-contain"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-url`} className="text-muted-foreground">
          或直接粘贴图片 URL
        </Label>
        <Input
          id={`${id}-url`}
          type="url"
          placeholder="https://..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={uploading}
        />
      </div>

      {uploadError ? (
        <p className="text-destructive text-sm" role="alert">
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}
