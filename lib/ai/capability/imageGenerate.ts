import { generateImageCandidate } from "@/lib/ai/image/deploymentAdapter"

import type { ImageGenerateCandidate, ImageGenerateInput } from "./types"

const CAPABILITY_ID = "image.generate" as const

/**
 * Capability Runtime entry: image.generate
 *
 * Owns: authorization, surface policy, deployment binding consumption (via
 * Execution path), primary/fallback, candidate handoff shape.
 * Does not write Assets.
 */
export async function imageGenerate(
  input: ImageGenerateInput
): Promise<ImageGenerateCandidate> {
  assertAuthorized(input)

  const started = Date.now()
  const result = await generateImageCandidate({
    assetSlot: input.assetSlot,
    prompt: input.prompt,
    referenceImages: input.referenceImages,
    seed: input.seed,
    size: input.size,
  })

  console.info("[capability:image.generate]", {
    clientJobId: input.clientJobId ?? null,
    surface: input.surface,
    assetSlot: input.assetSlot ?? null,
    durationMs: Date.now() - started,
    usedFallback: result.usedFallback,
    // Observational only — not a Product Runtime business key
    providerId: result.meta.providerId,
    modelId: result.meta.modelId,
  })

  return {
    bytes: result.bytes,
    mimeType: result.mimeType,
    usedFallback: result.usedFallback,
  }
}

function assertAuthorized(input: ImageGenerateInput): void {
  if (input.surface === "reader") {
    throw new Error(
      `${CAPABILITY_ID} is not authorized on surface=reader (Capability Runtime Policy v1)`
    )
  }
  if (input.surface !== "creator") {
    throw new Error(
      `${CAPABILITY_ID} rejected unknown surface (Capability Runtime Policy v1)`
    )
  }
}
