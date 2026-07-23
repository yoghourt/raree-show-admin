import {
  isEmptyFrameUrl,
  isMissingPortraitUrl,
  leanShowcaseProfile,
  type LeanShowcaseProfile,
} from "@/lib/production/completion-profile";
import type {
  DerivedProductionTask,
  ProductionChecklistItem,
  ProductionPlanProjection,
} from "@/lib/production/types";
import type { Character, ReadingRoute, Work } from "@/lib/types";

export type ProductionAssetsInput = {
  work: Work;
  characters: Character[];
  routes: ReadingRoute[];
  profile?: LeanShowcaseProfile;
};

/**
 * Derive Production Plan projection + Tasks from Assets only (CPP-INV-01/02).
 * No durable Task store. Progress is recomputed from Asset predicates.
 */
export function deriveProductionPlan(
  input: ProductionAssetsInput
): ProductionPlanProjection {
  const profile = input.profile ?? leanShowcaseProfile;
  const { work, characters, routes } = input;
  const tasks: DerivedProductionTask[] = [];
  const workBase = `/works/${encodeURIComponent(work.id)}`;

  // Cover
  const coverOk = Boolean(work.coverImage?.trim());
  if (profile.requireCover && !coverOk) {
    tasks.push({
      id: `missing_cover:${work.id}`,
      kind: "missing_cover",
      label: "补齐作品封面",
      href: `${workBase}/edit`,
    });
  }

  // Portraits
  let portraitsComplete = 0;
  for (const c of characters) {
    if (!isMissingPortraitUrl(c.portraitUrl)) {
      portraitsComplete += 1;
      continue;
    }
    if (profile.requirePortraitForEachCharacter) {
      tasks.push({
        id: `portrait:${c.tsid}`,
        kind: "complete_character_portrait",
        label: `补齐角色肖像：${c.name || c.tsid}`,
        href: `${workBase}/characters/${encodeURIComponent(c.tsid)}/edit`,
        target: { characterTsid: c.tsid },
      });
    }
  }

  // Reading routes / frames
  if (routes.length === 0) {
    tasks.push({
      id: `missing_routes:${work.id}`,
      kind: "missing_reading_route",
      label: "至少创建一条故事（Reading Route）",
      href: `${workBase}/reading-routes/new`,
    });
  }

  let framesNeedingUrl = 0;
  let framesWithCaption = 0;
  for (const route of routes) {
    const frames = route.story_images_v2 ?? [];
    frames.forEach((frame, frameIndex) => {
      const caption = frame.caption?.trim() ?? "";
      if (!caption) return;
      framesWithCaption += 1;
      if (
        profile.requireUrlWhenCaptionPresent &&
        isEmptyFrameUrl(frame.url)
      ) {
        framesNeedingUrl += 1;
        tasks.push({
          id: `frame:${route.tsid}:${frameIndex}`,
          kind: "fill_frame_url",
          label: `补齐画面图：${route.title || route.tsid} · 帧 ${frameIndex + 1}`,
          href: `${workBase}/production#batch-frames`,
          target: {
            routeTsid: route.tsid,
            frameIndex,
            caption: frame.caption,
          },
        });
      }
    });
  }

  const framesComplete = framesWithCaption - framesNeedingUrl;

  const checklist: ProductionChecklistItem[] = [
    {
      id: "cover",
      label: "作品封面",
      done: coverOk,
      total: 1,
      complete: coverOk ? 1 : 0,
    },
    {
      id: "portraits",
      label: "角色肖像",
      done:
        characters.length === 0
          ? true
          : portraitsComplete === characters.length,
      total: Math.max(characters.length, 0),
      complete: portraitsComplete,
    },
    {
      id: "routes",
      label: "故事（Reading Route）",
      done: routes.length > 0,
      total: 1,
      complete: routes.length > 0 ? 1 : 0,
    },
    {
      id: "frame_urls",
      label: "有文案的画面帧已配图",
      done: framesNeedingUrl === 0,
      total: framesWithCaption,
      complete: Math.max(framesComplete, 0),
    },
  ];

  const weighted = checklist.filter((c) => c.total > 0 || c.id === "routes" || c.id === "cover");
  const progressPercent =
    weighted.length === 0
      ? 100
      : Math.round(
          (weighted.reduce((sum, c) => sum + (c.done ? 1 : 0), 0) /
            weighted.length) *
            100
        );

  return {
    workId: work.id,
    profileId: profile.id,
    checklist,
    progressPercent,
    tasks,
  };
}
