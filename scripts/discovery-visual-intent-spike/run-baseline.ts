/**
 * Baseline A: Discovery scene fields → current production prompt → Local renderer.
 *
 *   npx tsx scripts/discovery-visual-intent-spike/run-baseline.ts
 */

import path from "node:path"

import {
  DISCOVERY_MODEL,
  LOCAL_MODEL,
  RESULTS_DIR,
  bootstrapSpikeEnv,
  buildBaselinePrompt,
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

  logStep("baseline start", {
    discoveryModel: DISCOVERY_MODEL,
    renderModel: LOCAL_MODEL,
    base: localaiBaseUrl(),
    resultsDir: RESULTS_DIR,
  })

  for (const scene of scenes) {
    const sceneDir = await ensureSceneDir(scene.id)
    const outPng = path.join(sceneDir, "baseline-current.png")
    if (skipExisting && (await fileExists(outPng))) {
      logStep("baseline skip", { scene: scene.id })
      continue
    }

    const { bundle, latencyMs: discoveryMs, cached } = await loadOrCreateBundle(
      sceneDir,
      workTitle,
      scene.source
    )
    const { caption, prompt } = buildBaselinePrompt(bundle.scene)

    logStep("baseline render", {
      scene: scene.id,
      discoveryMs,
      cached,
      caption,
      promptLen: prompt.length,
    })

    const t0 = Date.now()
    const result = await generateLocalImage({ prompt, seed: 42 })
    const renderMs = Date.now() - t0
    const { filePath, bytes } = await writeImageResult(
      sceneDir,
      "baseline-current",
      result
    )
    await writeJson(path.join(sceneDir, "baseline-current.json"), {
      pathId: "baseline-current",
      sceneId: scene.id,
      modelId: result.meta.modelId,
      providerId: result.meta.providerId,
      latencyMs: discoveryMs + renderMs,
      discoveryMs,
      renderMs,
      costUsdEst: 0.001,
      caption,
      promptUsed: prompt,
      outputFile: filePath,
      bytes,
      at: new Date().toISOString(),
    })
    logStep("baseline ok", {
      scene: scene.id,
      renderMs,
      bytes,
      file: filePath,
    })
  }

  logStep("baseline done")
}

main().catch((err) => {
  console.error("[discovery-vi-spike] baseline failed", err)
  process.exitCode = 1
})
