import { createImageGenerationProvider } from "./factory"
import { loadCreatorImageDeploymentConfig } from "./deploymentConfig"
import type {
  CreatorImageDeploymentConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./types"

export type ImageCandidateGenerationResult = ImageGenerationResult & {
  /** True when Cloud (or configured) fallback served the image after primary failure */
  usedFallback: boolean
  primaryError?: string
}

function isSameProvider(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function softPrimarySkipReason(
  providerId: string,
  config: CreatorImageDeploymentConfig
): string | null {
  const id = providerId.trim().toLowerCase()
  if (
    (id === "local" || id === "localai") &&
    !config.localBaseUrl &&
    !config.skipNetwork
  ) {
    return "IMAGE_CREATOR_LOCAL_BASE / IMAGE_CREATOR_LOCALAI_BASE not set"
  }
  if (id === "siliconflow" && !config.siliconflowKey && !config.skipNetwork) {
    return "SILICONFLOW_API_KEY / IMAGE_CREATOR_SILICONFLOW_KEY not set"
  }
  if (id === "fal" && !config.falKey && !config.skipNetwork) {
    return "FAL_KEY / IMAGE_CREATOR_FAL_KEY not set"
  }
  if (id === "gemini" && !config.geminiKey && !config.skipNetwork) {
    return "GEMINI_API_KEY / IMAGE_CREATOR_GEMINI_KEY not set"
  }
  return null
}

/**
 * Execution Runtime path for image generation (ADR-010 A3 Constraint F).
 *
 * Not a Product Runtime entry — call via Capability Runtime `imageGenerate`.
 * Tries Production Default provider first, then Fallback / Accept Baseline.
 */
export async function generateImageCandidate(
  req: ImageGenerationRequest,
  config: CreatorImageDeploymentConfig = loadCreatorImageDeploymentConfig()
): Promise<ImageCandidateGenerationResult> {
  const primarySkip = softPrimarySkipReason(config.acceptProviderId, config)
  if (!primarySkip) {
    const primary = createImageGenerationProvider(
      config.acceptProviderId,
      config,
      "accept"
    )
    try {
      const result = await primary.generate(req)
      return { ...result, usedFallback: false }
    } catch (primaryErr) {
      const primaryError =
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr)
      return runFallback(req, config, primaryError)
    }
  }

  return runFallback(req, config, primarySkip)
}

async function runFallback(
  req: ImageGenerationRequest,
  config: CreatorImageDeploymentConfig,
  primaryError: string
): Promise<ImageCandidateGenerationResult> {
  console.warn("[generateImageCandidate] primary failed; trying fallback", {
    primary: config.acceptProviderId,
    fallback: config.acceptFallbackProviderId,
    primaryError: primaryError.slice(0, 400),
    assetSlot: req.assetSlot ?? null,
  })

  if (isSameProvider(config.acceptProviderId, config.acceptFallbackProviderId)) {
    throw new Error(
      `Creator image generation failed (provider=${config.acceptProviderId}: ${primaryError.slice(0, 240)})`
    )
  }

  const fallbackSkip = softPrimarySkipReason(
    config.acceptFallbackProviderId,
    config
  )
  if (fallbackSkip) {
    console.warn("[generateImageCandidate] fallback skipped (missing creds)", {
      primary: config.acceptProviderId,
      fallback: config.acceptFallbackProviderId,
      primaryError: primaryError.slice(0, 240),
      fallbackSkip,
    })
    throw new Error(
      `Creator image generation failed (primary=${config.acceptProviderId}: ${primaryError.slice(0, 180)}; fallback=${config.acceptFallbackProviderId}: ${fallbackSkip})`
    )
  }

  const fallbackConfig: CreatorImageDeploymentConfig = {
    ...config,
    acceptModelId: config.fallbackModelId || config.acceptModelId,
  }
  const fallback = createImageGenerationProvider(
    config.acceptFallbackProviderId,
    fallbackConfig,
    "accept"
  )

  try {
    const result = await fallback.generate(req)
    console.info("[generateImageCandidate] fallback ok", {
      primary: config.acceptProviderId,
      fallback: config.acceptFallbackProviderId,
      primaryError: primaryError.slice(0, 240),
      providerId: result.meta.providerId,
      modelId: result.meta.modelId,
    })
    return { ...result, usedFallback: true, primaryError }
  } catch (fallbackErr) {
    const fallbackMsg =
      fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
    console.warn("[generateImageCandidate] fallback failed", {
      primary: config.acceptProviderId,
      fallback: config.acceptFallbackProviderId,
      primaryError: primaryError.slice(0, 240),
      fallbackError: fallbackMsg.slice(0, 240),
    })
    throw new Error(
      `Creator image generation failed (primary=${config.acceptProviderId}: ${primaryError.slice(0, 180)}; fallback=${config.acceptFallbackProviderId}: ${fallbackMsg.slice(0, 180)})`
    )
  }
}
