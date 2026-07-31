/**
 * Isolated spike helpers — Image Generation Architecture Direction Validation.
 * Does not touch Production Runtime / Assets / CPP / queue.
 */

import { readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadEnvLocal } from "../load-env-local"
import { createImageGenerationProvider } from "../../lib/ai/image/factory"
import type { ImageGenerationResult } from "../../lib/ai/image/types"
import { callCopilotTextLlm } from "../../lib/ai/copilot-text-llm"
import { ensureUndiciProxyDispatcherForGemini } from "../../lib/ai/undici-proxy-bootstrap"

export type SceneFixture = {
  id: string
  label: string
  prompt: string
}

export type PromptsFile = {
  styleSuffix: string
  scenes: SceneFixture[]
}

export type VisualPlan = {
  characters: string[]
  location: string
  action: string
  composition: string
  lighting: string
}

export type RunMeta = {
  pathId: string
  sceneId: string
  modelId: string
  providerId: string
  latencyMs: number
  costUsdEst: number
  promptUsed: string
  visualPlan?: VisualPlan
  outputFile: string
  bytes: number
  at: string
}

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url))
export const RESULTS_DIR = path.join(SPIKE_DIR, "results")

/** Current LocalAI image model (known weak prompt adherence). */
export const LOCAL_MODEL_CURRENT =
  process.env.SPIKE_LOCAL_MODEL_CURRENT?.trim() || "sd-3.5-medium-ggml"

/**
 * Single alternative local model for Option A.
 * Default: sdxl-turbo via local portrait server (flux.2-klein-4b on LocalAI
 * returns gRPC EOF on this machine — not expanded to further model search).
 */
export const LOCAL_MODEL_ALT =
  process.env.SPIKE_LOCAL_MODEL_ALT?.trim() || "sdxl-turbo"

/** Provider for alt arm: localai | local (HTTP :8191). Default local. */
export const LOCAL_ALT_PROVIDER =
  process.env.SPIKE_LOCAL_ALT_PROVIDER?.trim().toLowerCase() || "local"

export const GEMINI_IMAGE_MODEL =
  process.env.SPIKE_GEMINI_IMAGE_MODEL?.trim() ||
  process.env.GEMINI_IMAGE_MODEL?.trim() ||
  "gemini-2.5-flash-image"

export const GEMINI_DIRECTOR_MODEL =
  process.env.SPIKE_GEMINI_DIRECTOR_MODEL?.trim() ||
  process.env.DISCOVERY_TEXT_MODEL?.trim() ||
  "gemini-3.5-flash-lite"

/** Spike uses small edge for CPU LocalAI wall-clock; override SPIKE_LOCAL_MAX_EDGE. */
export function applySpikeLocalSizeEnv(): void {
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512"
}

export function bootstrapSpikeEnv(): void {
  loadEnvLocal()
  applySpikeLocalSizeEnv()
  ensureUndiciProxyDispatcherForGemini()
}

export function loadPrompts(): PromptsFile {
  const p = path.join(SPIKE_DIR, "prompts.json")
  return JSON.parse(readFileSync(p, "utf8")) as PromptsFile
}

export function fullScenePrompt(scene: SceneFixture, styleSuffix: string): string {
  return `${scene.prompt}. ${styleSuffix}`
}

export async function ensureSceneDir(sceneId: string): Promise<string> {
  const dir = path.join(RESULTS_DIR, sceneId)
  await mkdir(dir, { recursive: true })
  return dir
}

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png"
  if (mime.includes("webp")) return "webp"
  return "jpg"
}

export async function writeImageResult(
  sceneDir: string,
  basename: string,
  result: ImageGenerationResult
): Promise<{ filePath: string; bytes: number }> {
  const ext = extForMime(result.mimeType)
  const filePath = path.join(sceneDir, `${basename}.${ext}`)
  await writeFile(filePath, result.bytes)
  return { filePath, bytes: result.bytes.length }
}

export async function writeMeta(
  sceneDir: string,
  basename: string,
  meta: RunMeta
): Promise<void> {
  await writeFile(
    path.join(sceneDir, `${basename}.json`),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8"
  )
}

export function localaiBaseUrl(): string {
  return (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() ||
    process.env.IMAGE_SPIKE_LOCAL_BASE?.trim() ||
    "http://127.0.0.1:8080"
  ).replace(/\/$/, "")
}

export async function generateLocalImage(opts: {
  prompt: string
  modelId: string
  seed?: number
  /** localai (default) or local HTTP portrait server */
  providerId?: "localai" | "local"
}): Promise<ImageGenerationResult> {
  const providerId = opts.providerId ?? "localai"
  const localBase =
    providerId === "local"
      ? (
          process.env.IMAGE_CREATOR_LOCAL_BASE?.trim() ||
          process.env.IMAGE_SPIKE_LOCAL_BASE?.trim() ||
          "http://127.0.0.1:8191"
        ).replace(/\/$/, "")
      : localaiBaseUrl()

  const provider = createImageGenerationProvider(
    providerId,
    {
      acceptModelId: opts.modelId,
      localBaseUrl: localBase,
      localAiApiKey: process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim(),
      skipNetwork: false,
    },
    "accept"
  )
  return provider.generate({
    prompt: opts.prompt,
    size: { width: 512, height: 512 },
    seed: opts.seed ?? 42,
    assetSlot: "scene_frame",
  })
}

export async function generateGeminiReferenceImage(opts: {
  prompt: string
}): Promise<ImageGenerationResult> {
  const apiKey =
    process.env.IMAGE_SPIKE_GEMINI_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("Set GEMINI_API_KEY (or IMAGE_SPIKE_GEMINI_KEY)")
  }
  const provider = createImageGenerationProvider(
    "gemini",
    {
      acceptModelId: GEMINI_IMAGE_MODEL,
      geminiKey: apiKey,
      skipNetwork: false,
    },
    "accept"
  )
  return provider.generate({
    prompt: opts.prompt,
    size: { width: 1024, height: 1024 },
    seed: 42,
    assetSlot: "scene_frame",
  })
}

/**
 * Cloud narrative-quality ceiling when Gemini image free-tier quota is 0.
 * Prefer Gemini; on 429 / RESOURCE_EXHAUSTED fall back to SiliconFlow FLUX.
 */
export async function generateCloudReferenceImage(opts: {
  prompt: string
}): Promise<ImageGenerationResult & { referenceSource: "gemini" | "siliconflow-fallback" }> {
  try {
    const result = await generateGeminiReferenceImage(opts)
    return { ...result, referenceSource: "gemini" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const quotaBlocked =
      /429|RESOURCE_EXHAUSTED|quota|free_tier/i.test(msg) ||
      (typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status?: number }).status === 429)
    if (!quotaBlocked) throw err

    logStep("reference Gemini image quota blocked; using SiliconFlow cloud ceiling", {
      error: msg.slice(0, 200),
    })
    const sfKey =
      process.env.IMAGE_SPIKE_SILICONFLOW_KEY?.trim() ||
      process.env.SILICONFLOW_API_KEY?.trim()
    if (!sfKey) {
      throw new Error(
        `Gemini image unavailable (${msg.slice(0, 120)}). Set IMAGE_SPIKE_SILICONFLOW_KEY for cloud reference fallback.`
      )
    }
    const provider = createImageGenerationProvider(
      "siliconflow",
      {
        acceptModelId: "black-forest-labs/FLUX.1-dev",
        siliconflowKey: sfKey,
        skipNetwork: false,
      },
      "accept"
    )
    const result = await provider.generate({
      prompt: opts.prompt,
      size: { width: 1024, height: 1024 },
      seed: 42,
      assetSlot: "scene_frame",
    })
    return { ...result, referenceSource: "siliconflow-fallback" }
  }
}

export function visualPlanToPrompt(
  plan: VisualPlan,
  styleSuffix: string
): string {
  const characters =
    plan.characters?.length > 0
      ? plan.characters.join("; ")
      : "figures as implied by the scene"
  return [
    `Characters: ${characters}.`,
    `Location: ${plan.location || "unspecified"}.`,
    `Action: ${plan.action || "unspecified"}.`,
    `Composition: ${plan.composition || "clear narrative framing"}.`,
    `Lighting: ${plan.lighting || "dramatic story lighting"}.`,
    styleSuffix,
  ].join(" ")
}

export async function planSceneWithGemini(
  scenePrompt: string
): Promise<{ plan: VisualPlan; latencyMs: number; raw: string }> {
  const directorPrompt = `You are a visual scene director for narrative illustration.
Given a short scene description, output ONLY a JSON object with this exact shape:
{
  "characters": ["..."],
  "location": "...",
  "action": "...",
  "composition": "...",
  "lighting": "..."
}

Rules:
- Improve scene understanding for an image model that follows instructions poorly.
- Be concrete and visual (who, where, what is happening, camera/framing, light).
- Do not invent a different story; preserve the scene meaning.
- No markdown fences. JSON only.

Scene: ${scenePrompt}`

  const t0 = Date.now()
  const raw = await callCopilotTextLlm(directorPrompt, {
    provider: "gemini",
    model: GEMINI_DIRECTOR_MODEL,
    geminiJsonObject: true,
  })
  const latencyMs = Date.now() - t0

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
  const parsed = JSON.parse(cleaned) as Partial<VisualPlan>
  const plan: VisualPlan = {
    characters: Array.isArray(parsed.characters)
      ? parsed.characters.map(String)
      : [],
    location: String(parsed.location ?? ""),
    action: String(parsed.action ?? ""),
    composition: String(parsed.composition ?? ""),
    lighting: String(parsed.lighting ?? ""),
  }
  return { plan, latencyMs, raw }
}

export function logStep(msg: string, extra?: Record<string, unknown>): void {
  if (extra) {
    console.info(`[image-gen-spike] ${msg}`, extra)
  } else {
    console.info(`[image-gen-spike] ${msg}`)
  }
}
