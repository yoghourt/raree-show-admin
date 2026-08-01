/**
 * Spike: Renderer Model Qualification
 *
 * Fixed Renderer Expression × swap Local models only.
 * No Expression / ADR / SPEC / Planner / Cloud changes.
 *
 *   npx tsx scripts/renderer-model-qualification-spike/run.ts
 *
 * Optional:
 *   SPIKE_MODEL_IDS=baseline,candidate-a   # subset
 *   SPIKE_SKIP_EXISTING=1
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
  "renderer-model-qualification-spike.md"
);

type CaseFixture = {
  id: string;
  label: string;
  expression: unknown;
};

type ModelFixture = {
  id: string;
  label: string;
  providerId: "localai" | "local";
  modelId: string;
  family: string;
  baseUrlEnv?: string;
  defaultBaseUrl?: string;
};

type Fixtures = {
  seed: number;
  size: number;
  cases: CaseFixture[];
  models: ModelFixture[];
};

type ArmRow = {
  caseId: string;
  modelSlot: string;
  providerId: string;
  modelId: string;
  promptLen: number;
  ok: boolean;
  blank: boolean;
  bytes: number;
  ms: number;
  mean?: number;
  std?: number;
  error?: string;
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

function createProvider(m: ModelFixture) {
  if (m.providerId === "localai") {
    const base = (
      process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
    ).replace(/\/$/, "");
    return createImageGenerationProvider(
      "localai",
      {
        acceptModelId: m.modelId,
        localBaseUrl: base,
        localAiApiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
        skipNetwork: false,
      },
      "accept"
    );
  }
  const envKey = m.baseUrlEnv || "IMAGE_CREATOR_LOCAL_BASE";
  const base = (
    process.env[envKey]?.trim() ||
    m.defaultBaseUrl ||
    "http://127.0.0.1:8191"
  ).replace(/\/$/, "");
  return createImageGenerationProvider(
    "local",
    {
      acceptModelId: m.modelId,
      localBaseUrl: base,
      skipNetwork: false,
    },
    "accept"
  );
}

async function probeModel(m: ModelFixture): Promise<string | null> {
  try {
    if (m.providerId === "localai") {
      const base = (
        process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() ||
        "http://127.0.0.1:8080"
      ).replace(/\/$/, "");
      const res = await fetch(`${base}/v1/models`);
      if (!res.ok) return `LocalAI HTTP ${res.status}`;
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      const ids = new Set((json.data ?? []).map((d) => d.id).filter(Boolean));
      if (!ids.has(m.modelId)) {
        return `model ${m.modelId} not in LocalAI catalog: ${[...ids].join(", ")}`;
      }
      return null;
    }
    const envKey = m.baseUrlEnv || "IMAGE_CREATOR_LOCAL_BASE";
    const base = (
      process.env[envKey]?.trim() ||
      m.defaultBaseUrl ||
      "http://127.0.0.1:8191"
    ).replace(/\/$/, "");
    const res = await fetch(`${base}/docs`);
    if (!res.ok && res.status !== 200) {
      // /docs may 200; also try root
    }
    const health = await fetch(`${base}/docs`).catch(() => null);
    if (!health) return `SDXL local server unreachable at ${base}`;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512";

  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as Fixtures;

  const seed = Number(process.env.SPIKE_SEED ?? fixtures.seed) || 42;
  const size = Number(process.env.SPIKE_SIZE ?? fixtures.size) || 512;
  const skipExisting =
    process.env.SPIKE_SKIP_EXISTING === "1" ||
    process.env.SPIKE_SKIP_EXISTING === "true";
  const only = new Set(
    (process.env.SPIKE_MODEL_IDS?.trim() || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const models = fixtures.models.filter((m) => !only.size || only.has(m.id));
  await mkdir(RESULTS_DIR, { recursive: true });

  // Parse expressions once — identical prompt across models
  const cases: Array<{
    id: string;
    label: string;
    expression: RendererExpression;
    prompt: string;
  }> = [];
  for (const c of fixtures.cases) {
    const parsed = parseRendererExpression(c.expression);
    if (!parsed.ok) throw new Error(`${c.id}: ${parsed.errors.join("; ")}`);
    cases.push({
      id: c.id,
      label: c.label,
      expression: parsed.value,
      prompt: rendererExpressionToPrompt(parsed.value),
    });
  }

  await writeFile(
    path.join(RESULTS_DIR, "fixed-prompts.json"),
    JSON.stringify(
      cases.map((c) => ({
        id: c.id,
        label: c.label,
        expression: c.expression,
        prompt: c.prompt,
        promptLen: c.prompt.length,
      })),
      null,
      2
    )
  );

  const rows: ArmRow[] = [];
  const skipped: Array<{ modelSlot: string; reason: string }> = [];

  for (const m of models) {
    const probe = await probeModel(m);
    if (probe) {
      console.warn(`[skip] ${m.id}: ${probe}`);
      skipped.push({ modelSlot: m.id, reason: probe });
      continue;
    }

    const provider = createProvider(m);
    console.info(`[model] ${m.id} ${m.providerId}/${m.modelId}`);

    for (const c of cases) {
      const outDir = path.join(RESULTS_DIR, c.id);
      await mkdir(outDir, { recursive: true });
      const outPng = path.join(outDir, `${m.id}.png`);
      const pngRel = path.relative(SPIKE_DIR, outPng);

      if (skipExisting && (await exists(outPng))) {
        const a = await assessBlank(outPng);
        const st = await import("node:fs/promises").then((fs) =>
          fs.stat(outPng)
        );
        rows.push({
          caseId: c.id,
          modelSlot: m.id,
          providerId: m.providerId,
          modelId: m.modelId,
          promptLen: c.prompt.length,
          ok: !a.blank,
          blank: a.blank,
          bytes: st.size,
          ms: 0,
          mean: a.mean,
          std: a.std,
          pngRel,
        });
        console.log(`[skip-existing] ${c.id}/${m.id} blank=${a.blank}`);
        continue;
      }

      console.log(`[render] ${c.id} × ${m.id} promptLen=${c.prompt.length}`);
      const started = Date.now();
      try {
        const result = await provider.generate({
          prompt: c.prompt,
          seed,
          size: { width: size, height: size },
          assetSlot: "scene_frame",
          negativePrompt:
            "blank, blank canvas, solid white, text, watermark, collage, split screen",
        });
        await writeFile(outPng, result.bytes);
        const a = await assessBlank(outPng);
        rows.push({
          caseId: c.id,
          modelSlot: m.id,
          providerId: m.providerId,
          modelId: m.modelId,
          promptLen: c.prompt.length,
          ok: !a.blank,
          blank: a.blank,
          bytes: result.bytes.length,
          ms: Date.now() - started,
          mean: a.mean,
          std: a.std,
          pngRel,
        });
        console.log(
          `[done] ${c.id}/${m.id} blank=${a.blank} bytes=${result.bytes.length} ms=${Date.now() - started}`
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        rows.push({
          caseId: c.id,
          modelSlot: m.id,
          providerId: m.providerId,
          modelId: m.modelId,
          promptLen: c.prompt.length,
          ok: false,
          blank: false,
          bytes: 0,
          ms: Date.now() - started,
          error: msg,
          pngRel,
        });
        console.error(`[fail] ${c.id}/${m.id}: ${msg.slice(0, 200)}`);
      }
    }
  }

  const summary = {
    seed,
    size,
    generatedAt: new Date().toISOString(),
    fixedPrompt: true,
    expressionContractUnchanged: true,
    skipped,
    rows,
  };
  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );

  // Draft findings skeleton (human scores filled after image review)
  const modelIds = [...new Set(rows.map((r) => r.modelSlot))];
  const blankTable = fixtures.cases
    .map((c) => {
      const cells = modelIds.map((mid) => {
        const r = rows.find((x) => x.caseId === c.id && x.modelSlot === mid);
        if (!r) return "—";
        if (r.error) return `FAIL`;
        if (r.blank) return "BLANK";
        return `ok (${Math.round(r.ms / 1000)}s)`;
      });
      return `| ${c.id} | ${cells.join(" | ")} |`;
    })
    .join("\n");

  const findings = `# Renderer Model Qualification Spike — Findings

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Question:** Is the current Local Renderer model insufficient for Raree Runtime Truth v1?  
**Boundary:** Fixed Renderer Expression · swap model only · no ADR/SPEC/Expression/Planner/Cloud changes.

## Test setup

| Variable | Value |
| -------- | ----- |
| seed | ${seed} |
| size | ${size}² |
| prompt | \`rendererExpressionToPrompt\` (identical per case) |
| machine path | LocalAI \`:8080\` · Diffusers \`:8191\` (Candidate A) |
| baseline | \`sd-3.5-medium-ggml\` |
| candidate A | \`sdxl-turbo\` (SDXL family) |
| candidate B | \`flux.2-klein-4b\` (stronger semantic LocalAI) |
| candidate C | **not run** — DreamShaper/RealVis class not installed locally |

Fixed Expressions: \`scripts/renderer-model-qualification-spike/fixtures.json\`  
Prompts: \`results/fixed-prompts.json\`

Skipped probes:

${skipped.length ? skipped.map((s) => `- \`${s.modelSlot}\`: ${s.reason}`).join("\n") : "- (none)"}

## Blank / transport reliability

| Case | ${modelIds.join(" | ")} |
| ---- | ${modelIds.map(() => "---").join(" | ")} |
${blankTable}

## Cost / local feasibility

| Model slot | provider | modelId | mean ms (ok arms) |
| ---------- | -------- | ------- | ----------------- |
${modelIds
  .map((mid) => {
    const ok = rows.filter((r) => r.modelSlot === mid && !r.error && r.ms > 0);
    const mean =
      ok.length > 0
        ? Math.round(ok.reduce((s, r) => s + r.ms, 0) / ok.length)
        : "—";
    const sample = rows.find((r) => r.modelSlot === mid);
    return `| ${mid} | ${sample?.providerId ?? "?"} | \`${sample?.modelId ?? "?"}\` | ${mean} |`;
  })
  .join("\n")}

## Visual scorecard (fill after human review)

Score 0–2 character completeness; Y/N relationship / face stability.

| Case | Metric | baseline | candidate-a | candidate-b |
| ---- | ------ | -------- | ----------- | ----------- |
| case-duel | chars present | | | |
| case-duel | confrontation readable | | | |
| case-duel | face/identity stability | | | |
| case-throat | chars present | | | |
| case-throat | dominance readable | | | |
| case-throat | face/identity stability | | | |
| case-tree | chars present | | | |
| case-tree | vertical relation readable | | | |
| case-tree | face/identity stability | | | |

## Recommendation (check one)

- [ ] **Replace** baseline — another Local model significantly improves blank + face/relationship with acceptable cost
- [ ] **Keep** baseline — gains are cosmetic / cost or consistency not better
- [ ] **Inconclusive** — need Candidate C or more arms

## Artifacts

- PNGs: \`scripts/renderer-model-qualification-spike/results/<case>/{baseline,candidate-a,candidate-b}.png\`
- Summary: \`scripts/renderer-model-qualification-spike/results/summary.json\`
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
