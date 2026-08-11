"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ImageLightboxDialog } from "@/components/ui/ImageLightboxDialog";
import { messages } from "@/lib/locale";
import type { ReadingFrame } from "@/lib/types";
import type { SceneContextRecord } from "@/lib/scene-context/types";
import { contextAtFrameIndex } from "@/lib/scene-context/frame-context-edit";

type FrameListPanelProps = {
  frames: ReadingFrame[];
  contexts: SceneContextRecord[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onOpen: (index: number) => void;
};

export function FrameListPanel({
  frames,
  contexts,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAdd,
  onOpen,
}: FrameListPanelProps) {
  const [preview, setPreview] = React.useState<{
    url: string;
    title: string;
  } | null>(null);

  return (
    <div className="space-y-3">
      {frames.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {messages.forms.frameListEmpty}
        </p>
      ) : null}
      <ul className="space-y-2">
        {frames.map((frame, index) => {
          const ctx = contextAtFrameIndex(contexts, index);
          const castCount = ctx?.characterAppearanceContext.length ?? 0;
          const place =
            ctx?.locationContext.archiveName?.trim() ||
            ctx?.locationContext.environmentFromExpression?.trim() ||
            "";
          const caption = frame.caption.trim() || messages.forms.frameUntitled;
          const title = messages.forms.frameListItem(index + 1, caption);
          return (
            <li
              key={`frame-${index}`}
              className="flex items-stretch gap-2 rounded-lg border border-border p-2"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3 rounded-md px-2 py-1.5">
                {frame.url ? (
                  <button
                    type="button"
                    className="bg-muted/40 group relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                    onClick={() => setPreview({ url: frame.url, title })}
                    aria-label={messages.forms.enlargeImageAria}
                    title={messages.forms.enlargeImage}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={frame.url}
                      alt=""
                      className="size-full object-cover transition group-hover:opacity-90"
                    />
                  </button>
                ) : (
                  <div className="bg-muted/40 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed">
                    <span className="text-muted-foreground text-[10px]">
                      {index + 1}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-md text-left transition-colors hover:bg-muted/50"
                  onClick={() => onOpen(index)}
                >
                  <p className="truncate text-sm font-medium">{title}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {castCount > 0 || place
                      ? messages.forms.frameListContextHint(castCount, place)
                      : messages.forms.frameListNoContext}
                  </p>
                </button>
              </div>
              <div className="flex shrink-0 flex-col justify-center gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={index === 0}
                  onClick={() => onMoveUp(index)}
                  aria-label={messages.forms.moveUp}
                >
                  <ArrowUp className="size-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={index === frames.length - 1}
                  onClick={() => onMoveDown(index)}
                  aria-label={messages.forms.moveDown}
                >
                  <ArrowDown className="size-3.5" aria-hidden />
                </Button>
              </div>
              <div className="flex shrink-0 flex-col justify-center gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onOpen(index)}
                  aria-label={messages.forms.editFrame}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => onRemove(index)}
                  aria-label={messages.forms.removeSegment}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        onClick={onAdd}
      >
        <Plus className="size-4" aria-hidden />
        {messages.forms.addSegment}
      </Button>
      <ImageLightboxDialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        imageUrl={preview?.url ?? null}
        title={preview?.title}
      />
    </div>
  );
}
