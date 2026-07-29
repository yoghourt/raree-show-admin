/**
 * Capability Runtime — product-facing surface (Runtime Truth v1).
 * Product Runtime depends on this layer only; not on Execution Platform / engines.
 */

export type CapabilityId = "image.generate"

export type CapabilitySurface = "creator" | "reader"

/** Business context for image.generate — not an execution provider. */
export type ImageGenerateAssetSlot = "portrait" | "scene_frame"

export type ImageGenerateInput = {
  surface: CapabilitySurface
  assetSlot?: ImageGenerateAssetSlot
  prompt: string
  /** Optional negatives forwarded to Execution adapters that support them. */
  negativePrompt?: string
  referenceImages?: { url: string }[]
  seed?: number
  size?: { width: number; height: number }
  clientJobId?: string
}

/**
 * Candidate handoff payload for Product Runtime.
 * MUST NOT imply Asset persistence — Accept remains Product Runtime.
 */
export type ImageGenerateCandidate = {
  bytes: Buffer
  mimeType: string
  usedFallback: boolean
}
