/**
 * Option B: Gemini visual planner + local renderer (current local model).
 *
 *   Scene Prompt → Gemini Text → Structured Visual Prompt → LocalAI Image
 *
 *   npx tsx scripts/image-generation-spike/run-gemini-director.ts
 */

import { writeFile as fsWriteFile } from "node:fs/promises"
import path from "node:path"

import {
  RESULTS_DIR,
  GEMINI_DIRECTOR_MODEL,
  LOCAL_MODEL_CURRENT,
  bootstrapSpikeEnv,
  ensureSceneDir,
  generateLocalImage,
  loadPrompts,
  localaiBaseUrl,
  logStep,
  planSceneWithGemini,
  visualPlanToPrompt,
  writeImageResult,
  writeMeta,
} from "./shared"

async function main(): Promise<void> {
  bootstrapSpikeEnv()
  const { scenes, styleSuffix } = loadPrompts()
  const renderModel =
    process.env.SPIKE_DIRECTOR_RENDER_MODEL?.trim() || LOCAL_MODEL_CURRENT

  logStep("gemini-director start", {
    directorModel: GEMINI_DIRECTOR_MODEL,
    renderModel,
    base: localaiBaseUrl(),
    scenes: scenes.length,
    resultsDir: RESULTS_DIR,
  })

  for (const scene of scenes) {
    const sceneDir = await ensureSceneDir(scene.id)
    logStep("gemini-director plan", { scene: scene.id, prompt: scene.prompt })

    const { plan, latencyMs: planMs } = await planSceneWithGemini(scene.prompt)
    const renderPrompt = visualPlanToPrompt(plan, styleSuffix)

    await fsWriteFile(
      path.join(sceneDir, "visual-plan.json"),
      `${JSON.stringify({ scenePrompt: scene.prompt, plan, renderPrompt, planMs }, null, 2)}\n`,
      "utf8"
    )

    logStep("gemini-director render", {
      scene: scene.id,
      planMs,
      renderModel,
    })

    const t0 = Date.now()
    const result = await generateLocalImage({
      prompt: renderPrompt,
      modelId: renderModel,
      seed: 42,
    })
    const renderMs = Date.now() - t0
    const { filePath, bytes } = await writeImageResult(
      sceneDir,
      "gemini-director-local",
      result
    )
    await writeMeta(sceneDir, "gemini-director-local", {
      pathId: "gemini-director-local",
      sceneId: scene.id,
      modelId: `${GEMINI_DIRECTOR_MODEL}+${result.meta.modelId}`,
      providerId: `gemini-text+${result.meta.providerId}`,
      latencyMs: planMs + renderMs,
      costUsdEst: 0.001,
      promptUsed: renderPrompt,
      visualPlan: plan,
      outputFile: filePath,
      bytes,
      at: new Date().toISOString(),
    })
    logStep("gemini-director ok", {
      scene: scene.id,
      planMs,
      renderMs,
      totalMs: planMs + renderMs,
      bytes,
      file: filePath,
    })
  }

  logStep("gemini-director done")
}

main().catch((err) => {
  console.error("[image-gen-spike] gemini-director failed", err)
  process.exitCode = 1
})
