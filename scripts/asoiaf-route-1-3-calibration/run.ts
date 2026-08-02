/**
 * ASOIAF Route 1–3 Visual Expression Calibration Pass
 *
 * Face Safety + style-anchored Expression → Local scene_frame Candidates.
 * No portrait ref / identity transfer / Cloud.
 *
 *   npx tsx scripts/asoiaf-route-1-3-calibration/run.ts
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { imageGenerate } from "../../lib/ai/capability/imageGenerate";
import {
  assessSceneFaceSafety,
  type SceneFaceSafetyAssessment,
} from "../../lib/discovery/expression-capability-rules";
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

type StyleAnchor = {
  palette: string;
  texture: string;
  camera_language: string;
  lighting: string;
};

type FrameFixture = {
  id: string;
  label: string;
  title: string;
  caption: string;
  identitySupport: {
    namesInCaption: string[];
    costumeCues: string[];
    relationshipCue: string;
  };
  policy: {
    shot_type: string;
    camera_distance: string;
    face_visibility: string;
    composition_focus: string;
    lighting_style: string;
  };
  expression: unknown;
  beforeNotes: string;
};

type Fixtures = {
  model: string;
  seed: number;
  size: number;
  workTitle: string;
  styleAnchor: StyleAnchor;
  frames: FrameFixture[];
};

type FrameRow = {
  id: string;
  title: string;
  caption: string;
  policy: FrameFixture["policy"];
  expression: RendererExpression;
  faceSafety: SceneFaceSafetyAssessment;
  prompt: string;
  ok: boolean;
  blank: boolean;
  bytes: number;
  ms: number;
  usedFallback: boolean;
  pngRel?: string;
  error?: string;
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

/** Style anchor as short Deployment-side prompt suffix — not Discovery meaning. */
function withStyleAnchor(prompt: string, anchor: StyleAnchor): string {
  // Keep short: long English wrappers raise Local blank rate (frame-draft lesson).
  return `${prompt} Style: ${anchor.palette}; ${anchor.texture}; ${anchor.lighting}.`;
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
  const frameFilter = process.env.SPIKE_FRAMES?.trim();
  const frames = frameFilter
    ? fixtures.frames.filter((f) =>
        frameFilter.split(",").map((s) => s.trim()).includes(f.id)
      )
    : fixtures.frames;

  await mkdir(RESULTS_DIR, { recursive: true });

  console.info("[route-cal] start", {
    workTitle: fixtures.workTitle,
    model: process.env.IMAGE_CREATOR_ACCEPT_MODEL || fixtures.model,
    seed,
    frames: frames.map((f) => f.id),
  });

  const rows: FrameRow[] = [];

  for (const frame of frames) {
    const parsed = parseRendererExpression(frame.expression);
    if (!parsed.ok) {
      throw new Error(`${frame.id}: ${parsed.errors.join("; ")}`);
    }
    const expression = parsed.value;
    const faceSafety = assessSceneFaceSafety(expression);
    if (faceSafety.safety_status === "restricted") {
      throw new Error(
        `${frame.id}: Face Safety restricted (${faceSafety.reason}) — fix Expression`
      );
    }

    const basePrompt = buildFrameDraftPrompt({
      caption: frame.caption,
      routeTitle: frame.title,
      rendererExpression: expression,
    });
    const prompt = withStyleAnchor(basePrompt, fixtures.styleAnchor);
    const outPng = path.join(RESULTS_DIR, `${frame.id}.png`);
    const pngRel = path.relative(SPIKE_DIR, outPng);

    if (skipExisting && (await exists(outPng))) {
      const blank = await assessBlank(outPng);
      rows.push({
        id: frame.id,
        title: frame.title,
        caption: frame.caption,
        policy: frame.policy,
        expression,
        faceSafety,
        prompt,
        ok: !blank.blank,
        blank: blank.blank,
        bytes: readFileSync(outPng).length,
        ms: 0,
        usedFallback: false,
        pngRel,
        mean: blank.mean,
        std: blank.std,
      });
      console.info("[route-cal] skip", frame.id);
      continue;
    }

    const started = Date.now();
    try {
      console.info("[route-cal] generate", {
        id: frame.id,
        faceSafety: faceSafety.safety_status,
        reason: faceSafety.reason,
        visibility: faceSafety.inferredVisibility,
      });
      const candidate = await imageGenerate({
        surface: "creator",
        assetSlot: "scene_frame",
        clientJobId: `route-cal-${frame.id}`,
        prompt,
        negativePrompt: buildFrameNegativePrompt(frame.caption),
        seed,
        size: { width: size, height: size },
      });
      await writeFile(outPng, candidate.bytes);
      const blank = await assessBlank(outPng);
      rows.push({
        id: frame.id,
        title: frame.title,
        caption: frame.caption,
        policy: frame.policy,
        expression,
        faceSafety,
        prompt,
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
      console.info("[route-cal] done", {
        id: frame.id,
        ok: !blank.blank,
        ms: Date.now() - started,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rows.push({
        id: frame.id,
        title: frame.title,
        caption: frame.caption,
        policy: frame.policy,
        expression,
        faceSafety,
        prompt,
        ok: false,
        blank: /blank/i.test(message),
        bytes: 0,
        ms: Date.now() - started,
        usedFallback: false,
        error: message.slice(0, 500),
      });
      console.error("[route-cal] fail", frame.id, message.slice(0, 200));
    }
  }

  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(
      {
        workTitle: fixtures.workTitle,
        styleAnchor: fixtures.styleAnchor,
        seed,
        size,
        provider: process.env.IMAGE_CREATOR_ACCEPT_PROVIDER,
        model: process.env.IMAGE_CREATOR_ACCEPT_MODEL || fixtures.model,
        generatedAt: new Date().toISOString(),
        note: "Style anchor appended as Deployment prompt suffix only; not Visual Intent.",
        frames: fixtures.frames.map((f) => ({
          id: f.id,
          beforeNotes: f.beforeNotes,
          identitySupport: f.identitySupport,
          policy: f.policy,
        })),
        rows,
      },
      null,
      2
    ),
    "utf8"
  );

  console.info("[route-cal] complete", {
    ok: rows.filter((r) => r.ok).length,
    total: rows.length,
    results: RESULTS_DIR,
  });
}

main().catch((err) => {
  console.error("[route-cal] fatal", err);
  process.exit(1);
});
