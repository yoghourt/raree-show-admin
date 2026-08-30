import type {
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../types"
import { buildAvatarNegativePrompt } from "@/lib/prompts/avatar"
import { buildFrameNegativePrompt } from "@/lib/prompts/frame-draft"

const DEFAULT_SIZE = { width: 1024, height: 1024 }
/**
 * Local CPU/GPU image backends are slow at 1280×720+.
 * Override: IMAGE_CREATOR_LOCALAI_TIMEOUT_MS (default 10 min).
 */
const DEFAULT_GENERATE_TIMEOUT_MS = 600_000
const IMAGE_FETCH_TIMEOUT_MS = 30_000
/** Cap long edge so LocalAI finishes; override IMAGE_CREATOR_LOCALAI_MAX_EDGE. */
const DEFAULT_MAX_EDGE = 768

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function clampSize(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number; clamped: boolean } {
  const long = Math.max(width, height)
  if (long <= maxEdge) return { width, height, clamped: false }
  const scale = maxEdge / long
  return {
    width: Math.max(64, Math.round(width * scale)),
    height: Math.max(64, Math.round(height * scale)),
    clamped: true,
  }
}

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
 * body: { model, prompt, size, n, response_format }
 * Z-Image-Turbo / LocalAI T2I crashes if `ref_images` is present — never send it.
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
    capabilities: { referenceImage: false },
    async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
      const requestedW = req.size?.width ?? DEFAULT_SIZE.width
      const requestedH = req.size?.height ?? DEFAULT_SIZE.height
      const maxEdge = readPositiveIntEnv(
        "IMAGE_CREATOR_LOCALAI_MAX_EDGE",
        DEFAULT_MAX_EDGE
      )
      const { width, height, clamped } = clampSize(
        requestedW,
        requestedH,
        maxEdge
      )
      const generateTimeoutMs = readPositiveIntEnv(
        "IMAGE_CREATOR_LOCALAI_TIMEOUT_MS",
        DEFAULT_GENERATE_TIMEOUT_MS
      )
      const seed = req.seed ?? Math.floor(Math.random() * 1_000_000_000)
      if (req.referenceImages?.[0]?.url) {
        console.info(
          `[${providerId}] omitting referenceImages — LocalAI T2I crashes on ref_images`
        )
      }

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
      // Portrait: keep negatives in dedicated field when supported; never `|`-glue
      // into prompt (LocalAI / many OpenAI-compat hosts treat `|` as literal junk).
      const prompt = req.prompt
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
      if (req.assetSlot === "portrait") {
        body.negative_prompt =
          req.negativePrompt?.trim() || buildAvatarNegativePrompt()
      } else       if (req.assetSlot === "scene_frame") {
        body.negative_prompt =
          req.negativePrompt?.trim() || buildFrameNegativePrompt()
      }

      if (clamped) {
        console.info(`[${providerId}] clamping size for local throughput`, {
          requested: `${requestedW}x${requestedH}`,
          using: `${width}x${height}`,
          maxEdge,
          timeoutMs: generateTimeoutMs,
          assetSlot: req.assetSlot ?? null,
        })
      } else {
        console.info(`[${providerId}] generate`, {
          size: `${width}x${height}`,
          timeoutMs: generateTimeoutMs,
          assetSlot: req.assetSlot ?? null,
          modelId,
        })
      }

      let res: Response
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(generateTimeoutMs),
        })
      } catch (err) {
        if (isAbortError(err)) {
          throw new Error(
            `${providerId} timed out after ${generateTimeoutMs}ms (${endpoint}; size ${width}x${height}). LocalAI may still be loading or CPU-bound — check LocalAI logs, or lower IMAGE_CREATOR_LOCALAI_MAX_EDGE.`
          )
        }
        throw err
      }

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
        let imgRes: Response
        try {
          imgRes = await fetch(absUrl, {
            headers: apiKey
              ? { authorization: `Bearer ${apiKey}` }
              : undefined,
            signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
          })
        } catch (err) {
          if (isAbortError(err)) {
            throw new Error(
              `${providerId} image url fetch timed out after ${IMAGE_FETCH_TIMEOUT_MS}ms`
            )
          }
          throw err
        }
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

function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.name === "AbortError" ||
    err.name === "TimeoutError" ||
    /aborted|timeout/i.test(err.message)
  )
}
