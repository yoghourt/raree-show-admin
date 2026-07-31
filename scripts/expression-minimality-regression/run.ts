/**
 * Regression: Expression Minimality Rule — before (full) vs after (minimal).
 * Fixed Expressions shaped to new Discovery rules; same Local model/seed/512².
 *
 *   npx tsx scripts/expression-minimality-regression/run.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { createImageGenerationProvider } from "../../lib/ai/image/factory";
import {
  parseRendererExpression,
  rendererExpressionToPrompt,
  type RendererExpression,
} from "../../lib/discovery/visual-contract";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

type Arm = "before" | "after";

type CaseFixture = {
  id: string;
  label: string;
  before: unknown;
  after: unknown;
};

type Fixtures = {
  model: string;
  seed: number;
  size: number;
  cases: CaseFixture[];
};

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

async function render(
  provider: ReturnType<typeof createImageGenerationProvider>,
  expression: RendererExpression,
  seed: number,
  size: number,
  outPng: string
): Promise<{ ok: boolean; bytes: number; ms: number; error?: string }> {
  const prompt = rendererExpressionToPrompt(expression);
  const started = Date.now();
  try {
    const result = await provider.generate({
      prompt,
      seed,
      size: { width: size, height: size },
      assetSlot: "scene_frame",
      negativePrompt:
        "blank, blank canvas, solid white, text, watermark, collage, split screen",
    });
    await writeFile(outPng, result.bytes);
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
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512";

  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as Fixtures;

  const model =
    process.env.SPIKE_LOCAL_MODEL?.trim() ||
    process.env.IMAGE_CREATOR_LOCALAI_MODEL?.trim() ||
    fixtures.model;
  const seed = Number(process.env.SPIKE_SEED ?? fixtures.seed) || 42;
  const size = Number(process.env.SPIKE_SIZE ?? fixtures.size) || 512;
  const base = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "");

  const provider = createImageGenerationProvider(
    "localai",
    {
      acceptModelId: model,
      localBaseUrl: base,
      localAiApiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
      skipNetwork: false,
    },
    "accept"
  );

  await mkdir(RESULTS_DIR, { recursive: true });
  const rows: Array<Record<string, unknown>> = [];

  for (const c of fixtures.cases) {
    const caseDir = path.join(RESULTS_DIR, c.id);
    await mkdir(caseDir, { recursive: true });

    for (const arm of ["before", "after"] as Arm[]) {
      const parsed = parseRendererExpression(c[arm]);
      if (!parsed.ok) throw new Error(`${c.id}/${arm}: ${parsed.errors.join("; ")}`);
      const expression = parsed.value;
      const prompt = rendererExpressionToPrompt(expression);
      const outPng = path.join(caseDir, `${arm}.png`);

      console.log(`[render] ${c.id}/${arm} promptLen=${prompt.length}`);
      const rendered = await render(provider, expression, seed, size, outPng);
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
        arm,
        promptLen: prompt.length,
        ok: rendered.ok && !blank,
        blank,
        bytes: rendered.bytes,
        ms: rendered.ms,
        mean,
        std,
        error: rendered.error,
        hasLighting: Boolean(expression.lighting),
        hasStyleHints: Boolean(expression.styleHints),
      });
      console.log(
        `[done] ${c.id}/${arm} ok=${rendered.ok} blank=${blank} bytes=${rendered.bytes}`
      );
    }
  }

  const summaryPath = path.join(RESULTS_DIR, "summary.json");
  await writeFile(
    summaryPath,
    JSON.stringify({ model, seed, size, generatedAt: new Date().toISOString(), rows }, null, 2)
  );

  const blankBefore = rows.filter((r) => r.arm === "before" && r.blank).length;
  const blankAfter = rows.filter((r) => r.arm === "after" && r.blank).length;
  console.log(
    `[summary] blank before=${blankBefore}/3 after=${blankAfter}/3 → ${summaryPath}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
