import type { ImagePortraitProvider, PortraitRequest, PortraitResult } from "../types"

const DEFAULT_SIZE = { width: 768, height: 768 }
const FREE_HOST = "https://image.pollinations.ai/prompt"
const ENTER_HOST = "https://gen.pollinations.ai/image"

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
}

/**
 * Pollinations adapter.
 *
 * - Without apiKey: free `image.pollinations.ai` (prompt-only; no reference).
 * - With apiKey (enter.pollinations.ai / gen.pollinations.ai): Bearer auth;
 *   when `referenceImages` present, uses `kontext` + `image=` for img2img.
 */
export function createPollinationsProvider(options?: {
  skipNetwork?: boolean
  /** Default text-to-image model when no reference (e.g. flux). */
  model?: string
  /** Model used when referenceImages are applied (default kontext). */
  referenceModel?: string
  apiKey?: string
  costUsdEst?: number
}): ImagePortraitProvider {
  const model = options?.model ?? "flux"
  const referenceModel = options?.referenceModel ?? "kontext"
  const apiKey = options?.apiKey?.trim()
  const skipNetwork = options?.skipNetwork === true
  const costUsdEst = options?.costUsdEst ?? 0
  const enterMode = Boolean(apiKey)

  return {
    name: enterMode ? "pollinations-enter" : "pollinations",
    capabilities: { referenceImage: enterMode },
    async generatePortrait(req: PortraitRequest): Promise<PortraitResult> {
      const width = req.size?.width ?? DEFAULT_SIZE.width
      const height = req.size?.height ?? DEFAULT_SIZE.height
      const seed = req.seed ?? Math.floor(Math.random() * 1_000_000_000)
      const ref = req.referenceImages?.[0]?.url

      if (skipNetwork) {
        return {
          bytes: tinyPng(),
          mimeType: "image/png",
          meta: {
            providerId: enterMode ? "pollinations-enter" : "pollinations",
            modelId: `${ref ? referenceModel : model}-dry-run`,
            seed,
            costUsdEst: 0,
          },
        }
      }

      if (ref && !enterMode) {
        console.warn(
          "[pollinations] referenceImages ignored — free host has no kontext; set IMAGE_SPIKE_POLLINATIONS_KEY"
        )
      }

      const useRef = Boolean(ref && enterMode)
      const activeModel = useRef ? referenceModel : model
      const promptPath = encodeURIComponent(req.prompt)
      const params = new URLSearchParams({
        width: String(width),
        height: String(height),
        seed: String(seed),
        model: activeModel,
        nologo: "true",
      })
      if (useRef && ref) {
        params.set("image", ref)
      }

      const base = enterMode ? ENTER_HOST : FREE_HOST
      const url = `${base}/${promptPath}?${params.toString()}`
      const headers: Record<string, string> = { Accept: "image/*" }
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`
      }

      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(180_000),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(
          `pollinations HTTP ${res.status}: ${body.slice(0, 400)}`
        )
      }
      const mimeType =
        res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg"
      const ab = await res.arrayBuffer()
      return {
        bytes: Buffer.from(ab),
        mimeType,
        meta: {
          providerId: enterMode ? "pollinations-enter" : "pollinations",
          modelId: activeModel,
          seed,
          costUsdEst,
          publicUrl: url,
        },
      }
    },
  }
}
