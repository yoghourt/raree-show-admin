"use client";

import { ChevronLeft, ChevronRight, Loader2Icon, Sparkles, UploadIcon } from "lucide-react";
import * as React from "react";

import { enqueueFrameDraftJobs } from "@/app/actions/enqueueFrameDraftJobs";
import { proposeFrameExpression } from "@/app/actions/proposeFrameExpression";
import { EntityMultiFuzzyPicker } from "@/components/entity/EntityMultiFuzzyPicker";
import { FuzzyEntityCombobox } from "@/components/entity/FuzzyEntityCombobox";
import type { EntityOption } from "@/components/entity/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  parseRendererExpression,
  type RendererExpression,
} from "@/lib/discovery/visual-contract";
import {
  listGenerateJobsForWork,
  parseHostedImageResultReference,
} from "@/lib/generate-jobs";
import { messages } from "@/lib/locale";
import {
  appearancesFromCharacterTsids,
  contextAtFrameIndex,
  enrichContextArchiveRefsFromWork,
  ensureContextForFrame,
  syncFrameContextAppearanceFromExpression,
  upsertContextById,
} from "@/lib/scene-context/frame-context-edit";
import type { SceneContextRecord } from "@/lib/scene-context/types";
import {
  getFrameProvenance,
  patchFrameProvenanceExpression,
  patchSceneFrameUrls,
} from "@/lib/scenes";
import type { Character, Location, ReadingFrame } from "@/lib/types";

function charactersToLines(
  characters: RendererExpression["characters"]
): string {
  return characters
    .map((c) => `${c.role}: ${c.visual}`)
    .join("\n");
}

function linesToCharacters(
  text: string
): RendererExpression["characters"] {
  const out: RendererExpression["characters"] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) {
      throw new Error(`角色行须为「role: visual」格式：${trimmed}`);
    }
    const role = trimmed.slice(0, colon).trim();
    const visual = trimmed.slice(colon + 1).trim();
    if (!role || !visual) {
      throw new Error(`角色行须为「role: visual」格式：${trimmed}`);
    }
    out.push({ role, visual });
  }
  return out;
}

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
  /** After Expression save — parent may refresh route badges. */
  onExpressionSaved?: () => void;
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
  onExpressionSaved,
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
  const [exprEnvironment, setExprEnvironment] = React.useState("");
  const [exprAction, setExprAction] = React.useState("");
  const [exprComposition, setExprComposition] = React.useState("");
  const [exprLighting, setExprLighting] = React.useState("");
  const [exprCharactersText, setExprCharactersText] = React.useState("");
  const [exprAtmosphere, setExprAtmosphere] = React.useState("");
  const [exprThreat, setExprThreat] = React.useState("");
  const [exprEmphasis, setExprEmphasis] = React.useState("");
  const [exprStyleHints, setExprStyleHints] = React.useState("");
  const [exprLoading, setExprLoading] = React.useState(false);
  const [exprSaving, setExprSaving] = React.useState(false);
  const [exprProposing, setExprProposing] = React.useState(false);
  const [exprError, setExprError] = React.useState<string | null>(null);
  const [exprHint, setExprHint] = React.useState<string | null>(null);

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

  // Hydrate missing archiveTsid from Work Archive names (associate Rule-7 debt).
  React.useEffect(() => {
    if (!open || index < 0) return;
    const ctx = contextAtFrameIndex(contexts, index);
    if (!ctx) return;
    const enriched = enrichContextArchiveRefsFromWork(ctx, {
      characters: characters.map((c) => ({ tsid: c.tsid, name: c.name })),
      locations: locations.map((l) => ({ tsid: l.tsid, name: l.name })),
    });
    if (!enriched) return;
    onChange({
      frames,
      contexts: upsertContextById(contexts, enriched),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, characters, locations]);

  // Load frame_provenance_v1 Expression for the open frame.
  React.useEffect(() => {
    if (!open || index < 0 || !scenePersisted) {
      setExprEnvironment("");
      setExprAction("");
      setExprComposition("");
      setExprLighting("");
      setExprAtmosphere("");
      setExprThreat("");
      setExprEmphasis("");
      setExprStyleHints("");
      setExprCharactersText("");
      setExprError(null);
      setExprHint(null);
      return;
    }
    let cancelled = false;
    setExprLoading(true);
    setExprError(null);
    setExprHint(null);
    void getFrameProvenance(workId, readingRouteTsid)
      .then((entries) => {
        if (cancelled) return;
        const entry = entries.find((e) => e.frameIndex === index);
        const expr = entry?.rendererExpression;
        setExprEnvironment(expr?.environment ?? "");
        setExprAction(expr?.action ?? "");
        setExprComposition(expr?.composition ?? "");
        setExprLighting(expr?.lighting ?? "");
        setExprAtmosphere(expr?.atmosphere ?? "");
        setExprThreat(expr?.threatPerception ?? "");
        setExprEmphasis(expr?.visualEmphasis ?? "");
        setExprStyleHints(expr?.styleHints ?? "");
        setExprCharactersText(
          expr?.characters?.length ? charactersToLines(expr.characters) : ""
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setExprError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setExprLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, index, workId, readingRouteTsid, scenePersisted]);

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

  const saveExpression = async (
    expression: RendererExpression | null
  ): Promise<boolean> => {
    if (index < 0 || !scenePersisted) return false;
    setExprSaving(true);
    setExprError(null);
    setExprHint(null);
    try {
      await patchFrameProvenanceExpression(
        workId,
        readingRouteTsid,
        index,
        expression
      );
      if (expression) {
        const currentFrame = framesRef.current[index];
        if (currentFrame) {
          onChange({
            frames: framesRef.current,
            contexts: syncFrameContextAppearanceFromExpression({
              workId,
              readingRouteTsid,
              frameIndex: index,
              frame: currentFrame,
              contexts: contextsRef.current,
              routeTitle,
              chapter_number,
              chapter_title,
              expression,
              archiveCharacters: characters.map((c) => ({
                tsid: c.tsid,
                name: c.name,
              })),
            }),
          });
        }
        setExprHint("Expression 已保存，出场人物已对齐");
      } else {
        setExprHint("Expression 已清除");
      }
      onExpressionSaved?.();
      return true;
    } catch (e) {
      setExprError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setExprSaving(false);
    }
  };

  const handleSaveExpression = () => {
    if (index < 0) return;
    let characters: RendererExpression["characters"];
    try {
      characters = linesToCharacters(exprCharactersText);
    } catch (e) {
      setExprError(e instanceof Error ? e.message : String(e));
      return;
    }
    const draft: RendererExpression = {
      environment: exprEnvironment.trim(),
      action: exprAction.trim(),
      composition: exprComposition.trim(),
      characters,
    };
    const lighting = exprLighting.trim();
    if (lighting) draft.lighting = lighting;
    const atmosphere = exprAtmosphere.trim();
    if (atmosphere) draft.atmosphere = atmosphere;
    const threat = exprThreat.trim();
    if (threat) draft.threatPerception = threat;
    const emphasis = exprEmphasis.trim();
    if (emphasis) draft.visualEmphasis = emphasis;
    const styleHints = exprStyleHints.trim();
    if (styleHints) draft.styleHints = styleHints;
    const parsed = parseRendererExpression(draft);
    if (!parsed.ok) {
      setExprError(parsed.errors.join("; "));
      return;
    }
    void saveExpression(parsed.value);
  };

  const applyExpressionToForm = (expr: RendererExpression) => {
    setExprEnvironment(expr.environment);
    setExprAction(expr.action);
    setExprComposition(expr.composition);
    setExprLighting(expr.lighting ?? "");
    setExprAtmosphere(expr.atmosphere ?? "");
    setExprThreat(expr.threatPerception ?? "");
    setExprEmphasis(expr.visualEmphasis ?? "");
    setExprStyleHints(expr.styleHints ?? "");
    setExprCharactersText(
      expr.characters.length ? charactersToLines(expr.characters) : ""
    );
  };

  const handleProposeExpression = async () => {
    if (index < 0 || !frame) return;
    const caption = frame.caption.trim();
    if (!caption) {
      setExprError("无法提案：画面说明为空");
      return;
    }
    let currentExpression: string | undefined;
    if (exprEnvironment.trim() || exprAction.trim()) {
      try {
        const characters = linesToCharacters(exprCharactersText);
        const draft: RendererExpression = {
          environment: exprEnvironment.trim() || "unspecified place",
          action: exprAction.trim() || "empty scene",
          composition: exprComposition.trim() || "wide view",
          characters,
        };
        if (exprLighting.trim()) draft.lighting = exprLighting.trim();
        if (exprAtmosphere.trim()) draft.atmosphere = exprAtmosphere.trim();
        if (exprThreat.trim()) draft.threatPerception = exprThreat.trim();
        if (exprEmphasis.trim()) draft.visualEmphasis = exprEmphasis.trim();
        if (exprStyleHints.trim()) draft.styleHints = exprStyleHints.trim();
        currentExpression = JSON.stringify(draft);
      } catch {
        currentExpression = undefined;
      }
    }
    setExprProposing(true);
    setExprError(null);
    setExprHint(null);
    try {
      const result = await proposeFrameExpression({
        workId,
        caption,
        currentExpression,
        routeTitle,
      });
      if (!result.ok) {
        setExprError(result.message);
        return;
      }
      applyExpressionToForm(result.rendererExpression);
      setExprHint("已填入 AI Expression（未保存；请核对后点保存）");
    } catch (e) {
      setExprError(e instanceof Error ? e.message : String(e));
    } finally {
      setExprProposing(false);
    }
  };

  const handleClearExpression = () => {
    void saveExpression(null).then((ok) => {
      if (!ok) return;
      setExprEnvironment("");
      setExprAction("");
      setExprComposition("");
      setExprLighting("");
      setExprAtmosphere("");
      setExprThreat("");
      setExprEmphasis("");
      setExprStyleHints("");
      setExprCharactersText("");
    });
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
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Expression（生成用）</Label>
                  {exprLoading ? (
                    <span className="text-muted-foreground text-[10px]">
                      加载中…
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-[10px] leading-snug">
                  写入 frame_provenance_v1；可 AI 按画面说明重提后再保存。
                  手加帧可在此补写后再进制作排队。
                  {!scenePersisted
                    ? " 请先保存故事后再编辑 Expression。"
                    : null}
                </p>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="frame-expr-environment"
                    className="text-[10px] text-zinc-600"
                  >
                    environment *
                  </Label>
                  <Textarea
                    id="frame-expr-environment"
                    rows={2}
                    className="min-h-0 text-xs"
                    disabled={!scenePersisted || exprLoading || exprSaving}
                    value={exprEnvironment}
                    onChange={(e) => setExprEnvironment(e.target.value)}
                    placeholder="地点与环境"
                  />
                  <Label
                    htmlFor="frame-expr-action"
                    className="text-[10px] text-zinc-600"
                  >
                    action *
                  </Label>
                  <Textarea
                    id="frame-expr-action"
                    rows={2}
                    className="min-h-0 text-xs"
                    disabled={!scenePersisted || exprLoading || exprSaving}
                    value={exprAction}
                    onChange={(e) => setExprAction(e.target.value)}
                    placeholder="本帧瞬间动作"
                  />
                  <Label
                    htmlFor="frame-expr-composition"
                    className="text-[10px] text-zinc-600"
                  >
                    composition *
                  </Label>
                  <Input
                    id="frame-expr-composition"
                    className="h-7 text-xs"
                    disabled={!scenePersisted || exprLoading || exprSaving}
                    value={exprComposition}
                    onChange={(e) => setExprComposition(e.target.value)}
                    placeholder="构图"
                  />
                  <Label
                    htmlFor="frame-expr-lighting"
                    className="text-[10px] text-zinc-600"
                  >
                    lighting（可选）
                  </Label>
                  <Input
                    id="frame-expr-lighting"
                    className="h-7 text-xs"
                    disabled={!scenePersisted || exprLoading || exprSaving}
                    value={exprLighting}
                    onChange={(e) => setExprLighting(e.target.value)}
                    placeholder="光线"
                  />
                  <Label
                    htmlFor="frame-expr-characters"
                    className="text-[10px] text-zinc-600"
                  >
                    characters（每行 role: visual）
                  </Label>
                  <Textarea
                    id="frame-expr-characters"
                    rows={3}
                    className="min-h-0 font-mono text-xs"
                    disabled={!scenePersisted || exprLoading || exprSaving}
                    value={exprCharactersText}
                    onChange={(e) => setExprCharactersText(e.target.value)}
                    placeholder={"Liu Bei: yellow headcloth\nZhang Fei: ..."}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    disabled={
                      !scenePersisted ||
                      exprLoading ||
                      exprSaving ||
                      exprProposing ||
                      !frame?.caption.trim()
                    }
                    onClick={() => void handleProposeExpression()}
                  >
                    {exprProposing ? "提案中…" : "AI 提案 Expression"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={
                      !scenePersisted ||
                      exprLoading ||
                      exprSaving ||
                      exprProposing
                    }
                    onClick={handleSaveExpression}
                  >
                    {exprSaving ? "保存中…" : "保存 Expression"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-zinc-500"
                    disabled={
                      !scenePersisted ||
                      exprLoading ||
                      exprSaving ||
                      exprProposing
                    }
                    onClick={handleClearExpression}
                  >
                    清除
                  </Button>
                </div>
                {exprError ? (
                  <p className="text-destructive text-[11px]" role="alert">
                    {exprError}
                  </p>
                ) : null}
                {exprHint && !exprError ? (
                  <p className="text-muted-foreground text-[11px]">{exprHint}</p>
                ) : null}
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
