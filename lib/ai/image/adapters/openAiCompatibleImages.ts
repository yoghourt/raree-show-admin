import type {
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../types"
import { AVATAR_NEGATIVE_PROMPT } from "@/lib/prompts/avatar"

const DEFAULT_SIZE = { width: 1024, height: 1024 }

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
}

/**
 * OpenAI-compatible image generations client (Execution Platform adapter).
 *
 * Satisfied by LocalAI Strategic Default and any compatible `/v1/images/generations`
 * host. Product Runtime must not import this module.
 *
 * POST `${baseUrl}/v1/images/generations`
 * body: { model, prompt, size, n, response_format, ref_images? }
 * response: { data: [{ b64_json? | url? }] }
 */
export function createOpenAiCompatibleImageProvider(options?: {
  /** Opaque provider id recorded in meta (e.g. localai) */
  providerId?: string
  baseUrl?: string
  apiKey?: string
  modelId?: string
  skipNetwork?: boolean
  costUsdEstPerImage?: number
}): ImageGenerationProvider {
  const providerId = (options?.providerId ?? "localai").trim() || "localai"
  const baseUrl = (options?.baseUrl ?? "").replace(/\/$/, "")
  const modelId = options?.modelId?.trim() || "stablediffusion"
  const apiKey = options?.apiKey?.trim()
  const skipNetwork = options?.skipNetwork === true
  const costUsdEst = options?.costUsdEstPerImage ?? 0

  return {
    name: providerId,
    capabilities: { referenceImage: true },
    async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
      const width = req.size?.width ?? DEFAULT_SIZE.width
      const height = req.size?.height ?? DEFAULT_SIZE.height
      const seed = req.seed ?? Math.floor(Math.random() * 1_000_000_000)
      const ref = req.referenceImages?.[0]?.url

      if (skipNetwork) {
        return {
          bytes: tinyPng(),
          mimeType: "image/png",
          meta: {
            providerId,
            modelId,
            seed,
            costUsdEst,
          },
        }
      }

      if (!baseUrl) {
        throw new Error(
          `${providerId} adapter requires IMAGE_CREATOR_LOCAL_BASE or IMAGE_CREATOR_LOCALAI_BASE (e.g. http://127.0.0.1:8080)`
        )
      }

      const endpoint = `${baseUrl}/v1/images/generations`
      const prompt = `${req.prompt}|${AVATAR_NEGATIVE_PROMPT}`
      const headers: Record<string, string> = {
        "content-type": "application/json",
        accept: "application/json",
      }
      if (apiKey) {
        headers.authorization = `Bearer ${apiKey}`
      }

      const body: Record<string, unknown> = {
        model: modelId,
        prompt,
        n: 1,
        size: `${width}x${height}`,
        response_format: "b64_json",
      }
      if (ref) {
        body.ref_images = [ref]
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(
          `${providerId} ${endpoint} failed: HTTP ${res.status} ${text.slice(0, 200)}`
        )
      }

      const json = (await res.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>
      }
      const item = json.data?.[0]
      if (!item) {
        throw new Error(`${providerId} response missing data[0]`)
      }

      if (item.b64_json) {
        return {
          bytes: Buffer.from(item.b64_json, "base64"),
          mimeType: "image/png",
          meta: {
            providerId,
            modelId,
            seed,
            costUsdEst,
            publicUrl: item.url,
          },
        }
      }

      if (item.url) {
        const absUrl = item.url.startsWith("http")
          ? item.url
          : `${baseUrl}${item.url.startsWith("/") ? "" : "/"}${item.url}`
        const imgRes = await fetch(absUrl, {
          headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
        })
        if (!imgRes.ok) {
          throw new Error(
            `${providerId} url fetch failed: HTTP ${imgRes.status}`
          )
        }
        const buf = Buffer.from(await imgRes.arrayBuffer())
        return {
          bytes: buf,
          mimeType: imgRes.headers.get("content-type") || "image/png",
          meta: {
            providerId,
            modelId,
            seed,
            costUsdEst,
            publicUrl: absUrl,
          },
        }
      }

      throw new Error(`${providerId} response missing b64_json or url`)
    },
  }
}
