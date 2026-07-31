/**
 * Regression: Expression cast consistency — duel / camp / tree.
 *   npx tsx scripts/expression-consistency-regression/run.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { createImageGenerationProvider } from "../../lib/ai/image/factory";
import { findCastConsistencyErrors } from "../../lib/discovery/expression-capability-rules";
import {
  parseRendererExpression,
  rendererExpressionToPrompt,
  type RendererExpression,
} from "../../lib/discovery/visual-contract";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

type CaseFixture = {
  id: string;
  label: string;
  expression: unknown;
};

type Fixtures = {
  model: string;
  seed: number;
  size: number;
  cases: CaseFixture[];
};

async function assessBlank(pngPath: string): Promise<{ blank: boolean }> {
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
  return { blank: std <= 14 && mean >= 245 };
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
    const parsed = parseRendererExpression(c.expression);
    if (!parsed.ok) throw new Error(`${c.id}: ${parsed.errors.join("; ")}`);
    const expression = parsed.value;
    const castErrors = findCastConsistencyErrors(expression);
    if (castErrors.length) {
      throw new Error(`${c.id} cast: ${castErrors.join("; ")}`);
    }

    const prompt = rendererExpressionToPrompt(expression);
    const caseDir = path.join(RESULTS_DIR, c.id);
    await mkdir(caseDir, { recursive: true });
    const outPng = path.join(caseDir, "out.png");

    console.log(`[render] ${c.id} promptLen=${prompt.length}`);
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
      const { blank } = await assessBlank(outPng);
      rows.push({
        caseId: c.id,
        label: c.label,
        ok: !blank,
        blank,
        bytes: result.bytes.length,
        ms: Date.now() - started,
        castConsistent: true,
        promptLen: prompt.length,
      });
      console.log(`[done] ${c.id} blank=${blank} bytes=${result.bytes.length}`);
    } catch (e) {
      rows.push({
        caseId: c.id,
        label: c.label,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        ms: Date.now() - started,
      });
      console.error(`[fail] ${c.id}`, e);
    }
  }

  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify({ model, seed, size, rows }, null, 2)
  );
  console.log(`[summary] wrote ${path.join(RESULTS_DIR, "summary.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
