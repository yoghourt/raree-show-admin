/**
 * SPEC-IMG-001 Image Generation Port types.
 * Spike scripts and Creator production (ADR-010 A3) share this Port shape.
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
    /** Observational estimate for cost reports only — not Budget enforcement */
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

/** Shared adapter credentials / endpoints (Deployment). */
export type ImageAdapterEnv = {
  acceptModelId: string
  falKey?: string
  pollinationsKey?: string
  geminiKey?: string
  siliconflowKey?: string
  siliconflowApiBase?: string
  localBaseUrl?: string
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
