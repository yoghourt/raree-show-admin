/**
 * Spike: Expression Minimality Validation (ADR-011 / SPEC-DVE-001)
 *
 * Compare Expression density only — Full / Minimal / Over-compressed —
 * on the same Local model / seed / 512². No Planner / Adapter / Cloud.
 *
 *   npx tsx scripts/expression-minimality-spike/run.ts
 */

import { access, mkdir, writeFile } from "node:fs/promises";
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
const FINDINGS_PATH = path.join(
  path.resolve(SPIKE_DIR, "../../docs/findings"),
  "expression-minimality-spike.md"
);

const LEVELS = ["full", "minimal", "compressed"] as const;
type DensityLevel = (typeof LEVELS)[number];

type CaseFixture = {
  id: string;
  label: string;
  intentSummary: string;
  levels: Record<DensityLevel, unknown>;
};

type Fixtures = {
  model: string;
  seed: number;
  size: number;
  cases: CaseFixture[];
};

type ArmResult = {
  caseId: string;
  level: DensityLevel;
  promptLen: number;
  ok: boolean;
  bytes: number;
  ms: number;
  blank?: boolean;
  mean?: number;
  std?: number;
  error?: string;
  expression: RendererExpression;
  prompt: string;
  pngRel: string;
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
    const { data, info } = await sharp(buf)
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

function parseLevel(raw: unknown): RendererExpression {
  const result = parseRendererExpression(raw);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.value;
}

async function renderExpression(input: {
  provider: ReturnType<typeof createImageGenerationProvider>;
  expression: RendererExpression;
  seed: number;
  size: number;
  outPng: string;
}): Promise<{ ok: boolean; bytes: number; ms: number; error?: string }> {
  const prompt = rendererExpressionToPrompt(input.expression);
  const started = Date.now();
  try {
    const result = await input.provider.generate({
      prompt,
      seed: input.seed,
      size: { width: input.size, height: input.size },
      assetSlot: "scene_frame",
      negativePrompt:
        "blank, blank canvas, solid white, text, watermark, collage, split screen",
    });
    await writeFile(input.outPng, result.bytes);
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

  await mkdir(RESULTS_DIR, { recursive: true });
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

  console.info("[expression-minimality] start", { model, seed, size, base });

  const arms: ArmResult[] = [];

  for (const c of fixtures.cases) {
    const caseDir = path.join(RESULTS_DIR, c.id);
    await mkdir(caseDir, { recursive: true });

    for (const level of LEVELS) {
      const expression = parseLevel(c.levels[level]);
      const prompt = rendererExpressionToPrompt(expression);
      const outPng = path.join(caseDir, `${level}.png`);
      const outJson = path.join(caseDir, `${level}-expression.json`);

      await writeFile(
        outJson,
        JSON.stringify(
          {
            caseId: c.id,
            level,
            intentSummary: c.intentSummary,
            expression,
            prompt,
            promptLen: prompt.length,
          },
          null,
          2
        )
      );

      console.log(`[render] ${c.id} / ${level} promptLen=${prompt.length}`);
      const rendered = await renderExpression({
        provider,
        expression,
        seed,
        size,
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

      arms.push({
        caseId: c.id,
        level,
        promptLen: prompt.length,
        ok: rendered.ok && !blank,
        bytes: rendered.bytes,
        ms: rendered.ms,
        blank,
        mean,
        std,
        error: rendered.error,
        expression,
        prompt,
        pngRel: path.relative(SPIKE_DIR, outPng),
      });

      console.log(
        `[done] ${c.id}/${level} ok=${rendered.ok} blank=${blank} bytes=${rendered.bytes} ms=${rendered.ms}`
      );
    }
  }

  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(
      {
        model,
        seed,
        size,
        generatedAt: new Date().toISOString(),
        arms: arms.map(({ expression, prompt, ...rest }) => ({
          ...rest,
          expression,
          prompt,
        })),
      },
      null,
      2
    )
  );

  const findings = `# Expression Minimality Spike — Findings

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Model:** \`${model}\` · seed=${seed} · size=${size}²  
**Boundary:** Expression density only (ADR-011). No Planner / Adapter / Port / Cloud.

## Question

What is the minimum Renderer Expression needed for reliable Local execution?

## Density levels

| Level | Meaning |
| ----- | ------- |
| **full** | Current-style detailed Expression (+ lighting / styleHints) |
| **minimal** | Minimum sufficient visible geometry (who / prop / facing) |
| **compressed** | Over-compressed lower bound (role + abstract action) |

## Prompt length (efficiency)

| Case | full | minimal | compressed |
| ---- | ---- | ------- | ---------- |
${fixtures.cases
  .map((c) => {
    const row = LEVELS.map((l) => {
      const a = arms.find((x) => x.caseId === c.id && x.level === l);
      return String(a?.promptLen ?? "?");
    });
    return `| ${c.id} | ${row.join(" | ")} |`;
  })
  .join("\n")}

## Blank / transport success

| Case | full | minimal | compressed |
| ---- | ---- | ------- | ---------- |
${fixtures.cases
  .map((c) => {
    const row = LEVELS.map((l) => {
      const a = arms.find((x) => x.caseId === c.id && x.level === l);
      if (!a) return "?";
      if (!a.ok && a.blank) return "BLANK";
      if (!a.ok) return `FAIL: ${a.error ?? "?"}`;
      return `ok (${a.bytes}b)`;
    });
    return `| ${c.id} | ${row.join(" | ")} |`;
  })
  .join("\n")}

## Visual scorecard (fill after human review)

Score 0–2 for character completeness; Y/N relationship readable.

| Case | Metric | full | minimal | compressed |
| ---- | ------ | ---- | ------- | ---------- |
| case-duel | chars present | | | |
| case-duel | confrontation readable | | | |
| case-throat | chars present | | | |
| case-throat | dominance readable | | | |
| case-camp | chars present | | | |
| case-camp | discussion readable | | | |

## Recommendation (check one)

- [ ] **A** Minimal wins → adopt Expression Minimality Rule in propose
- [ ] **B** Full wins → keep current detail level
- [ ] **C** Scene-type dependent density → generation rule only (not Adapter)

## Artifacts

- Fixtures: \`scripts/expression-minimality-spike/fixtures.json\`
- PNGs: \`scripts/expression-minimality-spike/results/<case>/{full,minimal,compressed}.png\`
- Summary: \`scripts/expression-minimality-spike/results/summary.json\`
`;

  await mkdir(path.dirname(FINDINGS_PATH), { recursive: true });
  await writeFile(FINDINGS_PATH, findings);
  console.log(`Wrote ${FINDINGS_PATH}`);
  console.log(`Results under ${RESULTS_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
