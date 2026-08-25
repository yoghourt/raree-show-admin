import { createImageGenerationProvider } from "./factory"
import { loadCreatorImageDeploymentConfig } from "./deploymentConfig"
import { assertNotBlankImage, BlankImageError } from "./blankImageGuard"
import {
  formatCreatorImageFailure,
  formatCreatorImagePrimaryAndFallbackFailure,
  formatImageAttemptError,
} from "./operatorErrorCopy"
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

function blankGuardDisabled(): boolean {
  return process.env.IMAGE_CREATOR_SKIP_BLANK_GUARD?.trim() === "1"
}

async function ensureUsableImage(
  result: ImageGenerationResult,
  label: string
): Promise<ImageGenerationResult> {
  if (blankGuardDisabled() || result.meta.providerId === "skip-network") {
    return result
  }
  try {
    await assertNotBlankImage(result.bytes)
    return result
  } catch (err) {
    if (err instanceof BlankImageError) {
      console.warn(`[generateImageCandidate] ${label} blank rejected`, {
        reason: err.assessment.reason,
        meanLuma: err.assessment.meanLuma,
        stdDev: err.assessment.stdDev,
        providerId: result.meta.providerId,
        modelId: result.meta.modelId,
      })
    }
    throw err
  }
}

/**
 * Execution Runtime path for image generation (ADR-010 A3 Constraint F).
 *
 * Not a Product Runtime entry — call via Capability Runtime `imageGenerate`.
 * Tries Production Default provider first, then Fallback / Accept Baseline.
 * Near-blank canvases fail the attempt so Local whiteouts can fall through to Cloud.
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
      const result = await ensureUsableImage(
        await primary.generate(req),
        "primary"
      )
      return { ...result, usedFallback: false }
    } catch (primaryErr) {
      const primaryError = formatImageAttemptError(primaryErr)
      return runFallback(req, config, primaryError)
    }
  }

  return runFallback(req, config, formatImageAttemptError(primarySkip))
}

async function runFallback(
  req: ImageGenerationRequest,
  config: CreatorImageDeploymentConfig,
  primaryError: string
): Promise<ImageCandidateGenerationResult> {
  const fallbackId = config.acceptFallbackProviderId.trim()
  if (!fallbackId) {
    throw new Error(
      formatCreatorImageFailure({
        providerId: config.acceptProviderId,
        error: primaryError,
      })
    )
  }

  console.warn("[generateImageCandidate] primary failed; trying fallback", {
    primary: config.acceptProviderId,
    fallback: fallbackId,
    primaryError: primaryError.slice(0, 400),
    assetSlot: req.assetSlot ?? null,
  })

  if (isSameProvider(config.acceptProviderId, fallbackId)) {
    throw new Error(
      formatCreatorImageFailure({
        providerId: config.acceptProviderId,
        error: primaryError,
      })
    )
  }

  const fallbackSkip = softPrimarySkipReason(fallbackId, config)
  if (fallbackSkip) {
    console.warn("[generateImageCandidate] fallback skipped (missing creds)", {
      primary: config.acceptProviderId,
      fallback: fallbackId,
      primaryError: primaryError.slice(0, 240),
      fallbackSkip,
    })
    throw new Error(
      formatCreatorImagePrimaryAndFallbackFailure({
        primaryProviderId: config.acceptProviderId,
        primaryError,
        fallbackProviderId: fallbackId,
        fallbackError: fallbackSkip,
      })
    )
  }

  const fallbackConfig: CreatorImageDeploymentConfig = {
    ...config,
    acceptModelId: config.fallbackModelId || config.acceptModelId,
  }
  const fallback = createImageGenerationProvider(
    fallbackId,
    fallbackConfig,
    "accept"
  )

  try {
    const result = await ensureUsableImage(
      await fallback.generate(req),
      "fallback"
    )
    console.info("[generateImageCandidate] fallback ok", {
      primary: config.acceptProviderId,
      fallback: fallbackId,
      primaryError: primaryError.slice(0, 240),
      providerId: result.meta.providerId,
      modelId: result.meta.modelId,
    })
    return { ...result, usedFallback: true, primaryError }
  } catch (fallbackErr) {
    const fallbackMsg = formatImageAttemptError(fallbackErr)
    console.warn("[generateImageCandidate] fallback failed", {
      primary: config.acceptProviderId,
      fallback: fallbackId,
      primaryError: primaryError.slice(0, 240),
      fallbackError: fallbackMsg.slice(0, 240),
    })
    throw new Error(
      formatCreatorImagePrimaryAndFallbackFailure({
        primaryProviderId: config.acceptProviderId,
        primaryError,
        fallbackProviderId: fallbackId,
        fallbackError: fallbackMsg,
      })
    )
  }
}
