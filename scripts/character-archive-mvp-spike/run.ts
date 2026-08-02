/**
 * Character Archive MVP Spike — Baseline A vs Archive B
 *
 * No portrait ref / InstantID / DB / ADR change.
 *
 *   npx tsx scripts/character-archive-mvp-spike/run.ts
 *   SPIKE_CASES=godswood SPIKE_ARMS=archive
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { imageGenerate } from "../../lib/ai/capability/imageGenerate";
import { assessSceneFaceSafety } from "../../lib/discovery/expression-capability-rules";
import {
  parseRendererExpression,
  type RendererExpression,
} from "../../lib/discovery/visual-contract";
import {
  buildFrameDraftPrompt,
  buildFrameNegativePrompt,
} from "../../lib/prompts/frame-draft";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

type Arm = "baseline" | "archive";

type CaseFixture = {
  id: string;
  label: string;
  caption: string;
  cast: string[];
  baselineExpression: unknown;
  archiveExpression: unknown;
};

type Fixtures = {
  model: string;
  seed: number;
  size: number;
  styleSuffix: string;
  cases: CaseFixture[];
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

function parseExpr(raw: unknown, label: string): RendererExpression {
  const result = parseRendererExpression(raw);
  if (!result.ok) throw new Error(`${label}: ${result.errors.join("; ")}`);
  return result.value;
}

async function main(): Promise<void> {
  loadEnvLocal();
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512";

  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as Fixtures;
  const characters = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "characters.json"), "utf8")
  );

  const seed = Number(process.env.SPIKE_SEED?.trim() || fixtures.seed) || 42;
  const size = Number(process.env.SPIKE_SIZE?.trim() || fixtures.size) || 512;
  const skipExisting = process.env.SPIKE_SKIP_EXISTING?.trim() === "1";
  const caseFilter = process.env.SPIKE_CASES?.trim();
  const armFilter = process.env.SPIKE_ARMS?.trim();
  const cases = caseFilter
    ? fixtures.cases.filter((c) =>
        caseFilter.split(",").map((s) => s.trim()).includes(c.id)
      )
    : fixtures.cases;
  const arms = (armFilter
    ? armFilter.split(",").map((s) => s.trim())
    : ["baseline", "archive"]) as Arm[];

  await mkdir(RESULTS_DIR, { recursive: true });

  console.info("[char-archive] start", {
    model: process.env.IMAGE_CREATOR_ACCEPT_MODEL || fixtures.model,
    seed,
    cases: cases.map((c) => c.id),
    arms,
  });

  const rows: Record<string, unknown>[] = [];

  for (const c of cases) {
    const outDir = path.join(RESULTS_DIR, c.id);
    await mkdir(outDir, { recursive: true });

    for (const arm of arms) {
      const raw =
        arm === "baseline" ? c.baselineExpression : c.archiveExpression;
      const expression = parseExpr(raw, `${c.id}/${arm}`);
      const faceSafety = assessSceneFaceSafety(expression);
      if (faceSafety.safety_status === "restricted") {
        throw new Error(
          `${c.id}/${arm} Face Safety restricted: ${faceSafety.reason}`
        );
      }

      const prompt = [
        buildFrameDraftPrompt({
          caption: c.caption,
          routeTitle: c.label,
          rendererExpression: expression,
        }),
        fixtures.styleSuffix,
      ].join(" ");

      const outPng = path.join(outDir, `${arm}.png`);
      const pngRel = path.relative(SPIKE_DIR, outPng);

      if (skipExisting && (await exists(outPng))) {
        const blank = await assessBlank(outPng);
        rows.push({
          caseId: c.id,
          arm,
          faceSafety,
          promptLen: prompt.length,
          ok: !blank.blank,
          blank: blank.blank,
          bytes: readFileSync(outPng).length,
          ms: 0,
          pngRel,
          skipped: true,
        });
        console.info("[char-archive] skip", c.id, arm);
        continue;
      }

      const started = Date.now();
      try {
        console.info("[char-archive] generate", {
          caseId: c.id,
          arm,
          faceSafety: faceSafety.safety_status,
          promptLen: prompt.length,
        });
        const candidate = await imageGenerate({
          surface: "creator",
          assetSlot: "scene_frame",
          clientJobId: `char-archive-${c.id}-${arm}`,
          prompt,
          negativePrompt: buildFrameNegativePrompt(c.caption),
          seed,
          size: { width: size, height: size },
        });
        await writeFile(outPng, candidate.bytes);
        const blank = await assessBlank(outPng);
        rows.push({
          caseId: c.id,
          arm,
          cast: c.cast,
          expression,
          faceSafety,
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
        });
        console.info("[char-archive] done", {
          caseId: c.id,
          arm,
          ok: !blank.blank,
          ms: Date.now() - started,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        rows.push({
          caseId: c.id,
          arm,
          faceSafety,
          promptLen: prompt.length,
          ok: false,
          blank: /blank/i.test(message),
          bytes: 0,
          ms: Date.now() - started,
          error: message.slice(0, 500),
        });
        console.error("[char-archive] fail", c.id, arm, message.slice(0, 160));
      }
    }
  }

  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(
      {
        seed,
        size,
        provider: process.env.IMAGE_CREATOR_ACCEPT_PROVIDER,
        model: process.env.IMAGE_CREATOR_ACCEPT_MODEL || fixtures.model,
        generatedAt: new Date().toISOString(),
        characterArchiveMvp: characters,
        note: "Archive cues folded into rendererExpression.characters[].visual only — Discovery-authored presentation, not portrait-ref.",
        rows,
      },
      null,
      2
    ),
    "utf8"
  );

  console.info("[char-archive] complete", {
    ok: rows.filter((r) => (r as { ok?: boolean }).ok).length,
    total: rows.length,
  });
}

main().catch((err) => {
  console.error("[char-archive] fatal", err);
  process.exit(1);
});
