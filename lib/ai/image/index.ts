import { createImageGenerationProvider } from "./factory"
import { loadSpikeImageConfig } from "./config"
import type {
  ImageGenerationProvider,
  SpikeChannel,
  SpikeImageConfig,
} from "./types"

export type {
  CreatorImageDeploymentConfig,
  ImageAdapterEnv,
  ImageAssetSlot,
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  SpikeChannel,
  SpikeImageConfig,
} from "./types"
export type { ImageCandidateGenerationResult } from "./deploymentAdapter"
export { loadSpikeImageConfig } from "./config"
export { loadCreatorImageDeploymentConfig } from "./deploymentConfig"
export { generateImageCandidate } from "./deploymentAdapter"
export { createImageGenerationProvider } from "./factory"

export function resolveSpikeChannelProvider(
  channel: SpikeChannel,
  config: SpikeImageConfig = loadSpikeImageConfig()
): ImageGenerationProvider {
  const providerId =
    channel === "draft" ? config.draftProviderId : config.acceptProviderId
  return createImageGenerationProvider(providerId, config, channel)
}
