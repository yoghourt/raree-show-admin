"use client";

/**
 * Pre-write preview for a Discovery story — same fields as ReadingRouteForm
 * so operators can see/edit exactly what will be written.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AcceptedSceneCandidateStaging,
  AcceptedStoryUnitStaging,
} from "@/lib/discovery/review-types";
import { messages } from "@/lib/locale";
import { rolloutUi } from "@/lib/rollout/ui-copy";
import {
  aggregateStoryRelatedRefs,
  formatStoryRelatedAggregateLine,
} from "@/lib/scene-context/aggregate-story-refs";
import type { Character, Location } from "@/lib/types";

export type StoryWritePreviewValues = {
  title: string;
  chapter_number: number;
  chapter_title: string;
  summary: string;
  frames: Array<{ sourceReviewId: string; title: string; summary: string }>;
};

function stagingToValues(
  staging: AcceptedStoryUnitStaging,
  frames: AcceptedSceneCandidateStaging[],
  defaultChapter: number
): StoryWritePreviewValues {
  return {
    title: staging.title,
    chapter_number:
      typeof staging.chapter_number === "number" && staging.chapter_number >= 1
        ? staging.chapter_number
        : defaultChapter,
    chapter_title: staging.chapter_title ?? "",
    summary: staging.summary ?? "",
    frames: frames.map((f) => ({
      sourceReviewId: f.sourceReviewId,
      title: f.title,
      summary: f.summary ?? "",
    })),
  };
}

function valuesToStaging(
  staging: AcceptedStoryUnitStaging,
  values: StoryWritePreviewValues
): AcceptedStoryUnitStaging {
  // L3-C: Route membership columns dropped — never stage cast/place ownership.
  return {
    ...staging,
    title: values.title.trim(),
    summary: values.summary.trim(),
    chapter_number: values.chapter_number,
    chapter_title: values.chapter_title.trim() || null,
    relatedCharacterRefs: [],
    relatedLocationRefs: [],
    characterIds: [],
    locationId: null,
  };
}

export function StoryWritePreviewCard({
  staging,
  frames,
  characters,
  locations,
  defaultChapterNumber,
  busy,
  onChange,
  onFrameChange,
  onWrite,
  onDismiss,
}: {
  staging: AcceptedStoryUnitStaging;
  frames: AcceptedSceneCandidateStaging[];
  characters: Character[];
  locations: Location[];
  defaultChapterNumber: number;
  busy: boolean;
  onChange: (next: AcceptedStoryUnitStaging) => void;
  onFrameChange: (
    sourceReviewId: string,
    patch: { title: string; summary: string }
  ) => void;
  onWrite: (next: AcceptedStoryUnitStaging) => Promise<void>;
  onDismiss: () => void;
}) {
  const [values, setValues] = React.useState(() =>
    stagingToValues(staging, frames, defaultChapterNumber)
  );

  React.useEffect(() => {
    setValues(stagingToValues(staging, frames, defaultChapterNumber));
  }, [staging, frames, defaultChapterNumber]);

  const frameRelatedLine = React.useMemo(() => {
    const aggregate = aggregateStoryRelatedRefs({
      sceneStagings: frames,
      archive: {
        characters: characters.map((c) => ({ name: c.name, tsid: c.tsid })),
        locations: locations.map((l) => ({ name: l.name, tsid: l.tsid })),
      },
    });
    return formatStoryRelatedAggregateLine(aggregate);
  }, [frames, characters, locations]);

  const patch = (partial: Partial<StoryWritePreviewValues>) => {
    const next = { ...values, ...partial };
    setValues(next);
    onChange(valuesToStaging(staging, next));
  };

  return (
    <div className="space-y-5 rounded-xl border border-zinc-200 p-4">
      <p className="text-muted-foreground text-xs">
        {rolloutUi.writePreviewHint}
      </p>

      <div className="space-y-1 rounded-lg border border-dashed px-3 py-2">
        <p className="text-xs font-medium">
          {rolloutUi.storyRelatedFromFrames}
        </p>
        <p className="text-muted-foreground text-xs">
          {rolloutUi.routeMembershipDemotedHint}
        </p>
        <p className="text-muted-foreground text-xs">
          {frameRelatedLine ?? rolloutUi.storyRelatedFromFramesEmpty}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`title-${staging.sourceReviewId}`}>标题</Label>
        <Input
          id={`title-${staging.sourceReviewId}`}
          value={values.title}
          disabled={busy}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`chapter-number-${staging.sourceReviewId}`}>
            章节序号
          </Label>
          <Input
            id={`chapter-number-${staging.sourceReviewId}`}
            type="number"
            min={1}
            step={1}
            value={values.chapter_number}
            disabled={busy}
            onChange={(e) =>
              patch({
                chapter_number: Number(e.target.value) || 1,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`chapter-title-${staging.sourceReviewId}`}>
            章节标题
          </Label>
          <Input
            id={`chapter-title-${staging.sourceReviewId}`}
            placeholder={messages.forms.chapterTitlePlaceholder}
            value={values.chapter_title}
            disabled={busy}
            onChange={(e) => patch({ chapter_title: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`summary-${staging.sourceReviewId}`}>
          {messages.forms.summaryOptional}
        </Label>
        <Textarea
          id={`summary-${staging.sourceReviewId}`}
          value={values.summary}
          disabled={busy}
          rows={4}
          onChange={(e) => patch({ summary: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>{messages.domain.readingFrame}</Label>
        <p className="text-muted-foreground text-xs">
          画面字段落库为 caption（读者主文）。默认用标题；补充说明可选。故事摘要不会写入
          caption。图片可之后在编辑页补充。
        </p>
        {values.frames.length === 0 ? (
          <p className="text-muted-foreground text-sm">暂无画面页</p>
        ) : (
          <ul className="space-y-3">
            {values.frames.map((frame, index) => (
              <li
                key={frame.sourceReviewId}
                className="space-y-2 rounded-lg border border-dashed p-3"
              >
                <p className="text-xs text-muted-foreground">
                  画面 {index + 1}
                </p>
                <div className="space-y-1">
                  <Label
                    htmlFor={`frame-title-${frame.sourceReviewId}`}
                    className="text-xs"
                  >
                    画面说明（caption）
                  </Label>
                  <Input
                    id={`frame-title-${frame.sourceReviewId}`}
                    value={frame.title}
                    disabled={busy}
                    onChange={(e) => {
                      const title = e.target.value;
                      const next = { title, summary: frame.summary };
                      setValues((prev) => ({
                        ...prev,
                        frames: prev.frames.map((f) =>
                          f.sourceReviewId === frame.sourceReviewId
                            ? { ...f, ...next }
                            : f
                        ),
                      }));
                      onFrameChange(frame.sourceReviewId, next);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={`frame-summary-${frame.sourceReviewId}`}
                    className="text-xs"
                  >
                    补充说明（可选）
                  </Label>
                  <Textarea
                    id={`frame-summary-${frame.sourceReviewId}`}
                    value={frame.summary}
                    disabled={busy}
                    rows={2}
                    placeholder={messages.forms.summaryOptional}
                    onChange={(e) => {
                      const summary = e.target.value;
                      const next = { title: frame.title, summary };
                      setValues((prev) => ({
                        ...prev,
                        frames: prev.frames.map((f) =>
                          f.sourceReviewId === frame.sourceReviewId
                            ? { ...f, ...next }
                            : f
                        ),
                      }));
                      onFrameChange(frame.sourceReviewId, next);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          disabled={busy || !values.title.trim()}
          onClick={() =>
            void onWrite(valuesToStaging(staging, values))
          }
        >
          {rolloutUi.persistStory}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onDismiss}
        >
          {rolloutUi.dismissStaging}
        </Button>
      </div>
    </div>
  );
}
