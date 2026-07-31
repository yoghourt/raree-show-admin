/**
 * Spike: Renderer Expression Capability Adaptation v2
 *
 * Improves Discovery Expression rules only (no Planner / Adapter / Port change).
 * Compares baseline (prior hard Expressions) vs Discovery-adapted Expression
 * on the same Local model / seed / 512².
 *
 *   npx tsx scripts/capability-adaptation-v2-spike/run.ts
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "../load-env-local";
import { createImageGenerationProvider } from "../../lib/ai/image/factory";
import { ensureUndiciProxyDispatcherForGemini } from "../../lib/ai/undici-proxy-bootstrap";
import { callDiscoveryTextLlm } from "../../lib/discovery/discovery-text-llm";
import {
  EXPRESSION_CAPABILITY_RULES,
  findForbiddenPhysicsCues,
} from "../../lib/discovery/expression-capability-rules";
import {
  parseRendererExpression,
  rendererExpressionToPrompt,
  type RendererExpression,
} from "../../lib/discovery/visual-contract";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");
const FINDINGS_PATH = path.join(
  path.resolve(SPIKE_DIR, "../../docs/findings"),
  "capability-adaptation-v2-spike.md"
);

type CaseFixture = {
  id: string;
  label: string;
  intentSummary: string;
  source: string;
  baselineExpression: RendererExpression;
};

type Fixtures = {
  model: string;
  seed: number;
  discoveryModel: string;
  size: number;
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

function parseAdaptedExpression(raw: string): RendererExpression {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned) as { rendererExpression?: unknown };
  const body = parsed.rendererExpression ?? parsed;
  const result = parseRendererExpression(body);
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
  const physics = findForbiddenPhysicsCues(result.value);
  if (physics.length) {
    throw new Error(
      `Adapted Expression has forbidden physics cues (A4): ${physics.join(", ")}`
    );
  }
  return result.value;
}

async function discoverAdaptedExpression(input: {
  source: string;
  intentSummary: string;
}): Promise<{ expression: RendererExpression; raw: string; ms: number }> {
  const started = Date.now();
  const prompt = `You are Discovery Copilot emitting ONLY Renderer Expression for Local image models.
Return ONLY JSON (no markdown):
{"rendererExpression":{"environment":"","characters":[{"role":"","visual":""}],"action":"","composition":""}}
English only.

${EXPRESSION_CAPABILITY_RULES}

Narrative beat:
${input.source}

Visual Intent cue (meaning only — do NOT render Intent wording):
${input.intentSummary}

Emit rendererExpression Local SD can execute (visible geometry; if two roles, both full bodies visible).`;

  const raw = await callDiscoveryTextLlm(prompt, { geminiJsonObject: true });
  return {
    expression: parseAdaptedExpression(raw),
    raw,
    ms: Date.now() - started,
  };
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
  ensureUndiciProxyDispatcherForGemini();
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512";

  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as Fixtures;

  const model =
    process.env.SPIKE_LOCAL_MODEL_CURRENT?.trim() || fixtures.model;
  const seed = Number(process.env.SPIKE_SEED?.trim() || fixtures.seed) || 42;
  const size = Number(process.env.SPIKE_SIZE?.trim() || fixtures.size) || 512;
  const discoveryModel =
    process.env.SPIKE_DISCOVERY_MODEL?.trim() || fixtures.discoveryModel;
  const base = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "");
  const onlyCase = process.env.SPIKE_CASE?.trim();
  const skipExisting =
    process.env.SPIKE_SKIP_EXISTING === "1" ||
    process.env.SPIKE_SKIP_EXISTING === "true";

  console.info("[capability-adapt-v2] start", {
    model,
    seed,
    size,
    discoveryModel,
    base,
  });

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
  const summary: unknown[] = [];

  for (const c of fixtures.cases) {
    if (onlyCase && c.id !== onlyCase) continue;
    const caseDir = path.join(RESULTS_DIR, c.id);
    await mkdir(caseDir, { recursive: true });

    const baselinePath = path.join(caseDir, "baseline.png");
    const adaptedPath = path.join(caseDir, "adapted.png");
    const adaptedJsonPath = path.join(caseDir, "adapted-expression.json");

    await writeFile(
      path.join(caseDir, "baseline-expression.json"),
      JSON.stringify(c.baselineExpression, null, 2)
    );

    let adapted = c.baselineExpression;
    if (!(skipExisting && (await exists(adaptedJsonPath)))) {
      console.info("[capability-adapt-v2] discover", { case: c.id });
      const discovered = await discoverAdaptedExpression({
        source: c.source,
        intentSummary: c.intentSummary,
      });
      adapted = discovered.expression;
      await writeFile(
        adaptedJsonPath,
        JSON.stringify(
          {
            discoveryMs: discovered.ms,
            rendererExpression: adapted,
            rawPreview: discovered.raw.slice(0, 2000),
          },
          null,
          2
        )
      );
    } else {
      const saved = JSON.parse(readFileSync(adaptedJsonPath, "utf8")) as {
        rendererExpression: RendererExpression;
      };
      adapted = saved.rendererExpression;
    }

    const arms: Array<{
      name: "baseline" | "adapted";
      expression: RendererExpression;
      out: string;
    }> = [
      {
        name: "baseline",
        expression: c.baselineExpression,
        out: baselinePath,
      },
      { name: "adapted", expression: adapted, out: adaptedPath },
    ];

    const renders: Record<string, unknown> = {};
    for (const arm of arms) {
      if (skipExisting && (await exists(arm.out))) {
        console.info("[capability-adapt-v2] skip existing", {
          case: c.id,
          arm: arm.name,
        });
        renders[arm.name] = { skipped: true, path: arm.out };
        continue;
      }
      console.info("[capability-adapt-v2] render", {
        case: c.id,
        arm: arm.name,
        promptLen: rendererExpressionToPrompt(arm.expression).length,
      });
      const result = await renderExpression({
        provider,
        expression: arm.expression,
        seed,
        size,
        outPng: arm.out,
      });
      renders[arm.name] = { ...result, path: arm.out };
      console.info("[capability-adapt-v2] done", {
        case: c.id,
        arm: arm.name,
        ...result,
      });
    }

    summary.push({
      id: c.id,
      label: c.label,
      intentSummary: c.intentSummary,
      baselineExpression: c.baselineExpression,
      adaptedExpression: adapted,
      renders,
    });
  }

  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify({ model, seed, size, discoveryModel, cases: summary }, null, 2)
  );

  const findings = `# Capability Adaptation v2 — Findings

**Date:** ${new Date().toISOString().slice(0, 10)}
**Model:** \`${model}\` · seed=${seed} · size=${size}²
**Discovery:** \`${discoveryModel}\`
**Boundary:** Discovery Expression rules only (ADR-011). No Planner / Adapter / Port change.

## Question

Can Discovery better express the same story so Local Renderer can execute difficult relationship/action scenes?

## Cases

${summary
  .map((s) => {
    const row = s as {
      id: string;
      label: string;
      baselineExpression: RendererExpression;
      adaptedExpression: RendererExpression;
      renders: Record<string, { ok?: boolean; error?: string; skipped?: boolean }>;
    };
    return `### ${row.id} — ${row.label}

**Baseline action:** ${row.baselineExpression.action}

**Adapted action:** ${row.adaptedExpression.action}

**Adapted composition:** ${row.adaptedExpression.composition}

| Arm | Result |
| --- | --- |
| baseline | ${row.renders.baseline?.skipped ? "skipped" : row.renders.baseline?.ok ? "ok" : row.renders.baseline?.error ?? "fail"} |
| adapted | ${row.renders.adapted?.skipped ? "skipped" : row.renders.adapted?.ok ? "ok" : row.renders.adapted?.error ?? "fail"} |

Images: \`scripts/capability-adaptation-v2-spike/results/${row.id}/baseline.png\` · \`adapted.png\`
`;
  })
  .join("\n")}

## Manual scorecard (fill after viewing PNGs)

| Case | Char completeness B→A | Relationship readable B→A | Style consistent | Notes |
| ---- | --------------------- | ------------------------- | ---------------- | ----- |
| case-duel | ? | ? | ? | |
| case-throat | ? | ? | ? | |
| case-camp | ? | ? | ? | |

## Recommendation (choose one)

- [ ] **A** Continue Expression capability adaptation
- [ ] **B** Local capability boundary reached
- [ ] **C** Contract needs change

## Production change shipped with this spike

- \`lib/discovery/expression-capability-rules.ts\` — Rules 1–4
- \`lib/discovery/propose-service.ts\` — scene propose injects the same rules
`;

  await mkdir(path.dirname(FINDINGS_PATH), { recursive: true });
  await writeFile(FINDINGS_PATH, findings);
  console.info("[capability-adapt-v2] wrote", {
    summary: path.join(RESULTS_DIR, "summary.json"),
    findings: FINDINGS_PATH,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
