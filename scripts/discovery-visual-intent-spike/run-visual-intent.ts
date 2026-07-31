/**
 * Experiment B: Discovery Visual Intent → adapter → Local renderer.
 *
 *   npx tsx scripts/discovery-visual-intent-spike/run-visual-intent.ts
 */

import path from "node:path"

import { visualIntentToRendererPrompt } from "./adapter"
import {
  DISCOVERY_MODEL,
  LOCAL_MODEL,
  RESULTS_DIR,
  bootstrapSpikeEnv,
  ensureSceneDir,
  fileExists,
  generateLocalImage,
  loadFixtures,
  loadOrCreateBundle,
  localaiBaseUrl,
  logStep,
  writeImageResult,
  writeJson,
} from "./shared"

async function main(): Promise<void> {
  bootstrapSpikeEnv()
  const { workTitle, scenes } = loadFixtures()
  const skipExisting =
    process.env.SPIKE_SKIP_EXISTING === "1" ||
    process.env.SPIKE_SKIP_EXISTING === "true"

  logStep("visual-intent start", {
    discoveryModel: DISCOVERY_MODEL,
    renderModel: LOCAL_MODEL,
    base: localaiBaseUrl(),
    resultsDir: RESULTS_DIR,
  })

  for (const scene of scenes) {
    const sceneDir = await ensureSceneDir(scene.id)
    const outPng = path.join(sceneDir, "visual-intent.png")
    if (skipExisting && (await fileExists(outPng))) {
      logStep("visual-intent skip", { scene: scene.id })
      continue
    }

    const { bundle, latencyMs: discoveryMs, cached } = await loadOrCreateBundle(
      sceneDir,
      workTitle,
      scene.source
    )
    const prompt = visualIntentToRendererPrompt(bundle.visualIntent)

    await writeJson(path.join(sceneDir, "adapter-prompt.json"), {
      sceneId: scene.id,
      visualIntent: bundle.visualIntent,
      rendererPrompt: prompt,
      promptLen: prompt.length,
    })

    logStep("visual-intent render", {
      scene: scene.id,
      discoveryMs,
      cached,
      promptLen: prompt.length,
    })

    const t0 = Date.now()
    const result = await generateLocalImage({ prompt, seed: 42 })
    const renderMs = Date.now() - t0
    const { filePath, bytes } = await writeImageResult(
      sceneDir,
      "visual-intent",
      result
    )
    await writeJson(path.join(sceneDir, "visual-intent.json"), {
      pathId: "visual-intent",
      sceneId: scene.id,
      modelId: `${DISCOVERY_MODEL}+${result.meta.modelId}`,
      providerId: `discovery-vi+${result.meta.providerId}`,
      latencyMs: discoveryMs + renderMs,
      discoveryMs,
      renderMs,
      costUsdEst: 0.001,
      promptUsed: prompt,
      outputFile: filePath,
      bytes,
      at: new Date().toISOString(),
    })
    logStep("visual-intent ok", {
      scene: scene.id,
      renderMs,
      bytes,
      file: filePath,
    })
  }

  logStep("visual-intent done")
}

main().catch((err) => {
  console.error("[discovery-vi-spike] visual-intent failed", err)
  process.exitCode = 1
})
