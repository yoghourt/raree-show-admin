import type { ImageGenerationProvider, ImageGenerationRequest, ImageGenerationResult } from "../types"
import { buildAvatarNegativePrompt } from "@/lib/prompts/avatar"
import { buildFrameNegativePrompt } from "@/lib/prompts/frame-draft"

const DEFAULT_SIZE = { width: 768, height: 1024 }

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
}

/**
 * Local HTTP portrait adapter (Creator Deployment Default / SPIKE-IMG-002).
 *
 * Talks to an operator-provided HTTP endpoint (Diffusers-serve / Comfy wrapper /
 * OpenAI-compatible image API). Weights and MPS/MLX runtime stay outside the
 * Next.js process.
 *
 * Expected simple contract (POST `${base}/v1/portraits`):
 *   body: { prompt, seed?, width?, height?, model?, negative_prompt? }
 *   response: image bytes (image/*) OR JSON { b64_json | url }
 */
export function createLocalHttpProvider(options?: {
  baseUrl?: string
  modelId?: string
  skipNetwork?: boolean
  /** Local marginal cost is ~0; keep field for Port meta parity */
  costUsdEstPerImage?: number
}): ImageGenerationProvider {
  const baseUrl = (options?.baseUrl ?? "").replace(/\/$/, "")
  const modelId = options?.modelId?.trim() || "local"
  const skipNetwork = options?.skipNetwork === true
  const costUsdEst = options?.costUsdEstPerImage ?? 0

  return {
    name: "local",
    // Reference support depends on the operator endpoint; advertise true so
    // spike scripts can attempt Phase-B style calls and record failures.
    capabilities: { referenceImage: false },
    async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
      const width = req.size?.width ?? DEFAULT_SIZE.width
      const height = req.size?.height ?? DEFAULT_SIZE.height
      const seed = req.seed ?? Math.floor(Math.random() * 1_000_000_000)
      if (req.referenceImages?.[0]?.url) {
        console.info(
          "[local] omitting reference_url — Local T2I must not receive a prior portrait"
        )
      }

      if (skipNetwork) {
        return {
          bytes: tinyPng(),
          mimeType: "image/png",
          meta: {
            providerId: "local",
            modelId,
            seed,
            costUsdEst,
          },
        }
      }

      if (!baseUrl) {
        throw new Error(
          "local adapter requires IMAGE_CREATOR_LOCAL_BASE or IMAGE_SPIKE_LOCAL_BASE (e.g. http://127.0.0.1:8191); spike dry-run: IMAGE_SPIKE_SKIP_NETWORK=1"
        )
      }

      const endpoint = `${baseUrl}/v1/portraits`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "*/*" },
        body: JSON.stringify({
          prompt: req.prompt,
          seed,
          width,
          height,
          model: modelId,
          negative_prompt:
            req.negativePrompt?.trim() ||
            (req.assetSlot === "scene_frame"
              ? buildFrameNegativePrompt()
              : buildAvatarNegativePrompt()),
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(
          `local endpoint ${endpoint} failed: HTTP ${res.status} ${text.slice(0, 200)}`
        )
      }

      const contentType = (res.headers.get("content-type") || "").toLowerCase()
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as {
          b64_json?: string
          url?: string
          mimeType?: string
          seed?: number
        }
        if (json.b64_json) {
          return {
            bytes: Buffer.from(json.b64_json, "base64"),
            mimeType: json.mimeType || "image/png",
            meta: {
              providerId: "local",
              modelId,
              seed: json.seed ?? seed,
              costUsdEst,
              publicUrl: json.url,
            },
          }
        }
        if (json.url) {
          const imgRes = await fetch(json.url)
          if (!imgRes.ok) {
            throw new Error(`local json.url fetch failed: HTTP ${imgRes.status}`)
          }
          const buf = Buffer.from(await imgRes.arrayBuffer())
          return {
            bytes: buf,
            mimeType: imgRes.headers.get("content-type") || "image/png",
            meta: {
              providerId: "local",
              modelId,
              seed: json.seed ?? seed,
              costUsdEst,
              publicUrl: json.url,
            },
          }
        }
        throw new Error("local JSON response missing b64_json or url")
      }

      const bytes = Buffer.from(await res.arrayBuffer())
      return {
        bytes,
        mimeType: contentType.startsWith("image/")
          ? contentType.split(";")[0]!.trim()
          : "image/png",
        meta: {
          providerId: "local",
          modelId,
          seed,
          costUsdEst,
        },
      }
    },
  }
}
