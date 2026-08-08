"use client";

/**
 * Pre-write preview for a Discovery story — same fields as ReadingRouteForm
 * so operators can see/edit exactly what will be written.
 */

import * as React from "react";

import { EntityMultiFuzzyPicker } from "@/components/entity/EntityMultiFuzzyPicker";
import { FuzzyEntityCombobox } from "@/components/entity/FuzzyEntityCombobox";
import type { EntityOption } from "@/components/entity/types";
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
  locationId: string;
  characterIds: string[];
  frames: Array<{ sourceReviewId: string; title: string; summary: string }>;
};

function stagingToValues(
  staging: AcceptedStoryUnitStaging,
  frames: AcceptedSceneCandidateStaging[],
  defaultChapter: number
): StoryWritePreviewValues {
  // L2-A/L2-B: Route membership is non-authoritative — do not backfill from related*Refs.
  return {
    title: staging.title,
    chapter_number:
      typeof staging.chapter_number === "number" && staging.chapter_number >= 1
        ? staging.chapter_number
        : defaultChapter,
    chapter_title: staging.chapter_title ?? "",
    summary: staging.summary ?? "",
    locationId: staging.locationId?.trim() || "",
    characterIds: staging.characterIds ?? [],
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
  const relatedCharacterRefs = (staging.relatedCharacterRefs ?? []).map(
    (ref) => ({
      ...ref,
      matchedTsid: values.characterIds.includes(ref.matchedTsid ?? "")
        ? ref.matchedTsid
        : ref.matchedTsid,
    })
  );

  return {
    ...staging,
    title: values.title.trim(),
    summary: values.summary.trim(),
    chapter_number: values.chapter_number,
    chapter_title: values.chapter_title.trim() || null,
    locationId: values.locationId.trim() || null,
    characterIds: values.characterIds,
    relatedCharacterRefs,
    relatedLocationRefs: staging.relatedLocationRefs,
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

  const locationOptions = React.useMemo((): EntityOption[] => {
    const list = [...locations];
    for (const ref of staging.relatedLocationRefs ?? []) {
      if (
        ref.matchedTsid &&
        !list.some((l) => l.tsid === ref.matchedTsid)
      ) {
        list.push({
          id: "",
          workId: staging.workId,
          tsid: ref.matchedTsid,
          name: ref.name,
          region: ref.region ?? "",
          description: ref.description ?? "",
          createdAt: "",
          map_focus_x: null,
          map_focus_y: null,
        });
      }
    }
    return list.map((l) => ({
      id: l.tsid,
      label: l.name,
      aliases: [l.tsid],
    }));
  }, [locations, staging]);

  const characterOptions = React.useMemo((): EntityOption[] => {
    const list = [...characters];
    for (const ref of staging.relatedCharacterRefs ?? []) {
      if (
        ref.matchedTsid &&
        !list.some((c) => c.tsid === ref.matchedTsid)
      ) {
        list.push({
          id: "",
          workId: staging.workId,
          tsid: ref.matchedTsid,
          name: ref.name,
          house: ref.house ?? "",
          description: ref.description ?? "",
          signatureQuote: ref.signatureQuote ?? null,
          portraitUrl: "",
          createdAt: "",
        });
      }
    }
    // Pending create names (no tsid yet) — show as disabled hint chips via note below
    return list.map((c) => ({
      id: c.tsid,
      label: c.name,
      aliases: [c.tsid, c.house].filter(Boolean) as string[],
    }));
  }, [characters, staging]);

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

      <details className="rounded-lg border border-dashed p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {messages.rollout.entitySectionDeferred}
        </summary>
        <div className="mt-3 space-y-3">
      <div className="space-y-2">
        <Label>地点（可选 · 非权威）</Label>
        <FuzzyEntityCombobox
          value={values.locationId}
          options={locationOptions}
          placeholder={messages.common.search}
          disabled={busy || locationOptions.length === 0}
          onSelect={(opt) => patch({ locationId: opt.id })}
        />
      </div>

      <div className="space-y-2">
        <Label>角色（可选 · 非权威）</Label>
        <EntityMultiFuzzyPicker
          value={values.characterIds}
          options={characterOptions}
          placeholder={messages.forms.searchCharacters}
          disabled={busy || characterOptions.length === 0}
          onChange={(ids) => patch({ characterIds: ids })}
        />
      </div>
        </div>
      </details>

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
