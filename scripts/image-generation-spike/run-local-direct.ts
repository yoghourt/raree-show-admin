/**
 * Option A: Local model replacement test.
 * Runs CURRENT LocalAI model + ONE alternative local model.
 *
 *   npx tsx scripts/image-generation-spike/run-local-direct.ts
 *
 * Env:
 *   SPIKE_LOCAL_MODEL_CURRENT     default sd-3.5-medium-ggml (LocalAI)
 *   SPIKE_LOCAL_MODEL_ALT         default sdxl-turbo
 *   SPIKE_LOCAL_ALT_PROVIDER      default local (HTTP :8191); or localai
 *   SPIKE_LOCAL_ONLY=current|alt  optional single arm
 *   SPIKE_SKIP_EXISTING=1         skip if PNG already present
 */

import { access } from "node:fs/promises"
import path from "node:path"

import {
  RESULTS_DIR,
  LOCAL_ALT_PROVIDER,
  LOCAL_MODEL_ALT,
  LOCAL_MODEL_CURRENT,
  bootstrapSpikeEnv,
  ensureSceneDir,
  fullScenePrompt,
  generateLocalImage,
  loadPrompts,
  localaiBaseUrl,
  logStep,
  writeImageResult,
  writeMeta,
} from "./shared"

type Arm = {
  key: "current" | "alt"
  modelId: string
  basename: string
  providerId: "localai" | "local"
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
  bootstrapSpikeEnv()
  const { scenes, styleSuffix } = loadPrompts()
  const only = process.env.SPIKE_LOCAL_ONLY?.trim().toLowerCase()
  const skipExisting =
    process.env.SPIKE_SKIP_EXISTING === "1" ||
    process.env.SPIKE_SKIP_EXISTING === "true"
  const altProvider: Arm["providerId"] =
    LOCAL_ALT_PROVIDER === "localai" ? "localai" : "local"

  const allArms: Arm[] = [
    {
      key: "current",
      modelId: LOCAL_MODEL_CURRENT,
      basename: "local-direct",
      providerId: "localai",
    },
    {
      key: "alt",
      modelId: LOCAL_MODEL_ALT,
      basename: "local-direct-alt",
      providerId: altProvider,
    },
  ]
  const arms = allArms.filter((a) => !only || only === a.key)

  logStep("local-direct start", {
    localai: localaiBaseUrl(),
    arms: arms.map((a) => `${a.key}:${a.providerId}/${a.modelId}`),
    scenes: scenes.length,
    resultsDir: RESULTS_DIR,
  })

  const failures: string[] = []

  for (const scene of scenes) {
    const prompt = fullScenePrompt(scene, styleSuffix)
    const sceneDir = await ensureSceneDir(scene.id)

    for (const arm of arms) {
      const pngPath = path.join(sceneDir, `${arm.basename}.png`)
      if (skipExisting && (await exists(pngPath))) {
        logStep("local-direct skip existing", {
          scene: scene.id,
          arm: arm.key,
          file: pngPath,
        })
        continue
      }

      logStep("local-direct generate", {
        scene: scene.id,
        arm: arm.key,
        provider: arm.providerId,
        model: arm.modelId,
      })
      try {
        const t0 = Date.now()
        const result = await generateLocalImage({
          prompt,
          modelId: arm.modelId,
          providerId: arm.providerId,
          seed: 42,
        })
        const latencyMs = Date.now() - t0
        const { filePath, bytes } = await writeImageResult(
          sceneDir,
          arm.basename,
          result
        )
        await writeMeta(sceneDir, arm.basename, {
          pathId: `local-direct-${arm.key}`,
          sceneId: scene.id,
          modelId: result.meta.modelId,
          providerId: result.meta.providerId,
          latencyMs,
          costUsdEst: 0,
          promptUsed: prompt,
          outputFile: filePath,
          bytes,
          at: new Date().toISOString(),
        })
        logStep("local-direct ok", {
          scene: scene.id,
          arm: arm.key,
          latencyMs,
          bytes,
          file: filePath,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        failures.push(`${scene.id}/${arm.key}: ${msg}`)
        logStep("local-direct arm failed (continuing)", {
          scene: scene.id,
          arm: arm.key,
          error: msg.slice(0, 240),
        })
      }
    }
  }

  if (failures.length) {
    console.error("[image-gen-spike] local-direct partial failures", failures)
    process.exitCode = 1
  } else {
    logStep("local-direct done")
  }
}

main().catch((err) => {
  console.error("[image-gen-spike] local-direct failed", err)
  process.exitCode = 1
})
