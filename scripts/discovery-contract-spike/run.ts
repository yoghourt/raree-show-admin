/**
 * Discovery Visual Expression Contract Validation.
 *
 * Discovery emits Visual Intent + Renderer Expression per candidate contract.
 * Renderer consumes Expression only.
 *
 *   npx tsx scripts/discovery-contract-spike/run.ts
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
  rendererExpressionToPrompt,
  validateContract,
  type DiscoveryVisualContract,
} from "./contract"

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.join(SPIKE_DIR, "results")

type Case = { id: string; label: string; source: string }
type Fixtures = {
  model: string
  seed: number
  discoveryModel: string
  cases: Case[]
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function parseContract(raw: string): DiscoveryVisualContract {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
  const parsed = JSON.parse(cleaned) as DiscoveryVisualContract
  return {
    visualIntent: {
      characters: Array.isArray(parsed.visualIntent?.characters)
        ? parsed.visualIntent.characters.map((c) => ({
            role: String(c?.role ?? ""),
            name: c?.name ? String(c.name) : undefined,
          }))
        : [],
      relationship: String(parsed.visualIntent?.relationship ?? ""),
      purpose: parsed.visualIntent?.purpose
        ? String(parsed.visualIntent.purpose)
        : undefined,
      emotion: parsed.visualIntent?.emotion
        ? String(parsed.visualIntent.emotion)
        : undefined,
    },
    rendererExpression: {
      environment: String(parsed.rendererExpression?.environment ?? ""),
      characters: Array.isArray(parsed.rendererExpression?.characters)
        ? parsed.rendererExpression.characters.map((c) => ({
            role: String(c?.role ?? ""),
            visual: String(c?.visual ?? ""),
          }))
        : [],
      action: String(parsed.rendererExpression?.action ?? ""),
      composition: String(parsed.rendererExpression?.composition ?? ""),
      lighting: parsed.rendererExpression?.lighting
        ? String(parsed.rendererExpression.lighting)
        : undefined,
    },
  }
}

async function discoverContract(opts: {
  source: string
  model: string
}): Promise<{ contract: DiscoveryVisualContract; latencyMs: number; raw: string }> {
  const prompt = `You are Raree Discovery. Output a Discovery Visual Contract for one narrative moment.

Source: ${opts.source}

Return ONLY JSON with exactly this shape:
{
  "visualIntent": {
    "characters": [{ "role": "", "name": "" }],
    "relationship": "",
    "purpose": "",
    "emotion": ""
  },
  "rendererExpression": {
    "environment": "",
    "characters": [{ "role": "", "visual": "" }],
    "action": "",
    "composition": "",
    "lighting": ""
  }
}

HARD RULES — ownership:
- visualIntent = narrative MEANING only (roles, relationship, purpose, emotion).
  FORBIDDEN in visualIntent: camera, foreground/background, prompt style, composition wording.
- rendererExpression = VISIBLE execution only (environment, poses, props, spatial arrangement).
  FORBIDDEN in rendererExpression: abstract-only relationship words as the sole action
  (do not write only "protects" / "comforts" — show poses/objects).
- Preserve story meaning; do not invent a different story.
- Keep fields short. lighting is optional — omit empty string if unused.
- No markdown.`

  const t0 = Date.now()
  const raw = await callCopilotTextLlm(prompt, {
    provider: "gemini",
    model: opts.model,
    geminiJsonObject: true,
  })
  return {
    contract: parseContract(raw),
    latencyMs: Date.now() - t0,
    raw,
  }
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

  console.info("[discovery-contract] start", { discoveryModel, renderModel, seed })

  const summary: unknown[] = []

  for (const c of fixtures.cases) {
    const caseDir = path.join(RESULTS_DIR, c.id)
    await mkdir(caseDir, { recursive: true })

    const contractPath = path.join(caseDir, "contract.json")
    let contract: DiscoveryVisualContract
    let discoveryMs = 0

    if (await exists(contractPath)) {
      const cached = JSON.parse(await readFile(contractPath, "utf8")) as {
        contract: DiscoveryVisualContract
        discoveryMs?: number
      }
      contract = cached.contract
      discoveryMs = cached.discoveryMs ?? 0
      console.info("[discovery-contract] cached", { case: c.id })
    } else {
      const { contract: ct, latencyMs, raw } = await discoverContract({
        source: c.source,
        model: discoveryModel,
      })
      contract = ct
      discoveryMs = latencyMs
      await writeFile(
        contractPath,
        `${JSON.stringify(
          {
            caseId: c.id,
            source: c.source,
            discoveryModel,
            discoveryMs,
            contract,
            rawPreview: raw.slice(0, 1600),
          },
          null,
          2
        )}\n`
      )
      console.info("[discovery-contract] discovered", { case: c.id, discoveryMs })
    }

    const validation = validateContract(contract)
    await writeFile(
      path.join(caseDir, "validation.json"),
      `${JSON.stringify(validation, null, 2)}\n`
    )

    // Renderer consumes Expression ONLY — Intent not sent to image model
    const prompt = rendererExpressionToPrompt(contract.rendererExpression)
    await writeFile(
      path.join(caseDir, "renderer-input.json"),
      `${JSON.stringify(
        {
          consumed: "rendererExpression only",
          notConsumed: "visualIntent",
          rendererExpression: contract.rendererExpression,
          prompt,
        },
        null,
        2
      )}\n`
    )

    const png = path.join(caseDir, "from-expression.png")
    let renderMs = 0
    let bytes = 0
    if (skipExisting && (await exists(png))) {
      console.info("[discovery-contract] skip render", { case: c.id })
    } else if (!validation.ok) {
      console.warn("[discovery-contract] skip render — invalid contract", {
        case: c.id,
        errors: validation.errors,
      })
    } else {
      console.info("[discovery-contract] render", {
        case: c.id,
        promptLen: prompt.length,
      })
      const t0 = Date.now()
      const result = await provider.generate({
        prompt,
        size: { width: 512, height: 512 },
        seed,
        assetSlot: "scene_frame",
      })
      renderMs = Date.now() - t0
      bytes = result.bytes.length
      await writeFile(png, result.bytes)
      await writeFile(
        path.join(caseDir, "render.json"),
        `${JSON.stringify(
          {
            caseId: c.id,
            renderMs,
            bytes,
            modelId: result.meta.modelId,
            seed,
            at: new Date().toISOString(),
          },
          null,
          2
        )}\n`
      )
      console.info("[discovery-contract] ok", { case: c.id, renderMs, bytes })
    }

    summary.push({
      caseId: c.id,
      source: c.source,
      validation,
      discoveryMs,
      renderMs,
      bytes,
      intentRelationship: contract.visualIntent.relationship,
      expressionAction: contract.rendererExpression.action,
      expressionComposition: contract.rendererExpression.composition,
    })
  }

  await writeFile(
    path.join(RESULTS_DIR, "summary.json"),
    `${JSON.stringify({ at: new Date().toISOString(), summary }, null, 2)}\n`
  )
  console.info("[discovery-contract] done →", RESULTS_DIR)
}

main().catch((err) => {
  console.error("[discovery-contract] failed", err)
  process.exitCode = 1
})
