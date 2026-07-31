/**
 * Path: Gemini direct image generation (quality reference).
 *
 *   npx tsx scripts/image-generation-spike/run-reference.ts
 */

import {
  RESULTS_DIR,
  bootstrapSpikeEnv,
  ensureSceneDir,
  fullScenePrompt,
  generateCloudReferenceImage,
  GEMINI_IMAGE_MODEL,
  loadPrompts,
  logStep,
  writeImageResult,
  writeMeta,
} from "./shared"

async function main(): Promise<void> {
  bootstrapSpikeEnv()
  const { scenes, styleSuffix } = loadPrompts()
  logStep("reference start", {
    preferredModel: GEMINI_IMAGE_MODEL,
    scenes: scenes.length,
    resultsDir: RESULTS_DIR,
  })

  for (const scene of scenes) {
    const prompt = fullScenePrompt(scene, styleSuffix)
    const sceneDir = await ensureSceneDir(scene.id)
    logStep("reference generate", { scene: scene.id, prompt: scene.prompt })

    const t0 = Date.now()
    const result = await generateCloudReferenceImage({ prompt })
    const latencyMs = Date.now() - t0
    // Keep filename stable for manual comparison even if SiliconFlow fallback.
    const { filePath, bytes } = await writeImageResult(
      sceneDir,
      "gemini-reference",
      result
    )
    await writeMeta(sceneDir, "gemini-reference", {
      pathId: "reference",
      sceneId: scene.id,
      modelId: result.meta.modelId,
      providerId: `${result.meta.providerId}:${result.referenceSource}`,
      latencyMs,
      costUsdEst: result.meta.costUsdEst ?? 0.04,
      promptUsed: prompt,
      outputFile: filePath,
      bytes,
      at: new Date().toISOString(),
    })
    logStep("reference ok", {
      scene: scene.id,
      source: result.referenceSource,
      latencyMs,
      bytes,
      file: filePath,
    })
  }

  logStep("reference done")
}

main().catch((err) => {
  console.error("[image-gen-spike] reference failed", err)
  process.exitCode = 1
})
