/**
 * Portrait-Reference Face Coherence Spike
 *
 * Arms:
 *   A baseline          — Expression → scene, no reference
 *   B portrait_ref      — portrait → scene with referenceImages[0]
 *   C face_mitigation   — Expression with hoods/helmets/far faces, no ref
 *
 *   npx tsx scripts/face-coherence-portrait-ref-spike/run.ts
 *   SPIKE_CASES=case-duel SPIKE_SKIP_EXISTING=1
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { imageGenerate } from "../../lib/ai/capability/imageGenerate";
import {
  parseRendererExpression,
  type RendererExpression,
} from "../../lib/discovery/visual-contract";
import { buildAvatarPrompt } from "../../lib/prompts/avatar";
import {
  buildFrameDraftPrompt,
  buildFrameNegativePrompt,
} from "../../lib/prompts/frame-draft";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

type CaseFixture = {
  id: string;
  label: string;
  routeTitle: string;
  summary: string;
  focusRole: string;
  portraitName: string;
  expression: unknown;
  faceMitigationExpression: unknown;
};

type Fixtures = {
  model: string;
  seed: number;
  size: number;
  cases: CaseFixture[];
};

type ArmId = "baseline" | "portrait-ref" | "face-mitigation";

type ArmRow = {
  caseId: string;
  arm: ArmId | "portrait";
  ok: boolean;
  blank: boolean;
  bytes: number;
  ms: number;
  usedFallback: boolean;
  promptLen: number;
  pngRel?: string;
  error?: string;
  mean?: number;
  std?: number;
  refAttached?: boolean;
  /** Mean abs pixel diff vs baseline (0–255); high ⇒ LocalAI likely used ref */
  diffVsBaseline?: number | null;
};

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function parseExpr(raw: unknown): RendererExpression {
  const result = parseRendererExpression(raw);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.value;
}

function focusVisual(expr: RendererExpression, role: string): string {
  const hit = expr.characters.find(
    (c) => c.role.trim().toLowerCase() === role.trim().toLowerCase()
  );
  return hit?.visual?.trim() || expr.characters[0]?.visual || "fantasy character";
}

function toDataUrl(bytes: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
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

/** Rough structural difference — if near 0, LocalAI likely ignored ref_images. */
async function meanAbsDiff(
  aPath: string,
  bPath: string
): Promise<number | null> {
  try {
    const sharp = (await import("sharp")).default;
    const size = 64;
    const a = await sharp(readFileSync(aPath))
      .resize(size, size, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
    const b = await sharp(readFileSync(bPath))
      .resize(size, size, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
    let sum = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
    return Number((sum / n).toFixed(2));
  } catch {
    return null;
  }
}

async function generateArm(input: {
  caseId: string;
  arm: ArmId | "portrait";
  prompt: string;
  negativePrompt?: string;
  assetSlot: "portrait" | "scene_frame";
  seed: number;
  size: number;
  outPng: string;
  referenceUrl?: string;
  skipExisting: boolean;
}): Promise<ArmRow> {
  const pngRel = path.relative(SPIKE_DIR, input.outPng);
  if (input.skipExisting && (await exists(input.outPng))) {
    const blank = await assessBlank(input.outPng);
    const bytes = readFileSync(input.outPng).length;
    console.info(`[face-coh] skip existing ${pngRel}`);
    return {
      caseId: input.caseId,
      arm: input.arm,
      ok: !blank.blank,
      blank: blank.blank,
      bytes,
      ms: 0,
      usedFallback: false,
      promptLen: input.prompt.length,
      pngRel,
      mean: blank.mean,
      std: blank.std,
      refAttached: Boolean(input.referenceUrl),
    };
  }

  const started = Date.now();
  try {
    if (input.referenceUrl) {
      console.info(`[face-coh] ref_images attached`, {
        caseId: input.caseId,
        arm: input.arm,
        refKind: input.referenceUrl.startsWith("data:")
          ? `data-url len=${input.referenceUrl.length}`
          : input.referenceUrl.slice(0, 80),
      });
    }
    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: input.assetSlot,
      clientJobId: `face-coh-${input.caseId}-${input.arm}`,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      seed: input.seed,
      size: { width: input.size, height: input.size },
      referenceImages: input.referenceUrl
        ? [{ url: input.referenceUrl }]
        : undefined,
    });
    await mkdir(path.dirname(input.outPng), { recursive: true });
    await writeFile(input.outPng, candidate.bytes);
    const blank = await assessBlank(input.outPng);
    return {
      caseId: input.caseId,
      arm: input.arm,
      ok: !blank.blank,
      blank: blank.blank,
      bytes: candidate.bytes.length,
      ms: Date.now() - started,
      usedFallback: candidate.usedFallback,
      promptLen: input.prompt.length,
      pngRel,
      mean: blank.mean,
      std: blank.std,
      refAttached: Boolean(input.referenceUrl),
      error: blank.blank ? "blank canvas" : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      caseId: input.caseId,
      arm: input.arm,
      ok: false,
      blank: /blank/i.test(message),
      bytes: 0,
      ms: Date.now() - started,
      usedFallback: false,
      promptLen: input.prompt.length,
      refAttached: Boolean(input.referenceUrl),
      error: message.slice(0, 500),
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

  const seed = Number(process.env.SPIKE_SEED?.trim() || fixtures.seed) || 42;
  const size = Number(process.env.SPIKE_SIZE?.trim() || fixtures.size) || 512;
  const skipExisting = process.env.SPIKE_SKIP_EXISTING?.trim() === "1";
  const caseFilter = process.env.SPIKE_CASES?.trim();
  const cases = caseFilter
    ? fixtures.cases.filter((c) =>
        caseFilter.split(",").map((s) => s.trim()).includes(c.id)
      )
    : fixtures.cases;

  await mkdir(RESULTS_DIR, { recursive: true });

  console.info("[face-coh] start", {
    model: process.env.IMAGE_CREATOR_ACCEPT_MODEL || fixtures.model,
    provider: process.env.IMAGE_CREATOR_ACCEPT_PROVIDER,
    seed,
    size,
    cases: cases.map((c) => c.id),
  });

  const rows: ArmRow[] = [];

  for (const c of cases) {
    const expr = parseExpr(c.expression);
    const mitigated = parseExpr(c.faceMitigationExpression);
    const visual = focusVisual(expr, c.focusRole);
    const outDir = path.join(RESULTS_DIR, c.id);
    await mkdir(outDir, { recursive: true });

    // Portrait for focus cast
    const portraitPrompt = buildAvatarPrompt(
      c.portraitName,
      `${visual}, clear readable face, coherent facial features`
    );
    const portraitPath = path.join(outDir, "portrait.png");
    const portraitRow = await generateArm({
      caseId: c.id,
      arm: "portrait",
      prompt: portraitPrompt,
      assetSlot: "portrait",
      seed,
      size,
      outPng: portraitPath,
      skipExisting,
    });
    rows.push(portraitRow);
    console.info("[face-coh] portrait", {
      caseId: c.id,
      ok: portraitRow.ok,
      ms: portraitRow.ms,
      error: portraitRow.error?.slice(0, 120),
    });

    let refUrl: string | undefined;
    if (portraitRow.ok && (await exists(portraitPath))) {
      const bytes = readFileSync(portraitPath);
      refUrl = toDataUrl(bytes, "image/png");
    }

    const scenePrompt = buildFrameDraftPrompt({
      caption: c.summary,
      routeTitle: c.routeTitle,
      rendererExpression: expr,
    });
    const mitigatePrompt = buildFrameDraftPrompt({
      caption: c.summary,
      routeTitle: c.routeTitle,
      rendererExpression: mitigated,
    });
    const neg = buildFrameNegativePrompt(c.summary);

    const baselinePath = path.join(outDir, "baseline.png");
    const baseline = await generateArm({
      caseId: c.id,
      arm: "baseline",
      prompt: scenePrompt,
      negativePrompt: neg,
      assetSlot: "scene_frame",
      seed,
      size,
      outPng: baselinePath,
      skipExisting,
    });
    rows.push(baseline);
    console.info("[face-coh] baseline", {
      caseId: c.id,
      ok: baseline.ok,
      ms: baseline.ms,
    });

    const refPath = path.join(outDir, "portrait-ref.png");
    // Same prompt+seed as baseline — only referenceImages differs (fair ref_images test).
    const withRef = await generateArm({
      caseId: c.id,
      arm: "portrait-ref",
      prompt: scenePrompt,
      negativePrompt: neg,
      assetSlot: "scene_frame",
      seed,
      size,
      outPng: refPath,
      referenceUrl: refUrl,
      skipExisting,
    });
    if (baseline.ok && withRef.ok && (await exists(baselinePath)) && (await exists(refPath))) {
      withRef.diffVsBaseline = await meanAbsDiff(baselinePath, refPath);
      console.info("[face-coh] portrait-ref vs baseline MAD", {
        caseId: c.id,
        mad: withRef.diffVsBaseline,
        hint:
          withRef.diffVsBaseline != null && withRef.diffVsBaseline < 3
            ? "likely_ignored_ref"
            : withRef.diffVsBaseline != null && withRef.diffVsBaseline > 12
              ? "likely_used_or_divergent"
              : "inconclusive",
      });
    }
    rows.push(withRef);
    console.info("[face-coh] portrait-ref", {
      caseId: c.id,
      ok: withRef.ok,
      ms: withRef.ms,
      refAttached: withRef.refAttached,
      error: withRef.error?.slice(0, 120),
    });

    const mitPath = path.join(outDir, "face-mitigation.png");
    const mit = await generateArm({
      caseId: c.id,
      arm: "face-mitigation",
      prompt: mitigatePrompt,
      negativePrompt: neg,
      assetSlot: "scene_frame",
      seed,
      size,
      outPng: mitPath,
      skipExisting,
    });
    rows.push(mit);
    console.info("[face-coh] face-mitigation", {
      caseId: c.id,
      ok: mit.ok,
      ms: mit.ms,
    });
  }

  const summary = {
    seed,
    size,
    provider: process.env.IMAGE_CREATOR_ACCEPT_PROVIDER,
    model: process.env.IMAGE_CREATOR_ACCEPT_MODEL || fixtures.model,
    generatedAt: new Date().toISOString(),
    runtimePath:
      "buildAvatarPrompt → imageGenerate(portrait) → buildFrameDraftPrompt(Expression) → imageGenerate(scene_frame ± referenceImages)",
    arms: ["baseline", "portrait-ref", "face-mitigation"] as const,
    note: "MAD < 3 between baseline and portrait-ref suggests LocalAI ignored ref_images under identical seed/prompt (prompt has one extra identity sentence on B).",
    rows,
  };

  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  console.info("[face-coh] complete", {
    rows: rows.length,
    ok: rows.filter((r) => r.ok).length,
    results: RESULTS_DIR,
  });
}

main().catch((err) => {
  console.error("[face-coh] fatal", err);
  process.exit(1);
});
