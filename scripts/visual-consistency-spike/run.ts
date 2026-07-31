/**
 * Visual Consistency Adaptation Validation — 5-frame mini story.
 *
 * Strategy A: exact Intent → Local
 * Strategy B: narrative-preserving adaptation → Local
 * Strategy C: Local frames 1-3, Cloud frames 4-5 (continuity stress test)
 *
 *   npx tsx scripts/visual-consistency-spike/run.ts
 */

import { access, mkdir, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadEnvLocal } from "../load-env-local"
import { createImageGenerationProvider } from "../../lib/ai/image/factory"
import type { ImageGenerationProvider } from "../../lib/ai/image/types"

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = path.join(SPIKE_DIR, "results")

type Frame = {
  id: string
  beat: string
  narrative: string
  exactIntent: string
  adaptedExpression: string
}

type Fixtures = {
  model: string
  seed: number
  storyTitle: string
  frames: Frame[]
}

const STYLE =
  "Cinematic narrative reading still, coherent storybook frame, no text, no watermark, no logo."

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function makeLocal(model: string, base: string): ImageGenerationProvider {
  return createImageGenerationProvider(
    "localai",
    {
      acceptModelId: model,
      localBaseUrl: base,
      localAiApiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
      skipNetwork: false,
    },
    "accept"
  )
}

function makeCloud(): ImageGenerationProvider {
  const key =
    process.env.IMAGE_SPIKE_SILICONFLOW_KEY?.trim() ||
    process.env.SILICONFLOW_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "Strategy C requires IMAGE_SPIKE_SILICONFLOW_KEY or SILICONFLOW_API_KEY"
    )
  }
  return createImageGenerationProvider(
    "siliconflow",
    {
      acceptModelId: "black-forest-labs/FLUX.1-dev",
      siliconflowKey: key,
      skipNetwork: false,
    },
    "accept"
  )
}

type Job = {
  strategy: "A" | "B" | "C"
  frame: Frame
  prompt: string
  renderer: "local" | "cloud"
}

function buildJobs(fixtures: Fixtures): Job[] {
  const jobs: Job[] = []
  for (const frame of fixtures.frames) {
    jobs.push({
      strategy: "A",
      frame,
      prompt: `${frame.exactIntent} ${STYLE}`,
      renderer: "local",
    })
    jobs.push({
      strategy: "B",
      frame,
      prompt: `${frame.adaptedExpression} ${STYLE}`,
      renderer: "local",
    })
    const useCloud =
      frame.id === "frame-4" || frame.id === "frame-5"
    jobs.push({
      strategy: "C",
      frame,
      prompt: useCloud
        ? `${frame.exactIntent} ${STYLE}`
        : `${frame.adaptedExpression} ${STYLE}`,
      renderer: useCloud ? "cloud" : "local",
    })
  }
  return jobs
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
  const onlyStrategy = process.env.SPIKE_STRATEGY?.trim().toUpperCase() as
    | "A"
    | "B"
    | "C"
    | undefined
  const skipExisting =
    process.env.SPIKE_SKIP_EXISTING === "1" ||
    process.env.SPIKE_SKIP_EXISTING === "true"

  await mkdir(RESULTS_DIR, { recursive: true })
  await writeFile(
    path.join(RESULTS_DIR, "story.json"),
    `${JSON.stringify(
      {
        storyTitle: fixtures.storyTitle,
        frames: fixtures.frames,
        strategies: {
          A: "exact Intent → all Local",
          B: "narrative-preserving adaptation → all Local",
          C: "frames 1-3 Local adapted; frames 4-5 Cloud exact Intent",
        },
      },
      null,
      2
    )}\n`
  )

  const local = makeLocal(model, base)
  let cloud: ImageGenerationProvider | null = null

  const jobs = buildJobs(fixtures).filter(
    (j) => !onlyStrategy || j.strategy === onlyStrategy
  )

  console.info("[visual-consistency] start", {
    model,
    seed,
    jobs: jobs.length,
  })

  for (const job of jobs) {
    const dir = path.join(RESULTS_DIR, `strategy-${job.strategy}`)
    await mkdir(dir, { recursive: true })
    const baseName = job.frame.id
    const png = path.join(dir, `${baseName}.png`)
    await writeFile(
      path.join(dir, `${baseName}.prompt.txt`),
      `${job.prompt}\n`,
      "utf8"
    )

    if (skipExisting && (await exists(png))) {
      console.info("[visual-consistency] skip", {
        strategy: job.strategy,
        frame: job.frame.id,
      })
      continue
    }

    if (job.renderer === "cloud" && !cloud) cloud = makeCloud()
    const provider = job.renderer === "cloud" ? cloud! : local

    console.info("[visual-consistency] generate", {
      strategy: job.strategy,
      frame: job.frame.id,
      beat: job.frame.beat,
      renderer: job.renderer,
      promptLen: job.prompt.length,
    })

    const t0 = Date.now()
    const result = await provider.generate({
      prompt: job.prompt,
      size: { width: 512, height: 512 },
      seed,
      assetSlot: "scene_frame",
    })
    const latencyMs = Date.now() - t0
    await writeFile(png, result.bytes)
    await writeFile(
      path.join(dir, `${baseName}.json`),
      `${JSON.stringify(
        {
          strategy: job.strategy,
          frameId: job.frame.id,
          beat: job.frame.beat,
          narrative: job.frame.narrative,
          renderer: job.renderer,
          modelId: result.meta.modelId,
          seed,
          latencyMs,
          bytes: result.bytes.length,
          prompt: job.prompt,
          at: new Date().toISOString(),
        },
        null,
        2
      )}\n`
    )
    console.info("[visual-consistency] ok", {
      strategy: job.strategy,
      frame: job.frame.id,
      renderer: job.renderer,
      latencyMs,
      bytes: result.bytes.length,
    })
  }

  console.info("[visual-consistency] done →", RESULTS_DIR)
}

main().catch((err) => {
  console.error("[visual-consistency] failed", err)
  process.exitCode = 1
})
