import type { ImagePortraitProvider, PortraitRequest, PortraitResult } from "../types"

const DEFAULT_SIZE = { width: 768, height: 768 }

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
}

type FalImage = { url?: string; content_type?: string }

function resolveFalRunUrl(modelId: string, hasReference: boolean): string {
  if (hasReference) {
    return "https://fal.run/fal-ai/flux/dev/image-to-image"
  }
  const id = modelId.startsWith("fal-ai/") ? modelId : `fal-ai/${modelId}`
  return `https://fal.run/${id}`
}

/**
 * Accept-channel adapter via fal REST (no SDK dependency).
 * Default: fal-ai/flux/dev. With referenceImages[0].url → flux/dev/image-to-image.
 */
export function createFalFluxProvider(options: {
  apiKey?: string
  modelId?: string
  skipNetwork?: boolean
  costUsdEstPerImage?: number
}): ImagePortraitProvider {
  const modelId = options.modelId ?? "fal-ai/flux/dev"
  const skipNetwork = options.skipNetwork === true
  const costUsdEstPerImage = options.costUsdEstPerImage ?? 0.025

  return {
    name: "fal",
    capabilities: { referenceImage: true },
    async generatePortrait(req: PortraitRequest): Promise<PortraitResult> {
      const width = req.size?.width ?? DEFAULT_SIZE.width
      const height = req.size?.height ?? DEFAULT_SIZE.height
      const seed = req.seed
      const ref = req.referenceImages?.[0]?.url

      if (skipNetwork) {
        return {
          bytes: tinyPng(),
          mimeType: "image/png",
          meta: {
            providerId: "fal",
            modelId: `${modelId}-dry-run`,
            seed,
            costUsdEst: 0,
          },
        }
      }

      const apiKey = options.apiKey?.trim()
      if (!apiKey) {
        throw new Error(
          "fal adapter requires IMAGE_SPIKE_FAL_KEY or FAL_KEY (or IMAGE_SPIKE_SKIP_NETWORK=1)"
        )
      }

      const runUrl = resolveFalRunUrl(modelId, Boolean(ref))
      const body: Record<string, unknown> = {
        prompt: req.prompt,
        image_size: { width, height },
        num_images: 1,
        enable_safety_checker: true,
      }
      if (seed != null) body.seed = seed
      if (ref) {
        body.image_url = ref
        body.strength = 0.55
      }

      const res = await fetch(runUrl, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        throw new Error(`fal HTTP ${res.status}: ${errText.slice(0, 400)}`)
      }

      const json = (await res.json()) as {
        images?: FalImage[]
        seed?: number
      }
      const first = json.images?.[0]
      if (!first?.url) {
        throw new Error("fal response missing images[0].url")
      }

      const imgRes = await fetch(first.url, {
        signal: AbortSignal.timeout(120_000),
      })
      if (!imgRes.ok) {
        throw new Error(`fal image download HTTP ${imgRes.status}`)
      }
      const mimeType =
        first.content_type ||
        imgRes.headers.get("content-type")?.split(";")[0]?.trim() ||
        "image/jpeg"
      const ab = await imgRes.arrayBuffer()

      return {
        bytes: Buffer.from(ab),
        mimeType,
        meta: {
          providerId: "fal",
          modelId: ref ? "fal-ai/flux/dev/image-to-image" : modelId,
          seed: json.seed ?? seed,
          costUsdEst: costUsdEstPerImage,
          publicUrl: first.url,
        },
      }
    },
  }
}
