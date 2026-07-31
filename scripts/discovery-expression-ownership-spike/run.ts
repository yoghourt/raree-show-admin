/**
 * Discovery Visual Expression Ownership spike.
 *
 * Option A: Discovery Visual Intent → external adapter → Local
 * Option B: Discovery Visual Intent + rendererExpression (same call) → Local
 *
 *   npx tsx scripts/discovery-expression-ownership-spike/run.ts
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadEnvLocal } from "../load-env-local"
import { callCopilotTextLlm } from "../../lib/ai/copilot-text-llm"
import { createImageGenerationProvider } from "../../lib/ai/image/factory"
import { ensureUndiciProxyDispatcherForGemini } from "../../lib/ai/undici-proxy-bootstrap"

import {
  externalAdaptFromIntent,
  type VisualIntent,
} from "./adapter-a"

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.join(SPIKE_DIR, "results")

type Case = {
  id: string
  label: string
  source: string
  intentFocus: string
}

type Fixtures = {
  model: string
  seed: number
  discoveryModel: string
  cases: Case[]
}

type RendererExpression = {
  characters: string[]
  environment: string
  composition: string
  action?: string
}

type DiscoveryBundle = {
  visualIntent: VisualIntent
  rendererExpression: RendererExpression
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function expressionToPrompt(expr: RendererExpression): {
  expression: string
  prompt: string
} {
  const cast = (expr.characters ?? []).filter(Boolean).join("; ")
  const parts = [
    cast && `Characters: ${cast}.`,
    expr.action && `Action: ${expr.action}.`,
    expr.environment && `Environment: ${expr.environment}.`,
    expr.composition && `Composition: ${expr.composition}.`,
  ].filter(Boolean)
  const expression = parts.join(" ")
  return {
    expression,
    prompt: `${expression} One cinematic narrative still, clear readable subjects, no text, no watermark.`,
  }
}

function parseDiscovery(raw: string): DiscoveryBundle {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
  const parsed = JSON.parse(cleaned) as {
    visualIntent?: Partial<VisualIntent> & {
      characters?: Array<Partial<VisualIntent["characters"][number]>>
    }
    rendererExpression?: Partial<RendererExpression>
  }
  const vi = parsed.visualIntent ?? {}
  const re = parsed.rendererExpression ?? {}
  return {
    visualIntent: {
      characters: Array.isArray(vi.characters)
        ? vi.characters.map((c) => ({
            name: String(c?.name ?? ""),
            role: String(c?.role ?? ""),
            position: String(c?.position ?? ""),
          }))
        : [],
      relationship: String(vi.relationship ?? ""),
      event: String(vi.event ?? ""),
      environment: String(vi.environment ?? ""),
      composition: String(vi.composition ?? ""),
      emotion: String(vi.emotion ?? ""),
    },
    rendererExpression: {
      characters: Array.isArray(re.characters)
        ? re.characters.map(String)
        : [],
      environment: String(re.environment ?? ""),
      composition: String(re.composition ?? ""),
      action: re.action ? String(re.action) : undefined,
    },
  }
}

async function discoverBundle(opts: {
  source: string
  model: string
}): Promise<{ bundle: DiscoveryBundle; latencyMs: number; raw: string }> {
  const prompt = `You are Raree Discovery. From one narrative moment, output BOTH:
1) visualIntent — model-independent story meaning
2) rendererExpression — Local-renderer-compatible VISIBLE expression (poses, objects, places). No abstract relationship words like "protects" or "comforts" as the only cue — show them as observable action.

Source: ${opts.source}

Return ONLY JSON:
{
  "visualIntent": {
    "characters": [{ "name": "", "role": "", "position": "" }],
    "relationship": "",
    "event": "",
    "environment": "",
    "composition": "",
    "emotion": ""
  },
  "rendererExpression": {
    "characters": ["visible figure description", "..."],
    "environment": "visible place",
    "composition": "who is in front/behind, simple framing",
    "action": "visible action with objects/poses"
  }
}

Rules:
- Preserve story meaning; do not invent a different story.
- rendererExpression must be executable by a weak local image model (concrete nouns/verbs).
- Do NOT dump style-token soup. No markdown.`

  const t0 = Date.now()
  const raw = await callCopilotTextLlm(prompt, {
    provider: "gemini",
    model: opts.model,
    geminiJsonObject: true,
  })
  return { bundle: parseDiscovery(raw), latencyMs: Date.now() - t0, raw }
}

async function main(): Promise<void> {
  loadEnvLocal()
  ensureUndiciProxyDispatcherForGemini()
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512"

  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as Fixtures

  const renderModel =
    process.env.SPIKE_LOCAL_MODEL_CURRENT?.trim() || fixtures.model
  const discoveryModel =
    process.env.SPIKE_DISCOVERY_VI_MODEL?.trim() ||
    process.env.DISCOVERY_TEXT_MODEL?.trim() ||
    fixtures.discoveryModel
  const seed = Number(process.env.SPIKE_SEED?.trim() || fixtures.seed) || 42
  const base = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "")
  const skipExisting =
    process.env.SPIKE_SKIP_EXISTING === "1" ||
    process.env.SPIKE_SKIP_EXISTING === "true"
  const onlyCase = process.env.SPIKE_CASE?.trim()

  const provider = createImageGenerationProvider(
    "localai",
    {
      acceptModelId: renderModel,
      localBaseUrl: base,
      localAiApiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
      skipNetwork: false,
    },
    "accept"
  )

  console.info("[discovery-expr-own] start", {
    discoveryModel,
    renderModel,
    seed,
  })

  for (const c of fixtures.cases) {
    if (onlyCase && c.id !== onlyCase) continue
    const caseDir = path.join(RESULTS_DIR, c.id)
    await mkdir(caseDir, { recursive: true })

    const bundlePath = path.join(caseDir, "discovery-bundle.json")
    let bundle: DiscoveryBundle
    let discoveryMs = 0
    if (await exists(bundlePath)) {
      const cached = JSON.parse(await readFile(bundlePath, "utf8")) as {
        bundle: DiscoveryBundle
        latencyMs?: number
      }
      bundle = cached.bundle
      discoveryMs = cached.latencyMs ?? 0
      console.info("[discovery-expr-own] discovery cached", { case: c.id })
    } else {
      const { bundle: b, latencyMs, raw } = await discoverBundle({
        source: c.source,
        model: discoveryModel,
      })
      bundle = b
      discoveryMs = latencyMs
      await writeFile(
        bundlePath,
        `${JSON.stringify(
          {
            caseId: c.id,
            source: c.source,
            discoveryModel,
            latencyMs,
            bundle,
            rawPreview: raw.slice(0, 1500),
          },
          null,
          2
        )}\n`
      )
      console.info("[discovery-expr-own] discovery ok", {
        case: c.id,
        latencyMs,
      })
    }

    // Option A: external adapter from Visual Intent (second hop)
    const optA = externalAdaptFromIntent(bundle.visualIntent)
    await writeFile(
      path.join(caseDir, "option-A.input.json"),
      `${JSON.stringify(
        {
          option: "A",
          path: "Discovery visualIntent → externalAdaptFromIntent → Local",
          visualIntent: bundle.visualIntent,
          expression: optA.expression,
          prompt: optA.prompt,
        },
        null,
        2
      )}\n`
    )

    // Option B: Discovery rendererExpression directly (no second hop)
    const optB = expressionToPrompt(bundle.rendererExpression)
    await writeFile(
      path.join(caseDir, "option-B.input.json"),
      `${JSON.stringify(
        {
          option: "B",
          path: "Discovery rendererExpression → Local (no adapter)",
          visualIntent: bundle.visualIntent,
          rendererExpression: bundle.rendererExpression,
          expression: optB.expression,
          prompt: optB.prompt,
        },
        null,
        2
      )}\n`
    )

    for (const arm of [
      { id: "A" as const, ...optA },
      { id: "B" as const, ...optB },
    ]) {
      const png = path.join(caseDir, `option-${arm.id}.png`)
      if (skipExisting && (await exists(png))) {
        console.info("[discovery-expr-own] skip", { case: c.id, option: arm.id })
        continue
      }
      console.info("[discovery-expr-own] render", {
        case: c.id,
        option: arm.id,
        promptLen: arm.prompt.length,
      })
      const t0 = Date.now()
      const result = await provider.generate({
        prompt: arm.prompt,
        size: { width: 512, height: 512 },
        seed,
        assetSlot: "scene_frame",
      })
      const renderMs = Date.now() - t0
      await writeFile(png, result.bytes)
      await writeFile(
        path.join(caseDir, `option-${arm.id}.json`),
        `${JSON.stringify(
          {
            caseId: c.id,
            option: arm.id,
            discoveryMs,
            renderMs,
            bytes: result.bytes.length,
            modelId: result.meta.modelId,
            seed,
            prompt: arm.prompt,
            at: new Date().toISOString(),
          },
          null,
          2
        )}\n`
      )
      console.info("[discovery-expr-own] ok", {
        case: c.id,
        option: arm.id,
        renderMs,
        bytes: result.bytes.length,
      })
    }
  }

  console.info("[discovery-expr-own] done →", RESULTS_DIR)
}

main().catch((err) => {
  console.error("[discovery-expr-own] failed", err)
  process.exitCode = 1
})
