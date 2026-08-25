/**
 * Z-IMAGE-BLOCKER-CHECK-001
 *
 * B1: 10 Z-Image gens after LocalAI restart (cold 1–5, warm 6–10).
 * B2: same 10 frames = frozen R3 tk-symbol-profile (single-character Guanyu).
 *
 * Does not retune prompt / Projection / identity. No Cloud fallback.
 *
 *   npx tsx scripts/z-image-blocker-check/run.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { buildFrameNegativePrompt } from "../../lib/prompts/frame-draft";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");
const QUAL_FROZEN = path.resolve(
  SPIKE_DIR,
  "../creator-renderer-qualification/frozen-inputs.json"
);

const SEEDS = [42, 101, 202, 303, 404, 505, 606, 707, 808, 909] as const;
const MODEL_ID = "Z-Image-Turbo";
const SIZE = 512;

type QualFixtures = {
  cases: Array<{
    id: string;
    caption: string;
    localPrompt: string;
    castCount: number;
  }>;
};

type Row = {
  attempt: number;
  phase: "cold" | "warm";
  seed: number;
  success: boolean;
  latencyMs: number;
  error?: string;
  eof: boolean;
  blank: boolean;
  timeout: boolean;
  pngRel?: string;
  bytes?: number;
};

function classifyError(message: string): {
  eof: boolean;
  timeout: boolean;
} {
  const m = message.toLowerCase();
  return {
    eof: m.includes("eof") || m.includes("unavailable"),
    timeout:
      m.includes("timeout") ||
      m.includes("aborted") ||
      m.includes("abort"),
  };
}

async function assessBlank(pngPath: string): Promise<boolean> {
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
    return std <= 14 && mean >= 245;
  } catch {
    return false;
  }
}

async function waitForLocalAi(
  base: string,
  timeoutMs: number
): Promise<string[]> {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${base}/v1/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ id?: string }> };
        const ids = (json.data ?? [])
          .map((d) => d.id)
          .filter((id): id is string => Boolean(id));
        if (ids.includes(MODEL_ID)) return ids;
        last = `catalog missing ${MODEL_ID}: ${ids.join(",")}`;
      } else {
        last = `HTTP ${res.status}`;
      }
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`LocalAI not ready after ${timeoutMs}ms (${last})`);
}

async function generateLocal(args: {
  base: string;
  prompt: string;
  negativePrompt: string;
  seed: number;
  timeoutMs: number;
}): Promise<{ bytes: Buffer; httpMs: number }> {
  const started = Date.now();
  const res = await fetch(`${args.base}/v1/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      model: MODEL_ID,
      prompt: args.prompt,
      negative_prompt: args.negativePrompt,
      n: 1,
      size: `${SIZE}x${SIZE}`,
      seed: args.seed,
      response_format: "b64_json",
    }),
    signal: AbortSignal.timeout(args.timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("response missing b64_json");
  return { bytes: Buffer.from(b64, "base64"), httpMs: Date.now() - started };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const fixtures = JSON.parse(
    readFileSync(QUAL_FROZEN, "utf8")
  ) as QualFixtures;
  const frame = fixtures.cases.find((c) => c.id === "tk-symbol-profile");
  if (!frame) throw new Error("tk-symbol-profile missing from QUAL frozen-inputs");

  const base = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "");
  const timeoutMs = Number(
    process.env.IMAGE_CREATOR_LOCALAI_TIMEOUT_MS?.trim() || "600000"
  );
  const negativePrompt = buildFrameNegativePrompt(frame.caption, {
    castCount: frame.castCount,
  });

  console.info("[blocker-001] wait LocalAI", { base, model: MODEL_ID });
  const catalog = await waitForLocalAi(base, 180_000);
  console.info("[blocker-001] start", {
    grant: "Z-IMAGE-BLOCKER-CHECK-001",
    promptSource: "scripts/creator-renderer-qualification/frozen-inputs.json#tk-symbol-profile",
    rcsFrozen: "scripts/renderer-capability-spike/frozen-inputs.json (no single-cast case; using R3 lineage QUAL copy)",
    seeds: SEEDS,
    catalog,
    cloudFallback: false,
  });

  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(
    path.join(RESULTS_DIR, "request.json"),
    JSON.stringify(
      {
        grant: "Z-IMAGE-BLOCKER-CHECK-001",
        modelId: MODEL_ID,
        caseId: "tk-symbol-profile",
        prompt: frame.localPrompt,
        negativePrompt,
        seeds: SEEDS,
        size: SIZE,
      },
      null,
      2
    ),
    "utf8"
  );

  const rows: Row[] = [];

  const persist = async () => {
    await writeFile(
      path.join(RESULTS_DIR, "metrics.json"),
      JSON.stringify(
        {
          grant: "Z-IMAGE-BLOCKER-CHECK-001",
          generatedAt: new Date().toISOString(),
          modelId: MODEL_ID,
          caseId: "tk-symbol-profile",
          counts: {
            attempts: rows.length,
            ok: rows.filter((r) => r.success).length,
            fail: rows.filter((r) => !r.success).length,
            blank: rows.filter((r) => r.blank).length,
            timeout: rows.filter((r) => r.timeout).length,
            eof: rows.filter((r) => r.eof).length,
          },
          rows,
        },
        null,
        2
      ),
      "utf8"
    );
  };

  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i]!;
    const attempt = i + 1;
    const phase: "cold" | "warm" = attempt <= 5 ? "cold" : "warm";
    const started = Date.now();
    const outPng = path.join(RESULTS_DIR, `tk-symbol-profile-s${seed}.png`);
    console.info("[blocker-001] generate", { attempt, phase, seed });
    try {
      const result = await generateLocal({
        base,
        prompt: frame.localPrompt,
        negativePrompt,
        seed,
        timeoutMs,
      });
      await writeFile(outPng, result.bytes);
      const blank = await assessBlank(outPng);
      rows.push({
        attempt,
        phase,
        seed,
        success: !blank,
        latencyMs: Date.now() - started,
        blank,
        eof: false,
        timeout: false,
        pngRel: path.relative(SPIKE_DIR, outPng),
        bytes: result.bytes.length,
        error: blank ? "blank canvas" : undefined,
      });
      console.info("[blocker-001] done", {
        attempt,
        phase,
        seed,
        blank,
        ms: Date.now() - started,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const { eof, timeout } = classifyError(error);
      rows.push({
        attempt,
        phase,
        seed,
        success: false,
        latencyMs: Date.now() - started,
        error,
        eof,
        blank: false,
        timeout,
      });
      console.error("[blocker-001] fail", { attempt, phase, seed, error: error.slice(0, 240) });
    }
    await persist();
  }

  await persist();
  console.info("[blocker-001] complete", {
    ok: rows.filter((r) => r.success).length,
    fail: rows.filter((r) => !r.success).length,
  });
}

main().catch((err) => {
  console.error("[blocker-001] fatal", err);
  process.exit(1);
});
