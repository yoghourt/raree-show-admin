import type { SpikeImageConfig } from "./types"

/**
 * Spike-only deployment config (IMAGE_SPIKE_*).
 * Production Runtime MUST NOT read these keys.
 */
export function loadSpikeImageConfig(
  env: NodeJS.ProcessEnv = process.env
): SpikeImageConfig {
  const skipNetwork =
    env.IMAGE_SPIKE_SKIP_NETWORK === "1" ||
    env.IMAGE_SPIKE_SKIP_NETWORK === "true"

  return {
    draftProviderId: (
      env.IMAGE_SPIKE_DRAFT_PROVIDER ?? "pollinations"
    ).trim(),
    acceptProviderId: (env.IMAGE_SPIKE_ACCEPT_PROVIDER ?? "fal").trim(),
    acceptModelId: (
      env.IMAGE_SPIKE_ACCEPT_MODEL ?? "fal-ai/flux/dev"
    ).trim(),
    falKey: env.IMAGE_SPIKE_FAL_KEY?.trim() || env.FAL_KEY?.trim() || undefined,
    pollinationsKey:
      env.IMAGE_SPIKE_POLLINATIONS_KEY?.trim() ||
      env.POLLINATIONS_API_KEY?.trim() ||
      undefined,
    geminiKey:
      env.IMAGE_SPIKE_GEMINI_KEY?.trim() ||
      env.GEMINI_API_KEY?.trim() ||
      env.GOOGLE_API_KEY?.trim() ||
      undefined,
    siliconflowKey:
      env.IMAGE_SPIKE_SILICONFLOW_KEY?.trim() ||
      env.SILICONFLOW_API_KEY?.trim() ||
      undefined,
    siliconflowApiBase:
      env.IMAGE_SPIKE_SILICONFLOW_BASE?.trim() ||
      env.SILICONFLOW_API_BASE?.trim() ||
      undefined,
    localBaseUrl: env.IMAGE_SPIKE_LOCAL_BASE?.trim() || undefined,
    skipNetwork,
  }
}
