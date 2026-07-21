import type { CreatorImageDeploymentConfig, ImageAdapterEnv } from "./types"

function sharedAdapterEnv(env: NodeJS.ProcessEnv): Omit<ImageAdapterEnv, "acceptModelId" | "skipNetwork" | "localBaseUrl"> {
  return {
    falKey: env.IMAGE_CREATOR_FAL_KEY?.trim() || env.FAL_KEY?.trim() || undefined,
    pollinationsKey:
      env.IMAGE_CREATOR_POLLINATIONS_KEY?.trim() ||
      env.POLLINATIONS_API_KEY?.trim() ||
      undefined,
    geminiKey:
      env.IMAGE_CREATOR_GEMINI_KEY?.trim() ||
      env.GEMINI_API_KEY?.trim() ||
      env.GOOGLE_API_KEY?.trim() ||
      undefined,
    siliconflowKey:
      env.IMAGE_CREATOR_SILICONFLOW_KEY?.trim() ||
      env.SILICONFLOW_API_KEY?.trim() ||
      undefined,
    siliconflowApiBase:
      env.IMAGE_CREATOR_SILICONFLOW_BASE?.trim() ||
      env.SILICONFLOW_API_BASE?.trim() ||
      undefined,
  }
}

/**
 * Creator production Deployment config (ADR-010 A3 Constraint F).
 *
 * Env (replaceable):
 * - IMAGE_CREATOR_ACCEPT_PROVIDER (default: local)
 * - IMAGE_CREATOR_ACCEPT_FALLBACK (default: siliconflow)
 * - IMAGE_CREATOR_ACCEPT_MODEL
 * - IMAGE_CREATOR_FALLBACK_MODEL
 * - IMAGE_CREATOR_LOCAL_BASE (e.g. http://127.0.0.1:8191)
 * - shared keys: SILICONFLOW_API_KEY / FAL_KEY / GEMINI_API_KEY …
 *
 * MUST NOT read IMAGE_SPIKE_* (spike isolation).
 */
export function loadCreatorImageDeploymentConfig(
  env: NodeJS.ProcessEnv = process.env
): CreatorImageDeploymentConfig {
  return {
    acceptProviderId: (env.IMAGE_CREATOR_ACCEPT_PROVIDER ?? "local").trim(),
    acceptFallbackProviderId: (
      env.IMAGE_CREATOR_ACCEPT_FALLBACK ?? "siliconflow"
    ).trim(),
    acceptModelId: (env.IMAGE_CREATOR_ACCEPT_MODEL ?? "sdxl-turbo").trim(),
    // Text-to-image default. Kontext requires `image` — used when a reference
    // portrait exists (adapter may upgrade), or set IMAGE_CREATOR_FALLBACK_MODEL.
    fallbackModelId: (
      env.IMAGE_CREATOR_FALLBACK_MODEL ?? "black-forest-labs/FLUX.1-dev"
    ).trim(),
    localBaseUrl:
      env.IMAGE_CREATOR_LOCAL_BASE?.trim() ||
      env.IMAGE_LOCAL_BASE?.trim() ||
      undefined,
    skipNetwork: false,
    ...sharedAdapterEnv(env),
  }
}
