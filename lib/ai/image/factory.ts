import { createFalFluxProvider } from "./adapters/falFlux"
import { createGeminiImageProvider } from "./adapters/gemini"
import { createLocalHttpProvider } from "./adapters/localHttp"
import { createOpenAiCompatibleImageProvider } from "./adapters/openAiCompatibleImages"
import { createPollinationsProvider } from "./adapters/pollinations"
import { createSiliconFlowProvider } from "./adapters/siliconflow"
import type {
  ImageAdapterEnv,
  ImageGenerationProvider,
  SpikeChannel,
} from "./types"

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
 * Resolve a provider by opaque deployment id (Port factory).
 * Used by Spike scripts and Creator Deployment Adapter.
 */
export function createImageGenerationProvider(
  providerId: string,
  config: ImageAdapterEnv,
  channel: SpikeChannel = "accept"
): ImageGenerationProvider {
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
      return createGeminiImageProvider({
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
          : "black-forest-labs/FLUX.1-dev",
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
    case "localai":
      return createOpenAiCompatibleImageProvider({
        providerId: "localai",
        baseUrl: config.localBaseUrl,
        apiKey: config.localAiApiKey,
        modelId: config.acceptModelId,
        skipNetwork: config.skipNetwork,
        costUsdEstPerImage: 0,
      })
    default:
      throw new Error(
        `Unknown image provider id "${providerId}". Known: pollinations, fal, gemini, siliconflow, local, localai`
      )
  }
}
