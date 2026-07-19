/**
 * SPEC-IMG-001 Image Generation Port — spike types only.
 * Do not import from production avatar / Copilot paths.
 */

export type PortraitRequest = {
  prompt: string
  referenceImages?: { url: string }[]
  seed?: number
  size?: { width: number; height: number }
}

export type PortraitResult = {
  bytes: Buffer
  mimeType: string
  meta: {
    providerId: string
    modelId: string
    seed?: number
    /** Observational estimate for spike cost reports only */
    costUsdEst?: number
    /**
     * Public URL of the generated image when the provider serves one.
     * Used by spike Phase B as referenceImages[].url without Cloudinary.
     */
    publicUrl?: string
  }
}

export type ImagePortraitProvider = {
  readonly name: string
  readonly capabilities: { referenceImage: boolean }
  generatePortrait(req: PortraitRequest): Promise<PortraitResult>
}

export type SpikeChannel = "draft" | "accept"

export type SpikeImageConfig = {
  draftProviderId: string
  acceptProviderId: string
  acceptModelId: string
  falKey?: string
  /** enter.pollinations.ai / gen.pollinations.ai Bearer key (spike). */
  pollinationsKey?: string
  geminiKey?: string
  siliconflowKey?: string
  /** e.g. https://api.siliconflow.com/v1 or https://api.siliconflow.cn/v1 */
  siliconflowApiBase?: string
  /** When true, adapters return a tiny PNG without network (architecture dry-run). */
  skipNetwork: boolean
}
