/**
 * SPIKE-RCS-001 — Local Renderer Capability Comparison
 *
 * Same frozen EVG-001-R3 Local prompt × three LocalAI models.
 * Does not modify Projection, identity ranking, or Renderer Expression.
 * Does not call Cloud fallback. Blank / runtime failure = FAIL for that sample.
 *
 *   npx tsx scripts/renderer-capability-spike/run.ts
 *   SPIKE_RCS_MODELS=z-image,flux2-klein npx tsx scripts/renderer-capability-spike/run.ts
 *   SPIKE_RCS_REGENERATE_BASELINE=1  # optional: re-run SD3.5 instead of copying R3 PNG
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { createImageGenerationProvider } from "../../lib/ai/image/factory";
import { buildFrameNegativePrompt } from "../../lib/prompts/frame-draft";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SPIKE_DIR, "../..");
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

type FrozenCase = {
  id: string;
  workId: string;
  label: string;
  caption: string;
  castCount: number;
  localPrompt: string;
  rendererExpression: unknown;
  baselinePng: string;
};

type FrozenModel = {
  id: string;
  label: string;
  modelId: string;
  reuseR3Baseline: boolean;
};

type FrozenInputs = {
  grant: string;
  seed: number;
  size: number;
  provider: string;
  cases: FrozenCase[];
  models: FrozenModel[];
};

type GenerationStatus = "OK" | "FAIL";

type ArmRow = {
  modelSlot: string;
  modelId: string;
  caseId: string;
  seed: number;
  size: number;
  prompt: string;
  negativePrompt: string;
  generationStatus: GenerationStatus;
  failureReason?: string;
  blank?: boolean;
  bytes?: number;
  ms: number;
  reusedR3Baseline: boolean;
  pngRel?: string;
  requestRel: string;
};

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

async function listLocalAiModels(base: string): Promise<string[]> {
  const res = await fetch(`${base}/v1/models`);
  if (!res.ok) throw new Error(`LocalAI /v1/models HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ id?: string }> };
  return (json.data ?? []).map((d) => d.id).filter((id): id is string => Boolean(id));
}

async function main(): Promise<void> {
  loadEnvLocal();
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_RCS_MAX_EDGE?.trim() || "512";
  process.env.IMAGE_CREATOR_ACCEPT_FALLBACK = "localai";

  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "frozen-inputs.json"), "utf8")
  ) as FrozenInputs;

  const seed = Number(process.env.SPIKE_RCS_SEED?.trim() || fixtures.seed) || 42;
  const size = Number(process.env.SPIKE_RCS_SIZE?.trim() || fixtures.size) || 512;
  const skipExisting = process.env.SPIKE_RCS_SKIP_EXISTING?.trim() === "1";
  const regenerateBaseline =
    process.env.SPIKE_RCS_REGENERATE_BASELINE?.trim() === "1";
  const idFilter = process.env.SPIKE_RCS_MODELS?.trim();
  const models = idFilter
    ? fixtures.models.filter((m) =>
        idFilter
          .split(",")
          .map((s) => s.trim())
          .includes(m.id)
      )
    : fixtures.models;

  const base = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "");

  const catalog = await listLocalAiModels(base);
  console.info("[spike-rcs-001] start", {
    grant: fixtures.grant,
    seed,
    size,
    models: models.map((m) => m.modelId),
    cases: fixtures.cases.map((c) => c.id),
    catalog,
    cloudFallback: false,
  });

  await mkdir(RESULTS_DIR, { recursive: true });
  const rows: ArmRow[] = [];

  for (const model of models) {
    if (!catalog.includes(model.modelId)) {
      for (const frame of fixtures.cases) {
        const dir = path.join(RESULTS_DIR, model.id);
        await mkdir(dir, { recursive: true });
        const requestRel = path.relative(
          SPIKE_DIR,
          path.join(dir, `${frame.id}.request.json`)
        );
        const negativePrompt = buildFrameNegativePrompt(frame.caption, {
          castCount: frame.castCount,
        });
        const request = {
          model: model.modelId,
          case: frame.id,
          seed,
          generationStatus: "FAIL" as const,
          failureReason: `model ${model.modelId} not in LocalAI catalog`,
        };
        await writeFile(
          path.join(dir, `${frame.id}.request.json`),
          JSON.stringify(
            {
              ...request,
              prompt: frame.localPrompt,
              negativePrompt,
              rendererExpression: frame.rendererExpression,
              localai: base,
            },
            null,
            2
          ),
          "utf8"
        );
        rows.push({
          modelSlot: model.id,
          modelId: model.modelId,
          caseId: frame.id,
          seed,
          size,
          prompt: frame.localPrompt,
          negativePrompt,
          generationStatus: "FAIL",
          failureReason: request.failureReason,
          ms: 0,
          reusedR3Baseline: false,
          requestRel,
        });
        console.error("[spike-rcs-001] missing model", model.modelId);
      }
      continue;
    }

    const provider = createImageGenerationProvider(
      "localai",
      {
        acceptModelId: model.modelId,
        localBaseUrl: base,
        localAiApiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
        skipNetwork: false,
      },
      "accept"
    );

    for (const frame of fixtures.cases) {
      const dir = path.join(RESULTS_DIR, model.id);
      await mkdir(dir, { recursive: true });
      const outPng = path.join(dir, `${frame.id}.png`);
      const requestPath = path.join(dir, `${frame.id}.request.json`);
      const resultPath = path.join(dir, `${frame.id}.generation.json`);
      const pngRel = path.relative(SPIKE_DIR, outPng);
      const requestRel = path.relative(SPIKE_DIR, requestPath);
      const negativePrompt = buildFrameNegativePrompt(frame.caption, {
        castCount: frame.castCount,
      });

      const requestDoc = {
        grant: fixtures.grant,
        model: model.modelId,
        case: frame.id,
        seed,
        size,
        provider: "localai",
        localai: base,
        prompt: frame.localPrompt,
        negativePrompt,
        rendererExpression: frame.rendererExpression,
        cloudFallback: false,
      };
      await writeFile(requestPath, JSON.stringify(requestDoc, null, 2), "utf8");

      const reuse =
        model.reuseR3Baseline && !regenerateBaseline && existsSync(
          path.join(REPO_ROOT, frame.baselinePng)
        );

      if (skipExisting && existsSync(outPng)) {
        const blank = await assessBlank(outPng);
        rows.push({
          modelSlot: model.id,
          modelId: model.modelId,
          caseId: frame.id,
          seed,
          size,
          prompt: frame.localPrompt,
          negativePrompt,
          generationStatus: blank.blank ? "FAIL" : "OK",
          failureReason: blank.blank ? "blank canvas (existing file)" : undefined,
          blank: blank.blank,
          bytes: readFileSync(outPng).length,
          ms: 0,
          reusedR3Baseline: false,
          pngRel,
          requestRel,
        });
        console.info("[spike-rcs-001] skip existing", model.id, frame.id);
        continue;
      }

      if (reuse) {
        const src = path.join(REPO_ROOT, frame.baselinePng);
        await copyFile(src, outPng);
        const blank = await assessBlank(outPng);
        const gen = {
          model: model.modelId,
          case: frame.id,
          seed,
          generationStatus: blank.blank ? "FAIL" : "OK",
          failureReason: blank.blank ? "blank canvas" : undefined,
          reusedR3Baseline: true,
          sourcePng: frame.baselinePng,
          bytes: readFileSync(outPng).length,
        };
        await writeFile(resultPath, JSON.stringify(gen, null, 2), "utf8");
        rows.push({
          modelSlot: model.id,
          modelId: model.modelId,
          caseId: frame.id,
          seed,
          size,
          prompt: frame.localPrompt,
          negativePrompt,
          generationStatus: gen.generationStatus,
          failureReason: gen.failureReason,
          blank: blank.blank,
          bytes: gen.bytes,
          ms: 0,
          reusedR3Baseline: true,
          pngRel,
          requestRel,
        });
        console.info("[spike-rcs-001] reuse R3 baseline", model.id, frame.id);
        continue;
      }

      const started = Date.now();
      try {
        console.info("[spike-rcs-001] generate", {
          model: model.modelId,
          case: frame.id,
        });
        const result = await provider.generate({
          assetSlot: "scene_frame",
          prompt: frame.localPrompt,
          negativePrompt,
          seed,
          size: { width: size, height: size },
        });
        if (result.meta.providerId !== "localai") {
          throw new Error(
            `provider contamination: got ${result.meta.providerId}`
          );
        }
        if (result.meta.modelId !== model.modelId) {
          throw new Error(
            `model mismatch: expected ${model.modelId} got ${result.meta.modelId}`
          );
        }
        await writeFile(outPng, result.bytes);
        const blank = await assessBlank(outPng);
        const ms = Date.now() - started;
        const gen = {
          model: model.modelId,
          case: frame.id,
          seed,
          generationStatus: blank.blank ? "FAIL" : "OK",
          failureReason: blank.blank ? "blank canvas" : undefined,
          blank: blank.blank,
          bytes: result.bytes.length,
          ms,
          providerId: result.meta.providerId,
          modelId: result.meta.modelId,
        };
        await writeFile(resultPath, JSON.stringify(gen, null, 2), "utf8");
        rows.push({
          modelSlot: model.id,
          modelId: model.modelId,
          caseId: frame.id,
          seed,
          size,
          prompt: frame.localPrompt,
          negativePrompt,
          generationStatus: gen.generationStatus,
          failureReason: gen.failureReason,
          blank: blank.blank,
          bytes: gen.bytes,
          ms,
          reusedR3Baseline: false,
          pngRel,
          requestRel,
        });
        console.info("[spike-rcs-001] done", gen);
      } catch (err) {
        const failureReason =
          err instanceof Error ? err.message : String(err);
        const ms = Date.now() - started;
        const gen = {
          model: model.modelId,
          case: frame.id,
          seed,
          generationStatus: "FAIL" as const,
          failureReason,
          ms,
        };
        await writeFile(resultPath, JSON.stringify(gen, null, 2), "utf8");
        rows.push({
          modelSlot: model.id,
          modelId: model.modelId,
          caseId: frame.id,
          seed,
          size,
          prompt: frame.localPrompt,
          negativePrompt,
          generationStatus: "FAIL",
          failureReason,
          ms,
          reusedR3Baseline: false,
          requestRel,
        });
        console.error("[spike-rcs-001] fail", model.modelId, frame.id, failureReason.slice(0, 240));
      }
    }
  }

  const summary = {
    grant: fixtures.grant,
    generatedAt: new Date().toISOString(),
    seed,
    size,
    provider: "localai",
    localai: base,
    cloudFallbackDisabled: true,
    models: models.map((m) => ({ id: m.id, modelId: m.modelId })),
    counts: {
      arms: rows.length,
      ok: rows.filter((r) => r.generationStatus === "OK").length,
      fail: rows.filter((r) => r.generationStatus === "FAIL").length,
    },
    rows: rows.map((r) => ({
      ...r,
      prompt: undefined,
      negativePrompt: undefined,
    })),
  };
  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  console.info("[spike-rcs-001] complete", summary.counts);
}

main().catch((err) => {
  console.error("[spike-rcs-001] fatal", err);
  process.exit(1);
});
