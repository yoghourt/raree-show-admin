/**
 * SPEC-IMG-001 Image Generation Port types (capability-oriented naming).
 * Historical SPEC sketch used Portrait* names; implementation expresses reusable
 * image-generation capability. Behavior and Deployment bindings unchanged.
 */

/** Business context for the generation Job — not separate Port entry points. */
export type ImageAssetSlot = "portrait" | "scene_frame"

export type ImageGenerationRequest = {
  prompt: string
  /** Which Asset surface requested the candidate (observational / Job context). */
  assetSlot?: ImageAssetSlot
  referenceImages?: { url: string }[]
  seed?: number
  size?: { width: number; height: number }
}

export type ImageGenerationResult = {
  bytes: Buffer
  mimeType: string
  meta: {
    providerId: string
    modelId: string
    seed?: number
    /** Observational estimate for cost reports only — not Budget enforcement */
    costUsdEst?: number
    /**
     * Public URL of the generated image when the provider serves one.
     * Used by spike Phase B as referenceImages[].url without Cloudinary.
     */
    publicUrl?: string
  }
}

/**
 * Image Generation Port adapter shape.
 * Single capability: generate an image candidate — not portrait-/frame-specific APIs.
 */
export type ImageGenerationProvider = {
  readonly name: string
  readonly capabilities: { referenceImage: boolean }
  generate(req: ImageGenerationRequest): Promise<ImageGenerationResult>
}

/** Shared adapter credentials / endpoints (Deployment). */
export type ImageAdapterEnv = {
  acceptModelId: string
  falKey?: string
  pollinationsKey?: string
  geminiKey?: string
  siliconflowKey?: string
  siliconflowApiBase?: string
  localBaseUrl?: string
  /** Optional Bearer for OpenAI-compatible local hosts (e.g. LocalAI). */
  localAiApiKey?: string
  /** When true, adapters return a tiny PNG without network (spike dry-run). */
  skipNetwork: boolean
}

export type SpikeChannel = "draft" | "accept"

export type SpikeImageConfig = ImageAdapterEnv & {
  draftProviderId: string
  acceptProviderId: string
}

/**
 * Creator Runtime Deployment bindings (ADR-010 A3 Constraint F).
 * Defaults: Local primary · Cloud fallback. Replaceable via env.
 */
export type CreatorImageDeploymentConfig = ImageAdapterEnv & {
  acceptProviderId: string
  acceptFallbackProviderId: string
  /** Model id for the fallback (Cloud) channel when distinct from acceptModelId */
  fallbackModelId: string
}
