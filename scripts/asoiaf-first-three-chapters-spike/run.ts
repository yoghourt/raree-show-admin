/**
 * Product Runtime Validation — ASOIAF First Three Chapters Visualization Spike
 *
 * Uses production Discovery propose + Capability image.generate only.
 * Does NOT create a special pipeline / Planner / Cloud / Expression redesign.
 *
 *   DISCOVERY_PROPOSE_MODE=live npx tsx scripts/asoiaf-first-three-chapters-spike/run.ts
 *
 * Optional:
 *   SPIKE_CHAPTERS=ch-prologue,ch-bran-1
 *   SPIKE_SKIP_RENDER=1   # propose only
 *   SPIKE_SEED=42
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { imageGenerate } from "../../lib/ai/capability/imageGenerate";
import { ensureUndiciProxyDispatcherForGemini } from "../../lib/ai/undici-proxy-bootstrap";
import { proposeCandidateTypes } from "../../lib/discovery/propose-service";
import type {
  DiscoveryCandidate,
  SceneCandidateFields,
} from "../../lib/discovery/propose-types";
import {
  parseRendererExpression,
  type RendererExpression,
  type VisualIntent,
} from "../../lib/discovery/visual-contract";
import {
  buildFrameDraftPrompt,
  buildFrameNegativePrompt,
} from "../../lib/prompts/frame-draft";
import {
  CHAPTERS,
  SCENE_FEEDBACK,
  WORK_ID,
  WORK_TITLE,
  buildChapterNarrative,
  type ChapterSpec,
} from "./chapters";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

type SceneRow = {
  chapterId: string;
  chapterTitle: string;
  chapterNumber: number;
  sceneIndex: number;
  candidateId: string;
  title: string;
  summary: string;
  visualIntent: VisualIntent | null;
  rendererExpression: RendererExpression;
  prompt: string;
  promptLen: number;
  ok: boolean;
  blank: boolean;
  bytes: number;
  ms: number;
  usedFallback: boolean;
  error?: string;
  pngRel?: string;
  mean?: number;
  std?: number;
};

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function assessBlank(
  pngPath: string
): Promise<{ blank: boolean; mean: number; std: number }> {
  try {
    const sharp = (await import("sharp")).default;
    const buf = readFileSync(pngPath);
    const { data } = await sharp(buf)
      .resize(64, 64, { fit: "inside" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (const v of data) sum += v;
    const mean = sum / data.length;
    let vsum = 0;
    for (const v of data) vsum += (v - mean) ** 2;
    const std = Math.sqrt(vsum / data.length);
    return {
      blank: std <= 14 && mean >= 245,
      mean: Number(mean.toFixed(1)),
      std: Number(std.toFixed(1)),
    };
  } catch {
    return { blank: false, mean: -1, std: -1 };
  }
}

function asSceneFields(c: DiscoveryCandidate): SceneCandidateFields | null {
  if (c.candidateType !== "scene") return null;
  return c.fields as SceneCandidateFields;
}

function selectedChapters(): ChapterSpec[] {
  const raw = process.env.SPIKE_CHAPTERS?.trim();
  if (!raw) return CHAPTERS;
  const ids = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return CHAPTERS.filter((c) => ids.has(c.id));
}

async function proposeChapter(chapter: ChapterSpec): Promise<{
  characters: DiscoveryCandidate[];
  locations: DiscoveryCandidate[];
  stories: DiscoveryCandidate[];
  scenes: DiscoveryCandidate[];
  errors: { candidateType: string; code: string; message: string }[];
}> {
  const narrative = buildChapterNarrative(chapter);
  const { candidates, errors } = await proposeCandidateTypes({
    workId: WORK_ID,
    workTitle: `${WORK_TITLE} / ${chapter.chapterTitle}`,
    narrative,
    feedback: SCENE_FEEDBACK,
  });
  return {
    characters: candidates.filter((c) => c.candidateType === "character"),
    locations: candidates.filter((c) => c.candidateType === "location"),
    stories: candidates.filter((c) => c.candidateType === "story"),
    scenes: candidates.filter((c) => c.candidateType === "scene"),
    errors,
  };
}

async function renderScene(input: {
  chapter: ChapterSpec;
  scene: DiscoveryCandidate;
  sceneIndex: number;
  seed: number;
  outDir: string;
}): Promise<SceneRow> {
  const fields = asSceneFields(input.scene);
  if (!fields) {
    return {
      chapterId: input.chapter.id,
      chapterTitle: input.chapter.chapterTitle,
      chapterNumber: input.chapter.chapterNumber,
      sceneIndex: input.sceneIndex,
      candidateId: input.scene.candidateId,
      title: input.scene.displayName,
      summary: input.scene.summary,
      visualIntent: null,
      rendererExpression: {
        environment: "",
        characters: [],
        action: "",
        composition: "",
      },
      prompt: "",
      promptLen: 0,
      ok: false,
      blank: false,
      bytes: 0,
      ms: 0,
      usedFallback: false,
      error: "not a scene candidate",
    };
  }

  const parsed = parseRendererExpression(fields.rendererExpression);
  if (!parsed.ok) {
    return {
      chapterId: input.chapter.id,
      chapterTitle: input.chapter.chapterTitle,
      chapterNumber: input.chapter.chapterNumber,
      sceneIndex: input.sceneIndex,
      candidateId: input.scene.candidateId,
      title: fields.title || input.scene.displayName,
      summary: fields.summary || input.scene.summary,
      visualIntent: fields.visualIntent ?? null,
      rendererExpression: {
        environment: "",
        characters: [],
        action: "",
        composition: "",
      },
      prompt: "",
      promptLen: 0,
      ok: false,
      blank: false,
      bytes: 0,
      ms: 0,
      usedFallback: false,
      error: `invalid Expression: ${parsed.errors.join("; ")}`,
    };
  }

  const expression = parsed.value;
  const caption = (fields.summary || fields.title || " ").trim() || " ";
  const prompt = buildFrameDraftPrompt({
    caption,
    routeTitle: input.chapter.chapterTitle,
    rendererExpression: expression,
  });

  const slug = `${String(input.sceneIndex).padStart(2, "0")}-${(
    fields.title || input.scene.displayName
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)}`;
  const pngName = `${slug}.png`;
  const pngPath = path.join(input.outDir, pngName);
  const pngRel = path.relative(SPIKE_DIR, pngPath);

  const started = Date.now();
  try {
    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: "scene_frame",
      clientJobId: `asoiaf-spike-${input.chapter.id}-${input.sceneIndex}`,
      prompt,
      negativePrompt: buildFrameNegativePrompt(caption),
      seed: input.seed,
      size: { width: 512, height: 512 },
    });
    await writeFile(pngPath, candidate.bytes);
    const blank = await assessBlank(pngPath);
    return {
      chapterId: input.chapter.id,
      chapterTitle: input.chapter.chapterTitle,
      chapterNumber: input.chapter.chapterNumber,
      sceneIndex: input.sceneIndex,
      candidateId: input.scene.candidateId,
      title: fields.title || input.scene.displayName,
      summary: fields.summary || input.scene.summary,
      visualIntent: fields.visualIntent ?? null,
      rendererExpression: expression,
      prompt,
      promptLen: prompt.length,
      ok: !blank.blank,
      blank: blank.blank,
      bytes: candidate.bytes.length,
      ms: Date.now() - started,
      usedFallback: candidate.usedFallback,
      pngRel,
      mean: blank.mean,
      std: blank.std,
      error: blank.blank ? "blank canvas" : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      chapterId: input.chapter.id,
      chapterTitle: input.chapter.chapterTitle,
      chapterNumber: input.chapter.chapterNumber,
      sceneIndex: input.sceneIndex,
      candidateId: input.scene.candidateId,
      title: fields.title || input.scene.displayName,
      summary: fields.summary || input.scene.summary,
      visualIntent: fields.visualIntent ?? null,
      rendererExpression: expression,
      prompt,
      promptLen: prompt.length,
      ok: false,
      blank: /blank/i.test(message),
      bytes: 0,
      ms: Date.now() - started,
      usedFallback: false,
      error: message.slice(0, 500),
    };
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  ensureUndiciProxyDispatcherForGemini();
  process.env.DISCOVERY_PROPOSE_MODE = "live";
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512";

  const seed = Number(process.env.SPIKE_SEED?.trim() || "42") || 42;
  const skipRender = process.env.SPIKE_SKIP_RENDER?.trim() === "1";
  const chapters = selectedChapters();

  await mkdir(RESULTS_DIR, { recursive: true });

  console.info("[asoiaf-3ch] start", {
    workTitle: WORK_TITLE,
    chapters: chapters.map((c) => c.id),
    model: process.env.IMAGE_CREATOR_ACCEPT_MODEL,
    provider: process.env.IMAGE_CREATOR_ACCEPT_PROVIDER,
    discoveryModel: process.env.DISCOVERY_TEXT_MODEL,
    seed,
    skipRender,
  });

  const proposeBundle: Record<string, unknown> = {};
  const rows: SceneRow[] = [];

  for (const chapter of chapters) {
    console.info(`[asoiaf-3ch] propose ${chapter.id}…`);
    const proposed = await proposeChapter(chapter);
    proposeBundle[chapter.id] = {
      label: chapter.label,
      chapterTitle: chapter.chapterTitle,
      counts: {
        character: proposed.characters.length,
        location: proposed.locations.length,
        story: proposed.stories.length,
        scene: proposed.scenes.length,
      },
      errors: proposed.errors,
      characters: proposed.characters.map((c) => ({
        id: c.candidateId,
        name: c.displayName,
        summary: c.summary,
      })),
      locations: proposed.locations.map((c) => ({
        id: c.candidateId,
        name: c.displayName,
        summary: c.summary,
      })),
      stories: proposed.stories.map((c) => ({
        id: c.candidateId,
        title: c.displayName,
        summary: c.summary,
      })),
      scenes: proposed.scenes.map((c) => {
        const f = asSceneFields(c)!;
        return {
          id: c.candidateId,
          title: f.title || c.displayName,
          summary: f.summary || c.summary,
          chapter_number: f.chapter_number,
          chapter_title: f.chapter_title,
          visualIntent: f.visualIntent ?? null,
          rendererExpression: f.rendererExpression,
        };
      }),
    };

    console.info(`[asoiaf-3ch] ${chapter.id} scenes=${proposed.scenes.length}`, {
      errors: proposed.errors,
    });

    if (skipRender) continue;

    const outDir = path.join(RESULTS_DIR, chapter.id);
    await mkdir(outDir, { recursive: true });

    let idx = 0;
    for (const scene of proposed.scenes) {
      console.info(
        `[asoiaf-3ch] render ${chapter.id} #${idx} ${scene.displayName}`
      );
      const row = await renderScene({
        chapter,
        scene,
        sceneIndex: idx,
        seed,
        outDir,
      });
      rows.push(row);
      console.info(`[asoiaf-3ch] done`, {
        title: row.title,
        ok: row.ok,
        blank: row.blank,
        ms: row.ms,
        bytes: row.bytes,
        error: row.error?.slice(0, 120),
      });
      idx += 1;
    }
  }

  await writeFile(
    path.join(RESULTS_DIR, "propose.json"),
    JSON.stringify(proposeBundle, null, 2),
    "utf8"
  );
  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(
      {
        workId: WORK_ID,
        workTitle: WORK_TITLE,
        seed,
        size: 512,
        provider: process.env.IMAGE_CREATOR_ACCEPT_PROVIDER,
        model: process.env.IMAGE_CREATOR_ACCEPT_MODEL,
        discoveryModel: process.env.DISCOVERY_TEXT_MODEL,
        generatedAt: new Date().toISOString(),
        runtimePath:
          "proposeCandidateTypes → buildFrameDraftPrompt(Expression) → imageGenerate(creator/scene_frame)",
        skipRender,
        sceneCount: rows.length,
        successCount: rows.filter((r) => r.ok).length,
        blankCount: rows.filter((r) => r.blank).length,
        rows,
      },
      null,
      2
    ),
    "utf8"
  );

  console.info("[asoiaf-3ch] complete", {
    scenes: rows.length,
    ok: rows.filter((r) => r.ok).length,
    blank: rows.filter((r) => r.blank).length,
    results: RESULTS_DIR,
  });
}

main().catch((err) => {
  console.error("[asoiaf-3ch] fatal", err);
  process.exit(1);
});
