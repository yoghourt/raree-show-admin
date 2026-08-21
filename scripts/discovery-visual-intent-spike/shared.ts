/**
 * Isolated helpers — Discovery Visual Intent Extension spike.
 * Does not touch Production Discovery / Runtime / Assets / CPP / queue.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadEnvLocal } from "../load-env-local"
import { callCopilotTextLlm } from "../../lib/ai/copilot-text-llm"
import { createImageGenerationProvider } from "../../lib/ai/image/factory"
import type { ImageGenerationResult } from "../../lib/ai/image/types"
import { buildFrameDraftPrompt } from "../../lib/prompts/frame-draft"
import { ensureUndiciProxyDispatcherForGemini } from "../../lib/ai/undici-proxy-bootstrap"

import type { VisualIntent } from "./adapter"

export type SceneFixture = {
  id: string
  label: string
  source: string
  expect: string[]
}

export type FixturesFile = {
  workTitle: string
  scenes: SceneFixture[]
}

/** Simulated Discovery scene fields + temporary Visual Intent extension. */
export type DiscoveryVisualBundle = {
  scene: { title: string; summary: string }
  visualIntent: VisualIntent
}

export type RunMeta = {
  pathId: string
  sceneId: string
  modelId: string
  providerId: string
  latencyMs: number
  costUsdEst: number
  promptUsed: string
  caption?: string
  outputFile: string
  bytes: number
  at: string
}

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url))
export const RESULTS_DIR = path.join(SPIKE_DIR, "results")

export const LOCAL_MODEL =
  process.env.SPIKE_LOCAL_MODEL_CURRENT?.trim() || "sd-3.5-medium-ggml"

export const DISCOVERY_MODEL =
  process.env.SPIKE_DISCOVERY_VI_MODEL?.trim() ||
  process.env.DISCOVERY_TEXT_MODEL?.trim() ||
  "gemini-3.5-flash-lite"

export function bootstrapSpikeEnv(): void {
  loadEnvLocal()
  process.env.IMAGE_CREATOR_LOCALAI_MAX_EDGE =
    process.env.SPIKE_LOCAL_MAX_EDGE?.trim() || "512"
  ensureUndiciProxyDispatcherForGemini()
}

export function loadFixtures(): FixturesFile {
  return JSON.parse(
    readFileSync(path.join(SPIKE_DIR, "fixtures.json"), "utf8")
  ) as FixturesFile
}

export function localaiBaseUrl(): string {
  return (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() || "http://127.0.0.1:8080"
  ).replace(/\/$/, "")
}

export async function ensureSceneDir(sceneId: string): Promise<string> {
  const dir = path.join(RESULTS_DIR, sceneId)
  await mkdir(dir, { recursive: true })
  return dir
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
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
  const filePath = path.join(sceneDir, `${basename}.${extForMime(result.mimeType)}`)
  await writeFile(filePath, result.bytes)
  return { filePath, bytes: result.bytes.length }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8")
}

export function logStep(msg: string, extra?: Record<string, unknown>): void {
  if (extra) console.info(`[discovery-vi-spike] ${msg}`, extra)
  else console.info(`[discovery-vi-spike] ${msg}`)
}

/** Spike-only image prompt seed. Production Frame Narrative is not Scene.summary. */
export function captionFromSceneFields(scene: {
  title: string
  summary: string
}): string {
  const summary = scene.summary.trim()
  if (summary) return summary
  return scene.title.trim()
}

/** Baseline A: Discovery scene fields → production frame prompt builder. */
export function buildBaselinePrompt(scene: {
  title: string
  summary: string
}): { caption: string; prompt: string } {
  const caption = captionFromSceneFields(scene)
  return {
    caption,
    prompt: buildFrameDraftPrompt({ caption, routeTitle: "Spike Narrative Fixtures" }),
  }
}

export async function generateLocalImage(opts: {
  prompt: string
  seed?: number
}): Promise<ImageGenerationResult> {
  const provider = createImageGenerationProvider(
    "localai",
    {
      acceptModelId: LOCAL_MODEL,
      localBaseUrl: localaiBaseUrl(),
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

function emptyIntent(): VisualIntent {
  return {
    characters: [],
    relationship: "",
    event: "",
    environment: "",
    composition: "",
    emotion: "",
  }
}

function parseBundle(raw: string): DiscoveryVisualBundle {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
  const parsed = JSON.parse(cleaned) as {
    scene?: { title?: string; summary?: string }
    visualIntent?: Partial<VisualIntent> & {
      characters?: Array<Partial<VisualIntent["characters"][number]>>
    }
  }
  const title = String(parsed.scene?.title ?? "").trim()
  const summary = String(parsed.scene?.summary ?? "").trim()
  if (!title) throw new Error("Discovery VI bundle missing scene.title")

  const vi = parsed.visualIntent ?? {}
  const characters = Array.isArray(vi.characters)
    ? vi.characters.map((c) => ({
        name: String(c?.name ?? ""),
        role: String(c?.role ?? ""),
        position: String(c?.position ?? ""),
      }))
    : []

  return {
    scene: { title, summary: summary || title },
    visualIntent: {
      characters,
      relationship: String(vi.relationship ?? ""),
      event: String(vi.event ?? ""),
      environment: String(vi.environment ?? ""),
      composition: String(vi.composition ?? ""),
      emotion: String(vi.emotion ?? ""),
    },
  }
}

/**
 * One Discovery-style Gemini call: structured scene fields + Visual Intent extension.
 * Simulates enriching Discovery output — not a separate visual planner stage.
 */
export async function discoverWithVisualIntent(opts: {
  workTitle: string
  source: string
}): Promise<{ bundle: DiscoveryVisualBundle; latencyMs: number; raw: string }> {
  const prompt = `You are Raree Discovery: extract editorial scene structure AND narrative visual intent from source text.

Work title: ${opts.workTitle}
Source moment: ${opts.source}

Return ONLY JSON (no markdown) with this exact shape:
{
  "scene": {
    "title": "short editorial scene title",
    "summary": "1-2 sentence editorial summary of the moment"
  },
  "visualIntent": {
    "characters": [
      { "name": "", "role": "", "position": "" }
    ],
    "relationship": "",
    "event": "",
    "environment": "",
    "composition": "",
    "emotion": ""
  }
}

Rules:
- scene.title / scene.summary are editorial Story fields (what Discovery already produces).
- visualIntent captures visual meaning that must not be lost: who, relationship, event, place, framing, mood.
- visualIntent is NOT a renderer prompt and must NOT be style-token soup.
- Preserve the source meaning; do not invent a different story.
- Prefer concrete spatial relationships when the source implies them (e.g. protector between threat and protected).`

  const t0 = Date.now()
  const raw = await callCopilotTextLlm(prompt, {
    provider: "gemini",
    model: DISCOVERY_MODEL,
    geminiJsonObject: true,
  })
  const latencyMs = Date.now() - t0
  try {
    return { bundle: parseBundle(raw), latencyMs, raw }
  } catch (err) {
    logStep("parse fallback empty intent", {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      bundle: {
        scene: { title: opts.source.slice(0, 48), summary: opts.source },
        visualIntent: emptyIntent(),
      },
      latencyMs,
      raw,
    }
  }
}

export async function loadOrCreateBundle(
  sceneDir: string,
  workTitle: string,
  source: string
): Promise<{ bundle: DiscoveryVisualBundle; latencyMs: number; cached: boolean }> {
  const p = path.join(sceneDir, "discovery-bundle.json")
  if (await fileExists(p)) {
    const existing = JSON.parse(await readFile(p, "utf8")) as {
      bundle: DiscoveryVisualBundle
      latencyMs?: number
    }
    return {
      bundle: existing.bundle,
      latencyMs: existing.latencyMs ?? 0,
      cached: true,
    }
  }
  const { bundle, latencyMs, raw } = await discoverWithVisualIntent({
    workTitle,
    source,
  })
  await writeJson(p, {
    workTitle,
    source,
    model: DISCOVERY_MODEL,
    latencyMs,
    bundle,
    rawPreview: raw.slice(0, 1200),
  })
  return { bundle, latencyMs, cached: false }
}
