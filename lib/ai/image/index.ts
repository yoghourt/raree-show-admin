import { createFalFluxProvider } from "./adapters/falFlux"
import { createGeminiPortraitProvider } from "./adapters/gemini"
import { createLocalHttpProvider } from "./adapters/localHttp"
import { createPollinationsProvider } from "./adapters/pollinations"
import { createSiliconFlowProvider } from "./adapters/siliconflow"
import { loadSpikeImageConfig } from "./config"
import type {
  ImagePortraitProvider,
  SpikeChannel,
  SpikeImageConfig,
} from "./types"

export type {
  ImagePortraitProvider,
  PortraitRequest,
  PortraitResult,
  SpikeChannel,
  SpikeImageConfig,
} from "./types"
export { loadSpikeImageConfig } from "./config"

function isFalModelId(id: string): boolean {
  return id.startsWith("fal-ai/")
}

function isGeminiModelId(id: string): boolean {
  return /^gemini/i.test(id) || /^imagen-/i.test(id)
}

function isSiliconFlowModelId(id: string): boolean {
  return (
    id.includes("/") &&
    !isFalModelId(id) &&
    !isGeminiModelId(id) &&
    id !== "kontext" &&
    id !== "flux"
  )
}

/**
 * Resolve a provider by opaque deployment id (spike factory).
 */
export function createImagePortraitProvider(
  providerId: string,
  config: SpikeImageConfig,
  channel: SpikeChannel = "accept"
): ImagePortraitProvider {
  const id = providerId.trim().toLowerCase()

  switch (id) {
    case "pollinations": {
      const enterKey =
        channel === "accept" ? config.pollinationsKey : undefined
      const acceptModel = config.acceptModelId.trim()
      const referenceModel =
        acceptModel &&
        !isFalModelId(acceptModel) &&
        !isGeminiModelId(acceptModel) &&
        !isSiliconFlowModelId(acceptModel)
          ? acceptModel
          : "kontext"
      return createPollinationsProvider({
        skipNetwork: config.skipNetwork,
        model: "flux",
        referenceModel,
        apiKey: enterKey,
        costUsdEst: 0,
      })
    }
    case "fal":
      return createFalFluxProvider({
        apiKey: config.falKey,
        modelId: config.acceptModelId,
        skipNetwork: config.skipNetwork,
        costUsdEstPerImage: 0.025,
      })
    case "gemini":
      return createGeminiPortraitProvider({
        apiKey: config.geminiKey,
        modelId:
          isFalModelId(config.acceptModelId) ||
          config.acceptModelId === "kontext" ||
          isSiliconFlowModelId(config.acceptModelId)
            ? "gemini-2.5-flash-image"
            : config.acceptModelId,
        skipNetwork: config.skipNetwork,
        costUsdEstPerImage: 0.04,
      })
    case "siliconflow":
      return createSiliconFlowProvider({
        apiKey: config.siliconflowKey,
        apiBase: config.siliconflowApiBase,
        modelId: isSiliconFlowModelId(config.acceptModelId.trim())
          ? config.acceptModelId.trim()
          : "black-forest-labs/FLUX.1-Kontext-dev",
        skipNetwork: config.skipNetwork,
        costUsdEstPerImage: 0.03,
      })
    case "local":
      return createLocalHttpProvider({
        baseUrl: config.localBaseUrl,
        modelId: config.acceptModelId,
        skipNetwork: config.skipNetwork,
        costUsdEstPerImage: 0,
      })
    default:
      throw new Error(
        `Unknown IMAGE_SPIKE provider id "${providerId}". Known: pollinations, fal, gemini, siliconflow, local`
      )
  }
}

export function resolveSpikeChannelProvider(
  channel: SpikeChannel,
  config: SpikeImageConfig = loadSpikeImageConfig()
): ImagePortraitProvider {
  const providerId =
    channel === "draft" ? config.draftProviderId : config.acceptProviderId
  return createImagePortraitProvider(providerId, config, channel)
}
