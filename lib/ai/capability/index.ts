/**
 * Capability Runtime — sole product-facing AI entry (v1).
 * Product Runtime MUST import from here, not from lib/ai/image execution paths.
 */

export { imageGenerate } from "./imageGenerate"
export type {
  CapabilityId,
  CapabilitySurface,
  ImageGenerateAssetSlot,
  ImageGenerateCandidate,
  ImageGenerateInput,
} from "./types"
