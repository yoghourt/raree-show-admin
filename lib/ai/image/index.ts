import { createImagePortraitProvider } from "./factory"
import { loadSpikeImageConfig } from "./config"
import type {
  ImagePortraitProvider,
  SpikeChannel,
  SpikeImageConfig,
} from "./types"

export type {
  CreatorImageDeploymentConfig,
  ImageAdapterEnv,
  ImagePortraitProvider,
  PortraitRequest,
  PortraitResult,
  SpikeChannel,
  SpikeImageConfig,
} from "./types"
export type { CreatorPortraitGenerationResult } from "./deploymentAdapter"
export { loadSpikeImageConfig } from "./config"
export { loadCreatorImageDeploymentConfig } from "./deploymentConfig"
export { generateCreatorPortrait } from "./deploymentAdapter"
export { createImagePortraitProvider } from "./factory"

export function resolveSpikeChannelProvider(
  channel: SpikeChannel,
  config: SpikeImageConfig = loadSpikeImageConfig()
): ImagePortraitProvider {
  const providerId =
    channel === "draft" ? config.draftProviderId : config.acceptProviderId
  return createImagePortraitProvider(providerId, config, channel)
}
