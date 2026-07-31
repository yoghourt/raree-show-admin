/**
 * Renderer Capability Adaptation Validation.
 *
 * Same LocalAI model + seed + Visual Intent; only visual expression changes.
 *
 *   npx tsx scripts/capability-adaptation-spike/run.ts
 */

import { access, mkdir, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadEnvLocal } from "../load-env-local"
import { createImageGenerationProvider } from "../../lib/ai/image/factory"

import { buildVariants, type VisualIntent } from "./adapt"

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.join(SPIKE_DIR, "results")

type Scene = {
  id: string
  label: string
  source: string
  readerQuestion: string
  visualIntent: VisualIntent
}

type Fixtures = { model: string; seed: number; scenes: Scene[] }

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

  const fixtures = JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as Fixtures

  const model =
    process.env.SPIKE_LOCAL_MODEL_CURRENT?.trim() || fixtures.model
  const seed = Number(process.env.SPIKE_SEED?.trim() || fixtures.seed) || 42
  const base = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "")
  const onlyVariant = process.env.SPIKE_VARIANT?.trim().toUpperCase()
  const onlyScene = process.env.SPIKE_SCENE?.trim()
  const skipExisting =
    process.env.SPIKE_SKIP_EXISTING === "1" ||
    process.env.SPIKE_SKIP_EXISTING === "true"

  console.info("[capability-adapt] start", { model, seed, base })

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
    if (onlyScene && scene.id !== onlyScene) continue

    const sceneDir = path.join(RESULTS_DIR, scene.id)
    await mkdir(sceneDir, { recursive: true })
    await writeFile(
      path.join(sceneDir, "visual-intent.json"),
      `${JSON.stringify(
        {
          source: scene.source,
          readerQuestion: scene.readerQuestion,
          visualIntent: scene.visualIntent,
        },
        null,
        2
      )}\n`
    )

    const variants = buildVariants(
      scene.id,
      scene.source,
      scene.visualIntent
    ).filter((v) => !onlyVariant || v.id === onlyVariant)

    for (const v of variants) {
      const baseName = `variant-${v.id}`
      const png = path.join(sceneDir, `${baseName}.png`)
      await writeFile(
        path.join(sceneDir, `${baseName}.expression.txt`),
        `${v.expression}\n`,
        "utf8"
      )
      await writeFile(
        path.join(sceneDir, `${baseName}.prompt.txt`),
        `${v.prompt}\n`,
        "utf8"
      )

      if (skipExisting && (await exists(png))) {
        console.info("[capability-adapt] skip", {
          scene: scene.id,
          variant: v.id,
        })
        continue
      }

      console.info("[capability-adapt] generate", {
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
      await writeFile(png, result.bytes)
      await writeFile(
        path.join(sceneDir, `${baseName}.json`),
        `${JSON.stringify(
          {
            sceneId: scene.id,
            variant: v.id,
            label: v.label,
            modelId: result.meta.modelId,
            seed,
            latencyMs,
            bytes: result.bytes.length,
            expression: v.expression,
            prompt: v.prompt,
            at: new Date().toISOString(),
          },
          null,
          2
        )}\n`
      )
      console.info("[capability-adapt] ok", {
        scene: scene.id,
        variant: v.id,
        latencyMs,
        bytes: result.bytes.length,
      })
    }
  }

  console.info("[capability-adapt] done →", RESULTS_DIR)
}

main().catch((err) => {
  console.error("[capability-adapt] failed", err)
  process.exitCode = 1
})
