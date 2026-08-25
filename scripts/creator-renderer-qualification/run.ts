/**
 * CREATOR-RENDERER-QUAL-001
 *
 * Frozen EVG-001-R3 Local prompts × seeds × LocalAI models.
 * No Projection / identity / prompt retuning. No Cloud fallback.
 *
 *   npx tsx scripts/creator-renderer-qualification/run.ts
 *   QUAL_MODELS=z-image npx tsx scripts/creator-renderer-qualification/run.ts
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { buildFrameNegativePrompt } from "../../lib/prompts/frame-draft";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SPIKE_DIR, "../..");
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

type QualCase = {
  id: string;
  workId: string;
  workDir: string;
  setting: string;
  cast: string;
  compositionClass: string;
  caption: string;
  castCount: number;
  localPrompt: string;
  reuse?: Record<string, string>;
};

type QualModel = {
  id: string;
  label: string;
  modelId: string;
  role: "candidate" | "baseline";
};

type Fixtures = {
  grant: string;
  seedProtocol: number[];
  size: number;
  cases: QualCase[];
  models: QualModel[];
};

type Row = {
  modelSlot: string;
  modelId: string;
  role: string;
  caseId: string;
  workId: string;
  setting: string;
  cast: string;
  compositionClass: string;
  seed: number;
  size: number;
  generationStatus: "OK" | "FAIL";
  failureReason?: string;
  blank?: boolean;
  bytes?: number;
  ms: number;
  reused: boolean;
  runtimeClass: "reused" | "warm";
  sequence: number;
  pngRel?: string;
};

async function assessBlank(pngPath: string): Promise<{
  blank: boolean;
  mean: number;
  std: number;
}> {
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

async function generateLocal(args: {
  base: string;
  modelId: string;
  prompt: string;
  negativePrompt: string;
  seed: number;
  size: number;
  timeoutMs: number;
}): Promise<{ bytes: Buffer; httpMs: number }> {
  const started = Date.now();
  const res = await fetch(`${args.base}/v1/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      model: args.modelId,
      prompt: args.prompt,
      negative_prompt: args.negativePrompt,
      n: 1,
      size: `${args.size}x${args.size}`,
      seed: args.seed,
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(args.timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("response missing b64_json");
  return { bytes: Buffer.from(b64, "base64"), httpMs: Date.now() - started };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "frozen-inputs.json"), "utf8")
  ) as Fixtures;

  const base = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "");
  const timeoutMs = Number(
    process.env.IMAGE_CREATOR_LOCALAI_TIMEOUT_MS?.trim() || "600000"
  );
  const skipExisting = process.env.QUAL_SKIP_EXISTING?.trim() === "1";
  const modelFilter = process.env.QUAL_MODELS?.trim();
  const models = modelFilter
    ? fixtures.models.filter((m) =>
        modelFilter.split(",").map((s) => s.trim()).includes(m.id)
      )
    : fixtures.models;
  const seeds = fixtures.seedProtocol;
  const size = fixtures.size;

  const catalogRes = await fetch(`${base}/v1/models`);
  const catalogJson = (await catalogRes.json()) as {
    data?: Array<{ id?: string }>;
  };
  const catalog = (catalogJson.data ?? [])
    .map((d) => d.id)
    .filter((id): id is string => Boolean(id));

  console.info("[qual-001] start", {
    grant: fixtures.grant,
    models: models.map((m) => m.modelId),
    cases: fixtures.cases.map((c) => c.id),
    seeds,
    catalog,
    cloudFallback: false,
    coldStart: "NOT_EXECUTED — LocalAI already running",
  });

  const rows: Row[] = [];
  let sequence = 0;

  const persist = async () => {
    const metrics = {
      grant: fixtures.grant,
      generatedAt: new Date().toISOString(),
      provider: "localai",
      localai: base,
      size,
      seeds,
      cloudFallbackDisabled: true,
      coldStart: "NOT_EXECUTED",
      vram: "NOT_AVAILABLE",
      counts: {
        arms: rows.length,
        ok: rows.filter((r) => r.generationStatus === "OK").length,
        fail: rows.filter((r) => r.generationStatus === "FAIL").length,
        blank: rows.filter((r) => r.blank).length,
      },
      successRate:
        rows.length === 0
          ? 0
          : Number(
              (
                rows.filter((r) => r.generationStatus === "OK").length /
                rows.length
              ).toFixed(3)
            ),
      rows,
    };
    await mkdir(RESULTS_DIR, { recursive: true });
    await writeFile(
      path.join(RESULTS_DIR, "metrics.json"),
      JSON.stringify(metrics, null, 2),
      "utf8"
    );
  };

  for (const model of models) {
    if (!catalog.includes(model.modelId)) {
      for (const frame of fixtures.cases) {
        for (const seed of seeds) {
          sequence += 1;
          rows.push({
            modelSlot: model.id,
            modelId: model.modelId,
            role: model.role,
            caseId: frame.id,
            workId: frame.workId,
            setting: frame.setting,
            cast: frame.cast,
            compositionClass: frame.compositionClass,
            seed,
            size,
            generationStatus: "FAIL",
            failureReason: `model ${model.modelId} not in LocalAI catalog`,
            ms: 0,
            reused: false,
            runtimeClass: "warm",
            sequence,
          });
        }
      }
      await persist();
      continue;
    }

    for (const frame of fixtures.cases) {
      const dir = path.join(RESULTS_DIR, model.id, frame.workDir);
      await mkdir(dir, { recursive: true });
      const negativePrompt = buildFrameNegativePrompt(frame.caption, {
        castCount: frame.castCount,
      });

      for (const seed of seeds) {
        sequence += 1;
        const stem = `${frame.id}-s${seed}`;
        const outPng = path.join(dir, `${stem}.png`);
        const pngRel = path.relative(SPIKE_DIR, outPng);
        const requestPath = path.join(dir, `${stem}.request.json`);
        await writeFile(
          requestPath,
          JSON.stringify(
            {
              grant: fixtures.grant,
              model: model.modelId,
              case: frame.id,
              seed,
              size,
              prompt: frame.localPrompt,
              negativePrompt,
              cloudFallback: false,
            },
            null,
            2
          ),
          "utf8"
        );

        const reuseKey = `${model.id}-${seed}`;
        const reuseRel = frame.reuse?.[reuseKey];
        const reuseAbs = reuseRel ? path.join(REPO_ROOT, reuseRel) : "";

        if (skipExisting && existsSync(outPng)) {
          const blank = await assessBlank(outPng);
          rows.push({
            modelSlot: model.id,
            modelId: model.modelId,
            role: model.role,
            caseId: frame.id,
            workId: frame.workId,
            setting: frame.setting,
            cast: frame.cast,
            compositionClass: frame.compositionClass,
            seed,
            size,
            generationStatus: blank.blank ? "FAIL" : "OK",
            failureReason: blank.blank ? "blank canvas (existing)" : undefined,
            blank: blank.blank,
            bytes: readFileSync(outPng).length,
            ms: 0,
            reused: false,
            runtimeClass: "warm",
            sequence,
            pngRel,
          });
          await persist();
          console.info("[qual-001] skip existing", model.id, frame.id, seed);
          continue;
        }

        if (reuseAbs && existsSync(reuseAbs)) {
          await copyFile(reuseAbs, outPng);
          const blank = await assessBlank(outPng);
          rows.push({
            modelSlot: model.id,
            modelId: model.modelId,
            role: model.role,
            caseId: frame.id,
            workId: frame.workId,
            setting: frame.setting,
            cast: frame.cast,
            compositionClass: frame.compositionClass,
            seed,
            size,
            generationStatus: blank.blank ? "FAIL" : "OK",
            failureReason: blank.blank ? "blank canvas" : undefined,
            blank: blank.blank,
            bytes: readFileSync(outPng).length,
            ms: 0,
            reused: true,
            runtimeClass: "reused",
            sequence,
            pngRel,
          });
          await persist();
          console.info("[qual-001] reuse", model.id, frame.id, seed);
          continue;
        }

        const started = Date.now();
        try {
          console.info("[qual-001] generate", {
            model: model.modelId,
            case: frame.id,
            seed,
            sequence,
          });
          const result = await generateLocal({
            base,
            modelId: model.modelId,
            prompt: frame.localPrompt,
            negativePrompt,
            seed,
            size,
            timeoutMs,
          });
          await writeFile(outPng, result.bytes);
          const blank = await assessBlank(outPng);
          rows.push({
            modelSlot: model.id,
            modelId: model.modelId,
            role: model.role,
            caseId: frame.id,
            workId: frame.workId,
            setting: frame.setting,
            cast: frame.cast,
            compositionClass: frame.compositionClass,
            seed,
            size,
            generationStatus: blank.blank ? "FAIL" : "OK",
            failureReason: blank.blank ? "blank canvas" : undefined,
            blank: blank.blank,
            bytes: result.bytes.length,
            ms: Date.now() - started,
            reused: false,
            runtimeClass: "warm",
            sequence,
            pngRel,
          });
          console.info("[qual-001] done", {
            model: model.modelId,
            case: frame.id,
            seed,
            ms: Date.now() - started,
            blank: blank.blank,
          });
        } catch (err) {
          const failureReason =
            err instanceof Error ? err.message : String(err);
          rows.push({
            modelSlot: model.id,
            modelId: model.modelId,
            role: model.role,
            caseId: frame.id,
            workId: frame.workId,
            setting: frame.setting,
            cast: frame.cast,
            compositionClass: frame.compositionClass,
            seed,
            size,
            generationStatus: "FAIL",
            failureReason,
            ms: Date.now() - started,
            reused: false,
            runtimeClass: "warm",
            sequence,
          });
          console.error(
            "[qual-001] fail",
            model.modelId,
            frame.id,
            seed,
            failureReason.slice(0, 240)
          );
        }
        await persist();
      }
    }
  }

  await persist();
  console.info("[qual-001] complete", {
    arms: rows.length,
    ok: rows.filter((r) => r.generationStatus === "OK").length,
    fail: rows.filter((r) => r.generationStatus === "FAIL").length,
  });
}

main().catch((err) => {
  console.error("[qual-001] fatal", err);
  process.exit(1);
});
