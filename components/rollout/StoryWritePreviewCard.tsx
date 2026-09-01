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
import { MIN_SCENE_CHAPTER_NUMBER, parseSceneChapterNumber } from "@/lib/discovery/scene-chapter-number";
import { messages } from "@/lib/locale";
import { frameContextArchiveSelectionFromStaging } from "@/lib/rollout/scene-staging-context-edit";
import { rolloutUi } from "@/lib/rollout/ui-copy";
import {
  aggregateStoryRelatedRefs,
  formatStoryRelatedAggregateLine,
} from "@/lib/scene-context/aggregate-story-refs";
import type { Character, Location } from "@/lib/types";

export type FrameWritePatch = {
  title: string;
  summary: string;
  characterTsids: string[];
  locationTsid: string;
  unmatchedCastNames: string[];
  unmatchedLocationLabel: string | null;
};

export type StoryWritePreviewValues = {
  title: string;
  chapter_number: number;
  chapter_title: string;
  summary: string;
  frames: Array<
    {
      sourceReviewId: string;
    } & FrameWritePatch
  >;
};

function archiveFromEntities(
  characters: Character[],
  locations: Location[]
) {
  return {
    characters: characters.map((c) => ({ name: c.name, tsid: c.tsid })),
    locations: locations.map((l) => ({ name: l.name, tsid: l.tsid })),
  };
}

function stagingToValues(
  staging: AcceptedStoryUnitStaging,
  frames: AcceptedSceneCandidateStaging[],
  defaultChapter: number,
  characters: Character[],
  locations: Location[]
): StoryWritePreviewValues {
  const archive = archiveFromEntities(characters, locations);
  return {
    title: staging.title,
    chapter_number:
      typeof staging.chapter_number === "number" &&
      staging.chapter_number >= MIN_SCENE_CHAPTER_NUMBER
        ? staging.chapter_number
        : defaultChapter,
    chapter_title: staging.chapter_title ?? "",
    summary: staging.summary ?? "",
    frames: frames.map((f) => {
      const sel = frameContextArchiveSelectionFromStaging(f, archive);
      return {
        sourceReviewId: f.sourceReviewId,
        title: f.title,
        summary: f.summary ?? "",
        characterTsids: sel.characterTsids,
        locationTsid: sel.locationTsid,
        unmatchedCastNames: sel.unmatchedCastNames,
        unmatchedLocationLabel: sel.unmatchedLocationLabel,
      };
    }),
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

/**
 * Same interaction as FrameContextDrawer cast/location:
 * EntityMultiFuzzyPicker + FuzzyEntityCombobox against Work Archive.
 */
export function FrameContextWriteFields({
  characterTsids,
  locationTsid,
  unmatchedCastNames,
  unmatchedLocationLabel,
  characters,
  locations,
  disabled,
  onChange,
}: {
  characterTsids: string[];
  locationTsid: string;
  unmatchedCastNames?: string[];
  unmatchedLocationLabel?: string | null;
  characters: Character[];
  locations: Location[];
  disabled?: boolean;
  onChange: (next: {
    characterTsids: string[];
    locationTsid: string;
    unmatchedCastNames: string[];
    unmatchedLocationLabel: string | null;
  }) => void;
}) {
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

  const unmatchedCast = (unmatchedCastNames ?? []).filter((n) => n.trim());
  const unmatchedPlace = unmatchedLocationLabel?.trim() || null;

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50/80 px-2.5 py-2.5">
      <div>
        <p className="text-xs font-medium text-zinc-700">
          {rolloutUi.frameContextWillWrite}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {messages.forms.frameCastHint}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{messages.forms.frameCastLabel}</Label>
        <EntityMultiFuzzyPicker
          options={characterOptions}
          value={characterTsids}
          disabled={disabled || characterOptions.length === 0}
          onChange={(nextTsids) =>
            onChange({
              characterTsids: nextTsids,
              locationTsid,
              unmatchedCastNames: [],
              unmatchedLocationLabel: unmatchedPlace,
            })
          }
        />
        {characterOptions.length === 0 ? (
          <p className="text-muted-foreground text-[11px]">
            {messages.forms.noCharacterDataHint}
          </p>
        ) : null}
        {unmatchedCast.length > 0 ? (
          <p className="text-[11px] text-amber-800">
            未匹配作品档案：{unmatchedCast.join("、")}
            。请在上方选择档案角色；改选后将以档案为准。
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{messages.forms.frameLocationLabel}</Label>
        <p className="text-muted-foreground text-[11px]">
          {messages.forms.frameLocationHint}
        </p>
        <FuzzyEntityCombobox
          value={locationTsid}
          options={locationOptions}
          disabled={disabled || locationOptions.length === 0}
          placeholder={messages.common.search}
          onSelect={(opt) =>
            onChange({
              characterTsids,
              locationTsid: opt.id,
              unmatchedCastNames: unmatchedCast,
              unmatchedLocationLabel: null,
            })
          }
        />
        {locationOptions.length === 0 ? (
          <p className="text-muted-foreground text-[11px]">
            {messages.forms.noLocationDataHint}
          </p>
        ) : null}
        {!locationTsid && unmatchedPlace ? (
          <p className="text-[11px] text-amber-800">
            提炼地点线索：{unmatchedPlace}
            。请在上方选择对应档案地点；改选后将以档案为准。
          </p>
        ) : null}
      </div>
    </div>
  );
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
  onFrameChange: (sourceReviewId: string, patch: FrameWritePatch) => void;
  onWrite: (next: AcceptedStoryUnitStaging) => Promise<void>;
  onDismiss: () => void;
}) {
  const [values, setValues] = React.useState(() =>
    stagingToValues(
      staging,
      frames,
      defaultChapterNumber,
      characters,
      locations
    )
  );

  React.useEffect(() => {
    setValues(
      stagingToValues(
        staging,
        frames,
        defaultChapterNumber,
        characters,
        locations
      )
    );
  }, [staging, frames, defaultChapterNumber, characters, locations]);

  const archive = React.useMemo(
    () => archiveFromEntities(characters, locations),
    [characters, locations]
  );

  const frameRelatedLine = React.useMemo(() => {
    const aggregate = aggregateStoryRelatedRefs({
      sceneStagings: frames,
      archive,
    });
    return formatStoryRelatedAggregateLine(aggregate, {
      alreadyExistsLabel: "已有档案",
    });
  }, [frames, archive]);

  const patch = (partial: Partial<StoryWritePreviewValues>) => {
    const next = { ...values, ...partial };
    setValues(next);
    onChange(valuesToStaging(staging, next));
  };

  const patchFrame = (
    sourceReviewId: string,
    partial: Partial<FrameWritePatch>
  ) => {
    const current = values.frames.find(
      (f) => f.sourceReviewId === sourceReviewId
    );
    if (!current) return;
    const nextPatch: FrameWritePatch = {
      title: partial.title ?? current.title,
      summary: partial.summary ?? current.summary,
      characterTsids: partial.characterTsids ?? current.characterTsids,
      locationTsid:
        partial.locationTsid !== undefined
          ? partial.locationTsid
          : current.locationTsid,
      unmatchedCastNames:
        partial.unmatchedCastNames ?? current.unmatchedCastNames,
      unmatchedLocationLabel:
        partial.unmatchedLocationLabel !== undefined
          ? partial.unmatchedLocationLabel
          : current.unmatchedLocationLabel,
    };
    setValues((prev) => ({
      ...prev,
      frames: prev.frames.map((f) =>
        f.sourceReviewId === sourceReviewId ? { ...f, ...nextPatch } : f
      ),
    }));
    onFrameChange(sourceReviewId, nextPatch);
  };

  const flushAndWrite = () => {
    const story = valuesToStaging(staging, values);
    for (const frame of values.frames) {
      onFrameChange(frame.sourceReviewId, {
        title: frame.title,
        summary: frame.summary,
        characterTsids: frame.characterTsids,
        locationTsid: frame.locationTsid,
        unmatchedCastNames: frame.unmatchedCastNames,
        unmatchedLocationLabel: frame.unmatchedLocationLabel,
      });
    }
    void onWrite(story);
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
            min={MIN_SCENE_CHAPTER_NUMBER}
            step={1}
            value={values.chapter_number}
            disabled={busy}
            onChange={(e) => {
              const n = parseSceneChapterNumber(e.target.value);
              if (n === null || n < MIN_SCENE_CHAPTER_NUMBER) return;
              patch({ chapter_number: n });
            }}
          />
          <p className="text-muted-foreground text-xs">
            {messages.forms.chapterNumberHint}
          </p>
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
          caption。出场/地点写入该画面的场景语境（非故事 Route 成员）。图片可之后在编辑页补充。
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
                    onChange={(e) =>
                      patchFrame(frame.sourceReviewId, {
                        title: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      patchFrame(frame.sourceReviewId, {
                        summary: e.target.value,
                      })
                    }
                  />
                </div>
                <FrameContextWriteFields
                  characterTsids={frame.characterTsids}
                  locationTsid={frame.locationTsid}
                  unmatchedCastNames={frame.unmatchedCastNames}
                  unmatchedLocationLabel={frame.unmatchedLocationLabel}
                  characters={characters}
                  locations={locations}
                  disabled={busy}
                  onChange={(next) =>
                    patchFrame(frame.sourceReviewId, next)
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          disabled={busy || !values.title.trim()}
          onClick={flushAndWrite}
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
