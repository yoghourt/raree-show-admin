/**
 * Spike — Rich Expression Projection Validation (experiment only).
 *
 * Paths:
 *   A: current Local-shaped Expression → production transport → Cloud
 *   B: rich Expression → rich join (no Local caps) → Cloud
 *   C: rich Expression → Local projection (adapt + production transport) → LocalAI
 *
 *   npx tsx scripts/rich-expression-projection-spike/run.ts
 *
 * Does NOT modify Discovery rules, ADR, SPEC, or production runtime.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { createImageGenerationProvider } from "../../lib/ai/image/factory";
import { adaptSceneExpressionForLocalCapability } from "../../lib/discovery/expression-capability-rules";
import {
  parseRendererExpression,
  rendererExpressionToPrompt,
  type RendererExpression,
} from "../../lib/discovery/visual-contract";
import { buildFrameNegativePrompt } from "../../lib/prompts/frame-draft";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

type RichExpression = RendererExpression & {
  atmosphere?: string;
  emotionalTone?: string;
  threatPerception?: string;
  visualEmphasis?: string;
};

type CaseFixture = {
  id: string;
  label: string;
  scenePurpose: string;
  relationship: string;
  threat: string;
  currentExpression: unknown;
  richExpression: RichExpression;
};

type Fixtures = {
  seed: number;
  cloudModel: string;
  localaiModel: string;
  cases: CaseFixture[];
};

type PathId = "A_current_cloud" | "B_rich_cloud" | "C_rich_localai";

/** Spike-only join — not production transport. No Cloud-specific tuning. */
function richExpressionToPrompt(re: RichExpression): string {
  const cast = (re.characters ?? [])
    .map((c) => `${c.role}: ${c.visual}`)
    .join("; ");
  const parts = [
    cast && `Characters: ${cast}.`,
    re.action?.trim() && `Action: ${re.action.trim()}.`,
    re.environment?.trim() && `Environment: ${re.environment.trim()}.`,
    re.composition?.trim() && `Composition: ${re.composition.trim()}.`,
    re.lighting?.trim() && `Lighting: ${re.lighting.trim()}.`,
    re.styleHints?.trim() && `Style: ${re.styleHints.trim()}.`,
    re.atmosphere?.trim() && `Atmosphere: ${re.atmosphere.trim()}.`,
    re.emotionalTone?.trim() && `Emotional tone: ${re.emotionalTone.trim()}.`,
    re.threatPerception?.trim() &&
      `Threat: ${re.threatPerception.trim()}.`,
    re.visualEmphasis?.trim() &&
      `Visual emphasis: ${re.visualEmphasis.trim()}.`,
    "Single narrative still. No text, no watermark.",
  ].filter(Boolean);
  return parts.join(" ");
}

async function assessBlank(pngPath: string): Promise<{
  blank: boolean;
  mean: number;
  std: number;
}> {
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
}

async function renderOnce(options: {
  provider: ReturnType<typeof createImageGenerationProvider>;
  prompt: string;
  negativePrompt: string;
  seed: number;
  size: number;
  outPng: string;
}): Promise<{ ok: boolean; bytes: number; ms: number; error?: string }> {
  const started = Date.now();
  try {
    const result = await options.provider.generate({
      prompt: options.prompt,
      seed: options.seed,
      size: { width: options.size, height: options.size },
      assetSlot: "scene_frame",
      negativePrompt: options.negativePrompt,
    });
    await writeFile(options.outPng, result.bytes);
    return { ok: true, bytes: result.bytes.length, ms: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      bytes: 0,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as Fixtures;

  const seed = Number(process.env.SPIKE_SEED ?? fixtures.seed) || 42;
  const only = process.env.SPIKE_ONLY?.trim(); // e.g. A,B or wall-scouting
  const skipLocal = process.env.SPIKE_SKIP_LOCALAI === "1";

  const siliconKey =
    process.env.SILICONFLOW_API_KEY?.trim() ||
    process.env.IMAGE_CREATOR_SILICONFLOW_KEY?.trim() ||
    process.env.IMAGE_SPIKE_SILICONFLOW_KEY?.trim();
  if (!siliconKey) {
    throw new Error("Need SILICONFLOW_API_KEY (or IMAGE_SPIKE_SILICONFLOW_KEY) for Cloud paths");
  }

  const localBase = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "");

  const cloud = createImageGenerationProvider(
    "siliconflow",
    {
      acceptModelId: fixtures.cloudModel,
      siliconflowKey: siliconKey,
      skipNetwork: false,
    },
    "accept"
  );

  const localai = createImageGenerationProvider(
    "localai",
    {
      acceptModelId:
        process.env.SPIKE_LOCAL_MODEL?.trim() || fixtures.localaiModel,
      localBaseUrl: localBase,
      localAiApiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
      skipNetwork: false,
    },
    "accept"
  );

  await mkdir(RESULTS_DIR, { recursive: true });
  const rows: Array<Record<string, unknown>> = [];
  const expressionCompare: Array<Record<string, unknown>> = [];

  for (const c of fixtures.cases) {
    if (only && !only.split(",").some((t) => t === c.id || t === "all")) {
      if (!["A", "B", "C"].some((p) => only.split(",").includes(p))) {
        // allow path filter without case filter
        if (!only.match(/^[ABC,\s]+$/i)) continue;
      }
    }

    const caseDir = path.join(RESULTS_DIR, c.id);
    await mkdir(caseDir, { recursive: true });

    const currentParsed = parseRendererExpression(c.currentExpression);
    if (!currentParsed.ok) {
      throw new Error(`${c.id}/current: ${currentParsed.errors.join("; ")}`);
    }
    const current = currentParsed.value;

    const richCore: RendererExpression = {
      environment: c.richExpression.environment,
      characters: c.richExpression.characters,
      action: c.richExpression.action,
      composition: c.richExpression.composition,
      ...(c.richExpression.lighting
        ? { lighting: c.richExpression.lighting }
        : {}),
      ...(c.richExpression.styleHints
        ? { styleHints: c.richExpression.styleHints }
        : {}),
    };
    const richParsed = parseRendererExpression(richCore);
    if (!richParsed.ok) {
      throw new Error(`${c.id}/rich: ${richParsed.errors.join("; ")}`);
    }

    const promptA = rendererExpressionToPrompt(current);
    const promptB = richExpressionToPrompt(c.richExpression);
    const projected = adaptSceneExpressionForLocalCapability(richParsed.value);
    const promptC = rendererExpressionToPrompt(projected);

    expressionCompare.push({
      id: c.id,
      label: c.label,
      scenePurpose: c.scenePurpose,
      currentExpression: current,
      richExpression: c.richExpression,
      projectedForLocal: projected,
      promptA_len: promptA.length,
      promptB_len: promptB.length,
      promptC_len: promptC.length,
      promptA,
      promptB,
      promptC,
      lostVsRich: {
        lighting: Boolean(c.richExpression.lighting),
        styleHints: Boolean(c.richExpression.styleHints),
        atmosphere: Boolean(c.richExpression.atmosphere),
        emotionalTone: Boolean(c.richExpression.emotionalTone),
        threatPerception: Boolean(c.richExpression.threatPerception),
        visualEmphasis: Boolean(c.richExpression.visualEmphasis),
        note: "Current path drops narrative cues + lighting/style via Local rules/transport; Path C re-applies adapt+LOCAL caps on rich core fields only",
      },
    });

    await writeFile(
      path.join(caseDir, "prompts.json"),
      JSON.stringify(
        {
          A: promptA,
          B: promptB,
          C: promptC,
          currentExpression: current,
          richExpression: c.richExpression,
          projectedForLocal: projected,
        },
        null,
        2
      )
    );

    const paths: Array<{
      id: PathId;
      provider: typeof cloud;
      prompt: string;
      size: number;
      enabled: boolean;
    }> = [
      {
        id: "A_current_cloud",
        provider: cloud,
        prompt: promptA,
        size: 1024,
        enabled: !only || /A/i.test(only) || only.includes(c.id),
      },
      {
        id: "B_rich_cloud",
        provider: cloud,
        prompt: promptB,
        size: 1024,
        enabled: !only || /B/i.test(only) || only.includes(c.id),
      },
      {
        id: "C_rich_localai",
        provider: localai,
        prompt: promptC,
        size: 512,
        enabled:
          !skipLocal &&
          (!only || /C/i.test(only) || only.includes(c.id)),
      },
    ];

    // If only is case id, enable all paths for that case
    if (only && fixtures.cases.some((x) => x.id === only)) {
      for (const p of paths) {
        p.enabled = c.id === only && (p.id !== "C_rich_localai" || !skipLocal);
      }
    }

    for (const p of paths) {
      if (!p.enabled) continue;
      const outPng = path.join(caseDir, `${p.id}.png`);
      const castCount =
        p.id === "A_current_cloud"
          ? current.characters.length
          : richParsed.value.characters.length;
      const negative = buildFrameNegativePrompt(undefined, { castCount });

      console.log(
        `[render] ${c.id}/${p.id} promptLen=${p.prompt.length} size=${p.size}`
      );
      const rendered = await renderOnce({
        provider: p.provider,
        prompt: p.prompt,
        negativePrompt: negative,
        seed,
        size: p.size,
        outPng,
      });

      let blank = false;
      let mean = -1;
      let std = -1;
      if (rendered.ok) {
        const a = await assessBlank(outPng);
        blank = a.blank;
        mean = a.mean;
        std = a.std;
      }

      rows.push({
        caseId: c.id,
        path: p.id,
        promptLen: p.prompt.length,
        size: p.size,
        ok: rendered.ok && !blank,
        blank,
        bytes: rendered.bytes,
        ms: rendered.ms,
        mean,
        std,
        error: rendered.error,
        outPng: rendered.ok ? outPng : null,
      });
      console.log(
        `[done] ${c.id}/${p.id} ok=${rendered.ok} blank=${blank} ms=${rendered.ms} err=${rendered.error ?? "-"}`
      );
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    seed,
    cloudModel: fixtures.cloudModel,
    localaiModel: fixtures.localaiModel,
    expressionCompare,
    rows,
  };
  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );
  console.log(`[summary] → ${path.join(RESULTS_DIR, "summary.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
