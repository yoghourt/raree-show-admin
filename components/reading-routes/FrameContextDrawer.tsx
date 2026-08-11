"use client";

import { ChevronLeft, ChevronRight, Loader2Icon, Sparkles, UploadIcon } from "lucide-react";
import * as React from "react";

import { generateFrameDraft } from "@/app/actions/generateFrameDraft";
import { EntityMultiFuzzyPicker } from "@/components/entity/EntityMultiFuzzyPicker";
import { FuzzyEntityCombobox } from "@/components/entity/FuzzyEntityCombobox";
import type { EntityOption } from "@/components/entity/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { messages } from "@/lib/locale";
import {
  appearancesFromCharacterTsids,
  contextAtFrameIndex,
  ensureContextForFrame,
  upsertContextById,
} from "@/lib/scene-context/frame-context-edit";
import type { SceneContextRecord } from "@/lib/scene-context/types";
import type { Character, Location, ReadingFrame } from "@/lib/types";

type FrameContextDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workId: string;
  readingRouteTsid: string;
  routeTitle: string;
  chapter_number: number;
  chapter_title: string | null;
  frameIndex: number | null;
  frames: ReadingFrame[];
  contexts: SceneContextRecord[];
  characters: Character[];
  locations: Location[];
  onChange: (next: {
    frames: ReadingFrame[];
    contexts: SceneContextRecord[];
  }) => void;
  onUploadingChange?: (uploading: boolean) => void;
  onNavigate: (index: number) => void;
};

export function FrameContextDrawer({
  open,
  onOpenChange,
  workId,
  readingRouteTsid,
  routeTitle,
  chapter_number,
  chapter_title,
  frameIndex,
  frames,
  contexts,
  characters,
  locations,
  onChange,
  onUploadingChange,
  onNavigate,
}: FrameContextDrawerProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [generateElapsedSec, setGenerateElapsedSec] = React.useState(0);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  const index = frameIndex ?? -1;
  const frame = index >= 0 ? frames[index] : undefined;

  React.useEffect(() => {
    if (!open || index < 0 || !frame) return;
    if (contextAtFrameIndex(contexts, index)) return;
    const nextContexts = ensureContextForFrame({
      workId,
      readingRouteTsid,
      frameIndex: index,
      frame,
      contexts,
      routeTitle,
      chapter_number,
      chapter_title,
    });
    onChange({ frames, contexts: nextContexts });
    // Only when opening a frame that lacks Context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  React.useEffect(() => {
    if (!generating) {
      setGenerateElapsedSec(0);
      return;
    }
    setGenerateElapsedSec(0);
    const started = Date.now();
    const id = window.setInterval(() => {
      setGenerateElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [generating]);

  const context = index >= 0 ? contextAtFrameIndex(contexts, index) : undefined;

  const characterOptions: EntityOption[] = characters.map((c) => ({
    id: c.tsid,
    label: c.name,
    secondary: c.house || undefined,
  }));
  const locationOptions: EntityOption[] = locations.map((l) => ({
    id: l.tsid,
    label: l.name,
    secondary: l.region || undefined,
  }));

  const selectedCharacterIds =
    context?.characterAppearanceContext
      .map((a) => a.archiveTsid)
      .filter((id): id is string => Boolean(id)) ?? [];

  const patchFrame = (patch: Partial<ReadingFrame>) => {
    if (index < 0 || !frame) return;
    const nextFrames = [...frames];
    nextFrames[index] = { ...frame, ...patch };
    let nextContexts = contexts;
    const ctx = contextAtFrameIndex(contexts, index);
    if (ctx && patch.caption !== undefined) {
      const caption = patch.caption.trim();
      nextContexts = upsertContextById(contexts, {
        ...ctx,
        narrativeMoment: {
          ...ctx.narrativeMoment,
          title: caption || ctx.narrativeMoment.title,
          summary: caption || null,
        },
        readerFacingNarrativeContext: {
          ...ctx.readerFacingNarrativeContext,
          beatSummary: caption || ctx.readerFacingNarrativeContext.beatSummary,
        },
        updatedAt: new Date().toISOString(),
      });
    }
    onChange({ frames: nextFrames, contexts: nextContexts });
  };

  const patchContext = (next: SceneContextRecord) => {
    onChange({
      frames,
      contexts: upsertContextById(contexts, {
        ...next,
        updatedAt: new Date().toISOString(),
      }),
    });
  };

  const handleCharactersChange = (tsids: string[]) => {
    if (!context) return;
    patchContext({
      ...context,
      characterAppearanceContext: appearancesFromCharacterTsids(
        tsids,
        characters.map((c) => ({ tsid: c.tsid, name: c.name }))
      ),
    });
  };

  const handleLocationSelect = (opt: EntityOption) => {
    if (!context) return;
    patchContext({
      ...context,
      locationContext: {
        environmentFromExpression:
          context.locationContext.environmentFromExpression || opt.label,
        archiveTsid: opt.id,
        archiveName: opt.label,
      },
    });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || index < 0) return;
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadToCloudinary(file);
      patchFrame({ url });
    } catch (e) {
      console.error("[FrameContextDrawer] upload failed", e);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!frame || index < 0) return;
    const caption = frame.caption.trim();
    if (!caption || generating || uploading) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await generateFrameDraft({
        caption,
        routeTitle: routeTitle.trim() || undefined,
      });
      if (!result.ok) {
        setGenerateError(result.message);
        return;
      }
      patchFrame({ url: result.url });
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const busy = uploading || generating;
  const captionEmpty = !frame?.caption.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="lg"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4">
          <SheetTitle>
            {index >= 0
              ? messages.forms.frameDrawerTitle(index + 1)
              : messages.forms.editFrame}
          </SheetTitle>
          <SheetDescription>
            {messages.forms.frameDrawerHint}
          </SheetDescription>
          {frames.length > 1 && index >= 0 ? (
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={index <= 0}
                onClick={() => onNavigate(index - 1)}
              >
                <ChevronLeft className="size-4" aria-hidden />
                {messages.forms.prevFrame}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={index >= frames.length - 1}
                onClick={() => onNavigate(index + 1)}
              >
                {messages.forms.nextFrame}
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </SheetHeader>

        {frame && index >= 0 ? (
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="frame-caption">
                {messages.domain.frameNarrative}
              </Label>
              <Textarea
                id="frame-caption"
                rows={4}
                placeholder={messages.forms.captionPlaceholder}
                value={frame.caption}
                onChange={(e) => patchFrame({ caption: e.target.value })}
              />
              <div className="flex flex-wrap items-center gap-2">
                {captionEmpty ? (
                  <p className="text-destructive text-sm">
                    {messages.forms.captionRequired}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  disabled={captionEmpty || busy}
                  onClick={() => void handleGenerate()}
                >
                  {generating ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" aria-hidden />
                      {messages.forms.generating}
                      <span className="tabular-nums text-muted-foreground">
                        {messages.forms.generatingElapsed(generateElapsedSec)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" aria-hidden />
                      {messages.forms.aiGenerateFrame}
                    </>
                  )}
                </Button>
              </div>
              {generateError ? (
                <p className="text-destructive text-sm" role="alert">
                  {generateError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>{messages.forms.frameImageLabel}</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="bg-muted/30 flex min-h-[8rem] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-dashed p-2">
                  {busy ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2Icon className="size-4 animate-spin" />
                      {uploading
                        ? messages.common.uploading
                        : messages.forms.generating}
                    </div>
                  ) : frame.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={frame.url}
                      alt=""
                      className="max-h-48 w-full object-contain"
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      {messages.forms.noImageYet}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => void handleFile(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon className="size-4" aria-hidden />
                    {frame.url
                      ? messages.forms.replaceImage
                      : messages.forms.addImage}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label>{messages.forms.frameCastLabel}</Label>
              <p className="text-muted-foreground text-xs">
                {messages.forms.frameCastHint}
              </p>
              <EntityMultiFuzzyPicker
                options={characterOptions}
                value={selectedCharacterIds}
                onChange={handleCharactersChange}
                disabled={!context}
              />
            </div>

            <div className="space-y-2">
              <Label>{messages.forms.frameLocationLabel}</Label>
              <p className="text-muted-foreground text-xs">
                {messages.forms.frameLocationHint}
              </p>
              <FuzzyEntityCombobox
                value={context?.locationContext.archiveTsid ?? ""}
                options={locationOptions}
                disabled={!context || locationOptions.length === 0}
                placeholder={messages.common.search}
                onSelect={handleLocationSelect}
              />
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
