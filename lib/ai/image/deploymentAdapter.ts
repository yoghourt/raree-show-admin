import { createImagePortraitProvider } from "./factory"
import { loadCreatorImageDeploymentConfig } from "./deploymentConfig"
import type {
  CreatorImageDeploymentConfig,
  PortraitRequest,
  PortraitResult,
} from "./types"

export type CreatorPortraitGenerationResult = PortraitResult & {
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
  if (id === "local" && !config.localBaseUrl && !config.skipNetwork) {
    return "IMAGE_CREATOR_LOCAL_BASE not set"
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
 * Creator Runtime Deployment Adapter (ADR-010 A3 Constraint F).
 *
 * Tries Production Default provider first, then Fallback / Accept Baseline.
 * Business code MUST call this (or the Port factory) — never vendor SDKs directly.
 */
export async function generateCreatorPortrait(
  req: PortraitRequest,
  config: CreatorImageDeploymentConfig = loadCreatorImageDeploymentConfig()
): Promise<CreatorPortraitGenerationResult> {
  const primarySkip = softPrimarySkipReason(config.acceptProviderId, config)
  if (!primarySkip) {
    const primary = createImagePortraitProvider(
      config.acceptProviderId,
      config,
      "accept"
    )
    try {
      const result = await primary.generatePortrait(req)
      return { ...result, usedFallback: false }
    } catch (primaryErr) {
      const primaryError =
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr)
      return runFallback(req, config, primaryError)
    }
  }

  console.warn("[generateCreatorPortrait] skipping primary; trying fallback", {
    primary: config.acceptProviderId,
    fallback: config.acceptFallbackProviderId,
    reason: primarySkip,
  })
  return runFallback(req, config, primarySkip)
}

async function runFallback(
  req: PortraitRequest,
  config: CreatorImageDeploymentConfig,
  primaryError: string
): Promise<CreatorPortraitGenerationResult> {
  if (isSameProvider(config.acceptProviderId, config.acceptFallbackProviderId)) {
    throw new Error(
      `Creator portrait failed (provider=${config.acceptProviderId}: ${primaryError.slice(0, 240)})`
    )
  }

  const fallbackConfig: CreatorImageDeploymentConfig = {
    ...config,
    acceptModelId: config.fallbackModelId || config.acceptModelId,
  }
  const fallback = createImagePortraitProvider(
    config.acceptFallbackProviderId,
    fallbackConfig,
    "accept"
  )

  try {
    const result = await fallback.generatePortrait(req)
    return { ...result, usedFallback: true, primaryError }
  } catch (fallbackErr) {
    const fallbackMsg =
      fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
    throw new Error(
      `Creator portrait failed (primary=${config.acceptProviderId}: ${primaryError.slice(0, 180)}; fallback=${config.acceptFallbackProviderId}: ${fallbackMsg.slice(0, 180)})`
    )
  }
}
