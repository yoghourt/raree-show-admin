import { spawnSync } from "node:child_process"

import type { ImagePortraitProvider, PortraitRequest, PortraitResult } from "../types"

const DEFAULT_API_BASE = "https://api.siliconflow.com/v1"
const DEFAULT_MODEL = "black-forest-labs/FLUX.1-Kontext-dev"

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
}

function isKontextModel(modelId: string): boolean {
  return /kontext/i.test(modelId)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(err: unknown): boolean {
  const msg = String(err)
  return (
    msg.includes("UND_ERR_SOCKET") ||
    msg.includes("other side closed") ||
    msg.includes("TimeoutError") ||
    msg.includes("aborted due to timeout") ||
    msg.includes("ECONNRESET") ||
    msg.includes("fetch failed") ||
    msg.includes("terminated") ||
    msg.includes("curl exit") ||
    msg.includes("HTTP 429") ||
    msg.includes("HTTP 503") ||
    msg.includes("HTTP 504")
  )
}

async function withRetries<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 6
): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (!isRetryableError(err) || i === attempts - 1) throw err
      const wait = 2500 * (i + 1)
      console.warn(
        `[siliconflow] ${label} retry ${i + 1}/${attempts - 1} in ${wait}ms: ${String(err).slice(0, 140)}`
      )
      await sleep(wait)
    }
  }
  throw last
}

function downloadWithCurl(url: string): { bytes: Buffer; mimeType: string } {
  const out = spawnSync(
    "curl",
    [
      "-fsSL",
      "--retry",
      "4",
      "--retry-all-errors",
      "--retry-delay",
      "2",
      "--max-time",
      "180",
      url,
    ],
    {
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024,
      env: process.env,
    }
  )
  if (out.status !== 0) {
    const err = out.stderr?.toString("utf8") || out.error?.message || "unknown"
    throw new Error(`curl exit ${out.status}: ${err.slice(0, 200)}`)
  }
  const bytes = Buffer.from(out.stdout)
  if (bytes.length < 100) {
    throw new Error(`curl download too small (${bytes.length} bytes)`)
  }
  const mimeType =
    bytes[0] === 0x89 && bytes[1] === 0x50
      ? "image/png"
      : bytes[0] === 0xff && bytes[1] === 0xd8
        ? "image/jpeg"
        : "image/jpeg"
  return { bytes, mimeType }
}

async function downloadImage(
  url: string
): Promise<{ bytes: Buffer; mimeType: string }> {
  try {
    return downloadWithCurl(url)
  } catch (curlErr) {
    console.warn(
      `[siliconflow] curl failed, fetch fallback: ${String(curlErr).slice(0, 120)}`
    )
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(180_000) })
    if (!imgRes.ok) {
      throw new Error(`siliconflow image download HTTP ${imgRes.status}`)
    }
    const mt =
      imgRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg"
    const ab = await imgRes.arrayBuffer()
    return { bytes: Buffer.from(ab), mimeType: mt }
  }
}

/**
 * Spike accept adapter — SiliconFlow OpenAI-compatible image generations.
 */
export function createSiliconFlowProvider(options: {
  apiKey?: string
  modelId?: string
  apiBase?: string
  skipNetwork?: boolean
  costUsdEstPerImage?: number
}): ImagePortraitProvider {
  const modelId = options.modelId?.trim() || DEFAULT_MODEL
  const apiBase = (options.apiBase?.trim() || DEFAULT_API_BASE).replace(
    /\/$/,
    ""
  )
  const apiUrl = `${apiBase}/images/generations`
  const skipNetwork = options.skipNetwork === true
  const costUsdEstPerImage = options.costUsdEstPerImage ?? 0.03

  return {
    name: "siliconflow",
    capabilities: { referenceImage: true },
    async generatePortrait(req: PortraitRequest): Promise<PortraitResult> {
      const width = req.size?.width ?? 512
      const height = req.size?.height ?? 512
      const seed = req.seed

      if (skipNetwork) {
        return {
          bytes: tinyPng(),
          mimeType: "image/png",
          meta: {
            providerId: "siliconflow",
            modelId: `${modelId}-dry-run`,
            seed,
            costUsdEst: 0,
          },
        }
      }

      const apiKey = options.apiKey?.trim()
      if (!apiKey) {
        throw new Error(
          "siliconflow adapter requires IMAGE_SPIKE_SILICONFLOW_KEY or SILICONFLOW_API_KEY"
        )
      }

      const ref = req.referenceImages?.[0]?.url
      const body: Record<string, unknown> = {
        model: modelId,
        prompt: req.prompt,
        batch_size: 1,
      }

      if (!/qwen-image-edit/i.test(modelId)) {
        body.image_size = `${width}x${height}`
      }
      if (seed != null) body.seed = seed
      if (ref) {
        body.image = ref
        if (isKontextModel(modelId)) body.input_image = ref
      }

      const json = await withRetries("generate", async () => {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(300_000),
        })
        if (!res.ok) {
          const errText = await res.text().catch(() => "")
          throw new Error(
            `siliconflow HTTP ${res.status}: ${errText.slice(0, 400)}`
          )
        }
        return (await res.json()) as {
          images?: { url?: string }[]
          data?: { url?: string }[]
          seed?: number
        }
      })

      const first = json.images?.[0]?.url || json.data?.[0]?.url
      if (!first) {
        throw new Error("siliconflow response missing images[0].url")
      }

      const { bytes, mimeType } = await withRetries("download", () =>
        downloadImage(first)
      )

      return {
        bytes,
        mimeType,
        meta: {
          providerId: "siliconflow",
          modelId,
          seed: json.seed ?? seed,
          costUsdEst: costUsdEstPerImage,
          publicUrl: first,
        },
      }
    },
  }
}
