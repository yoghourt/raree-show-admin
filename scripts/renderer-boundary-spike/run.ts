/**
 * Renderer Boundary Validation spike.
 *
 * Same LocalAI model + seed + Visual Intent; only prompt variant changes.
 *
 *   npx tsx scripts/renderer-boundary-spike/run.ts
 */

import { mkdir, writeFile, access } from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadEnvLocal } from "../load-env-local"
import { createImageGenerationProvider } from "../../lib/ai/image/factory"
import { ensureUndiciProxyDispatcherForGemini } from "../../lib/ai/undici-proxy-bootstrap"

import { buildAllVariants, type VisualIntent } from "./variants"

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.join(SPIKE_DIR, "results")

type SceneFixture = {
  id: string
  label: string
  source: string
  required: Record<string, unknown>
  visualIntent: VisualIntent
}

type FixturesFile = {
  model: string
  seed: number
  scenes: SceneFixture[]
}

function loadFixtures(): FixturesFile {
  return JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as FixturesFile
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  loadEnvLocal()
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512"
  ensureUndiciProxyDispatcherForGemini()

  const fixtures = loadFixtures()
  const model =
    process.env.SPIKE_LOCAL_MODEL_CURRENT?.trim() || fixtures.model
  const seed = Number(process.env.SPIKE_SEED?.trim() || fixtures.seed) || 42
  const base = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "")
  const onlyVariant = process.env.SPIKE_VARIANT?.trim().toUpperCase()
  const skipExisting =
    process.env.SPIKE_SKIP_EXISTING === "1" ||
    process.env.SPIKE_SKIP_EXISTING === "true"

  console.info("[renderer-boundary] start", {
    model,
    seed,
    base,
    scenes: fixtures.scenes.map((s) => s.id),
  })

  const provider = createImageGenerationProvider(
    "localai",
    {
      acceptModelId: model,
      localBaseUrl: base,
      localAiApiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
      skipNetwork: false,
    },
    "accept"
  )

  for (const scene of fixtures.scenes) {
    const sceneDir = path.join(RESULTS_DIR, scene.id)
    await mkdir(sceneDir, { recursive: true })

    await writeFile(
      path.join(sceneDir, "visual-intent.json"),
      `${JSON.stringify(
        { source: scene.source, required: scene.required, visualIntent: scene.visualIntent },
        null,
        2
      )}\n`
    )

    const variants = buildAllVariants(scene.source, scene.visualIntent).filter(
      (v) => !onlyVariant || v.id === onlyVariant
    )

    for (const v of variants) {
      const basename = `variant-${v.id}`
      const pngPath = path.join(sceneDir, `${basename}.png`)
      const promptPath = path.join(sceneDir, `${basename}.prompt.txt`)

      await writeFile(promptPath, `${v.prompt}\n`, "utf8")

      if (skipExisting && (await exists(pngPath))) {
        console.info("[renderer-boundary] skip", { scene: scene.id, variant: v.id })
        continue
      }

      console.info("[renderer-boundary] generate", {
        scene: scene.id,
        variant: v.id,
        label: v.label,
        promptLen: v.prompt.length,
      })

      const t0 = Date.now()
      const result = await provider.generate({
        prompt: v.prompt,
        size: { width: 512, height: 512 },
        seed,
        assetSlot: "scene_frame",
      })
      const latencyMs = Date.now() - t0
      await writeFile(pngPath, result.bytes)
      await writeFile(
        path.join(sceneDir, `${basename}.json`),
        `${JSON.stringify(
          {
            sceneId: scene.id,
            variant: v.id,
            label: v.label,
            modelId: result.meta.modelId,
            seed,
            latencyMs,
            bytes: result.bytes.length,
            promptLen: v.prompt.length,
            promptFile: promptPath,
            outputFile: pngPath,
            at: new Date().toISOString(),
          },
          null,
          2
        )}\n`
      )
      console.info("[renderer-boundary] ok", {
        scene: scene.id,
        variant: v.id,
        latencyMs,
        bytes: result.bytes.length,
      })
    }
  }

  console.info("[renderer-boundary] done →", RESULTS_DIR)
}

main().catch((err) => {
  console.error("[renderer-boundary] failed", err)
  process.exitCode = 1
})
