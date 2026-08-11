"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { messages } from "@/lib/locale";

export type ImageLightboxDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  title?: string;
};

/** Simple full-size image preview — no job/candidate semantics. */
export function ImageLightboxDialog({
  open,
  onOpenChange,
  imageUrl,
  title = messages.forms.imagePreviewTitle,
}: ImageLightboxDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {imageUrl ? (
          <div className="flex max-h-[min(85vh,56rem)] items-center justify-center rounded-md bg-zinc-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="max-h-[min(85vh,56rem)] w-full object-contain"
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {messages.forms.noImageYet}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
