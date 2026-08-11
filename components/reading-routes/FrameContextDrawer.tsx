"use client";

import { ChevronLeft, ChevronRight, Loader2Icon, Sparkles, UploadIcon } from "lucide-react";
import * as React from "react";

import { enqueueFrameDraftJobs } from "@/app/actions/enqueueFrameDraftJobs";
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
import { ImageLightboxDialog } from "@/components/ui/ImageLightboxDialog";
import { formatGenerateJobErrorForOperator } from "@/lib/ai/image/operatorErrorCopy";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  listGenerateJobsForWork,
  parseHostedImageResultReference,
} from "@/lib/generate-jobs";
import { messages } from "@/lib/locale";
import {
  appearancesFromCharacterTsids,
  contextAtFrameIndex,
  ensureContextForFrame,
  upsertContextById,
} from "@/lib/scene-context/frame-context-edit";
import type { SceneContextRecord } from "@/lib/scene-context/types";
import { patchSceneFrameUrls } from "@/lib/scenes";
import type { Character, Location, ReadingFrame } from "@/lib/types";

const JOB_POLL_MS = 2500;

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

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => resolve(), ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

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
  /** Per-frame polls — switching frames must NOT cancel other frames. */
  const generateAbortByFrameRef = React.useRef<Map<number, AbortController>>(
    new Map()
  );
  const framesRef = React.useRef(frames);
  const contextsRef = React.useRef(contexts);
  const [uploading, setUploading] = React.useState(false);
  const [generatingFrames, setGeneratingFrames] = React.useState<Set<number>>(
    () => new Set()
  );
  const [generatePhaseByFrame, setGeneratePhaseByFrame] = React.useState<
    Record<number, "queued" | "running">
  >({});
  const [generateElapsedByFrame, setGenerateElapsedByFrame] = React.useState<
    Record<number, number>
  >({});
  const [generateErrorByFrame, setGenerateErrorByFrame] = React.useState<
    Record<number, string>
  >({});
  const [persistHintByFrame, setPersistHintByFrame] = React.useState<
    Record<number, string>
  >({});
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  const index = frameIndex ?? -1;
  const frame = index >= 0 ? frames[index] : undefined;
  const scenePersisted =
    Boolean(readingRouteTsid.trim()) && readingRouteTsid !== "new";
  const generatingThisFrame = index >= 0 && generatingFrames.has(index);
  const generatePhase =
    index >= 0 ? (generatePhaseByFrame[index] ?? null) : null;
  const generateElapsedSec =
    index >= 0 ? (generateElapsedByFrame[index] ?? 0) : 0;
  const generateError =
    index >= 0 ? (generateErrorByFrame[index] ?? null) : null;
  const persistHint =
    index >= 0 ? (persistHintByFrame[index] ?? null) : null;

  framesRef.current = frames;
  contextsRef.current = contexts;

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
    if (generatingFrames.size === 0) return;
    const startedAt = new Map<number, number>();
    for (const frameIdx of generatingFrames) {
      startedAt.set(frameIdx, Date.now());
    }
    const id = window.setInterval(() => {
      const next: Record<number, number> = {};
      const now = Date.now();
      for (const [frameIdx, started] of startedAt) {
        next[frameIdx] = Math.floor((now - started) / 1000);
      }
      setGenerateElapsedByFrame((prev) => ({ ...prev, ...next }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [generatingFrames]);

  const abortAllGenerates = React.useCallback(() => {
    for (const abort of generateAbortByFrameRef.current.values()) {
      abort.abort();
    }
    generateAbortByFrameRef.current.clear();
    setGeneratingFrames(new Set());
    setGeneratePhaseByFrame({});
  }, []);

  React.useEffect(() => {
    if (open) return;
    abortAllGenerates();
  }, [open, abortAllGenerates]);

  React.useEffect(() => {
    return () => {
      abortAllGenerates();
    };
  }, [abortAllGenerates]);

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

  /** Always write to the frame index captured at enqueue time. */
  const patchFrameAt = (
    frameIdx: number,
    patch: Partial<ReadingFrame>
  ) => {
    if (frameIdx < 0) return;
    const currentFrames = framesRef.current;
    const currentContexts = contextsRef.current;
    const current = currentFrames[frameIdx];
    if (!current) return;
    const nextFrames = [...currentFrames];
    nextFrames[frameIdx] = { ...current, ...patch };
    let nextContexts = currentContexts;
    const ctx = contextAtFrameIndex(currentContexts, frameIdx);
    if (ctx && patch.caption !== undefined) {
      const caption = patch.caption.trim();
      nextContexts = upsertContextById(currentContexts, {
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

  const patchFrame = (patch: Partial<ReadingFrame>) => {
    if (index < 0) return;
    patchFrameAt(index, patch);
  };

  const patchContext = (next: SceneContextRecord) => {
    onChange({
      frames: framesRef.current,
      contexts: upsertContextById(contextsRef.current, {
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

  /** Write frame URL to story_images_v2 so leaving without「保存」won't lose the image. */
  const persistFrameUrl = async (
    frameIdx: number,
    url: string
  ): Promise<boolean> => {
    if (!scenePersisted) return false;
    try {
      await patchSceneFrameUrls(workId, readingRouteTsid, [
        { frameIndex: frameIdx, url },
      ]);
      setPersistHintByFrame((prev) => ({
        ...prev,
        [frameIdx]: messages.forms.frameImagePersisted,
      }));
      return true;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setGenerateErrorByFrame((prev) => ({
        ...prev,
        [frameIdx]: messages.forms.frameImagePersistFail(detail),
      }));
      return false;
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || index < 0) return;
    const targetIndex = index;
    setUploading(true);
    onUploadingChange?.(true);
    setPersistHintByFrame((prev) => {
      const next = { ...prev };
      delete next[targetIndex];
      return next;
    });
    try {
      const url = await uploadToCloudinary(file);
      patchFrameAt(targetIndex, { url });
      if (scenePersisted) {
        await persistFrameUrl(targetIndex, url);
      }
    } catch (e) {
      console.error("[FrameContextDrawer] upload failed", e);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /**
   * Same path as production batch「缺画面排队」: enqueue → Local Worker → poll.
   * Multiple frames may generate in parallel; each poll writes back to its own index.
   */
  const handleGenerate = async () => {
    if (!frame || index < 0) return;
    const targetIndex = index;
    const caption = frame.caption.trim();
    if (!caption || uploading || generatingFrames.has(targetIndex)) return;

    if (!scenePersisted) {
      setGenerateErrorByFrame((prev) => ({
        ...prev,
        [targetIndex]: messages.forms.frameGenerateSaveFirst,
      }));
      return;
    }

    // Only cancel a prior poll for *this* frame (re-click), not other frames.
    generateAbortByFrameRef.current.get(targetIndex)?.abort();
    const abort = new AbortController();
    generateAbortByFrameRef.current.set(targetIndex, abort);

    setGeneratingFrames((prev) => new Set(prev).add(targetIndex));
    setGeneratePhaseByFrame((prev) => ({ ...prev, [targetIndex]: "queued" }));
    setGenerateElapsedByFrame((prev) => ({ ...prev, [targetIndex]: 0 }));
    setGenerateErrorByFrame((prev) => {
      const next = { ...prev };
      delete next[targetIndex];
      return next;
    });
    setPersistHintByFrame((prev) => {
      const next = { ...prev };
      delete next[targetIndex];
      return next;
    });

    const setFrameError = (message: string) => {
      setGenerateErrorByFrame((prev) => ({ ...prev, [targetIndex]: message }));
    };

    try {
      const result = await enqueueFrameDraftJobs({
        workId,
        frames: [
          {
            sceneTsid: readingRouteTsid,
            frameIndex: targetIndex,
            caption,
            routeTitle: routeTitle.trim() || undefined,
          },
        ],
      });
      if (!result.ok) {
        setFrameError(
          result.message || messages.forms.frameGenerateEnqueueFail
        );
        return;
      }
      const jobId = result.jobs[0]?.id;
      if (!jobId) {
        setFrameError(messages.forms.frameGenerateEnqueueFail);
        return;
      }

      while (!abort.signal.aborted) {
        const jobs = await listGenerateJobsForWork(workId, { limit: 40 });
        const job = jobs.find((j) => j.id === jobId);
        if (!job) {
          setFrameError(messages.forms.frameGenerateNoResult);
          return;
        }
        if (job.status === "running") {
          setGeneratePhaseByFrame((prev) => ({
            ...prev,
            [targetIndex]: "running",
          }));
        }
        if (job.status === "succeeded") {
          const hosted = parseHostedImageResultReference(job.result_reference);
          if (!hosted?.url) {
            setFrameError(messages.forms.frameGenerateNoResult);
            return;
          }
          // Candidate → Asset on this surface: same write as production Accept.
          patchFrameAt(targetIndex, { url: hosted.url });
          await persistFrameUrl(targetIndex, hosted.url);
          return;
        }
        if (job.status === "failed") {
          setFrameError(
            formatGenerateJobErrorForOperator(job.error) ??
              job.error ??
              "本地出图失败"
          );
          return;
        }
        if (job.status === "cancelled") {
          setFrameError(messages.forms.frameGenerateCancelled);
          return;
        }
        await sleep(JOB_POLL_MS, abort.signal);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFrameError(e instanceof Error ? e.message : String(e));
    } finally {
      if (generateAbortByFrameRef.current.get(targetIndex) === abort) {
        generateAbortByFrameRef.current.delete(targetIndex);
      }
      setGeneratingFrames((prev) => {
        const next = new Set(prev);
        next.delete(targetIndex);
        return next;
      });
      setGeneratePhaseByFrame((prev) => {
        const next = { ...prev };
        delete next[targetIndex];
        return next;
      });
    }
  };

  const busy = uploading || generatingThisFrame;
  const captionEmpty = !frame?.caption.trim();
  const otherFramesGenerating =
    generatingFrames.size > 0 && !generatingThisFrame;

  return (
    <>
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
            {otherFramesGenerating ? (
              <p className="text-muted-foreground pt-1 text-xs">
                另有画面正在本地出图，完成后会自动写回对应帧。
              </p>
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
                    {generatingThisFrame ? (
                      <>
                        <Loader2Icon
                          className="size-4 animate-spin"
                          aria-hidden
                        />
                        {generatePhase === "queued"
                          ? messages.forms.generatingQueued
                          : messages.forms.generating}
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
                {persistHint && !generateError ? (
                  <p className="text-muted-foreground text-sm">{persistHint}</p>
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
                          : generatePhase === "queued"
                            ? messages.forms.generatingQueued
                            : messages.forms.generating}
                      </div>
                    ) : frame.url ? (
                      <button
                        type="button"
                        className="group relative max-h-48 w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        onClick={() => setLightboxOpen(true)}
                        aria-label={messages.forms.enlargeImageAria}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={frame.url}
                          alt=""
                          className="max-h-48 w-full object-contain transition group-hover:opacity-90"
                        />
                        <span className="absolute inset-x-0 bottom-0 rounded-b bg-black/55 py-0.5 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                          {messages.forms.enlargeImage}
                        </span>
                      </button>
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
      <ImageLightboxDialog
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={frame?.url?.trim() ? frame.url : null}
        title={
          index >= 0
            ? messages.forms.frameListItem(
                index + 1,
                frame?.caption.trim() || messages.forms.frameUntitled
              )
            : messages.forms.imagePreviewTitle
        }
      />
    </>
  );
}
