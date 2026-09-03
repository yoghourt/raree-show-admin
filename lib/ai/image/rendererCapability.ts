/**
 * Deployment renderer capability (ADR-010 / ADR-011 A5).
 * Prompt and pixel budgets are model-keyed — not Architecture constants.
 *
 * Official Z-Image-Turbo: default max_sequence_length = 512 tokens
 * (local pipeline may set 1024). Latin estimate ~4 chars/token → ~2000 chars.
 * This table uses 1800 as a conservative execute body until LocalAI
 * max_sequence_length is confirmed live.
 *
 * Size 512² is a CPU/draft knob, not the Z-Image native ceiling (1024²).
 */

export type RendererCapabilityFamily =
  | "z-image"
  | "sd35"
  | "cloud"
  | "local-generic";

export type RendererCapability = {
  id: string;
  family: RendererCapabilityFamily;
  promptBodyMaxChars: number;
  visualMaxChars: number;
  actionMaxChars: number;
  envMaxChars: number;
  compositionMaxChars: number;
  emphasisMaxChars: number;
  roleMaxChars: number;
  appearanceMaxChars: number;
  bioMaxChars: number;
  width: number;
  height: number;
  /** Official Z-Image-Turbo does not use CFG; negatives are inert. */
  negativePromptEffective: boolean;
};

/** RSD-002 Creator Local Default catalog id. */
export const CREATOR_LOCAL_DEFAULT_MODEL_ID = "Z-Image-Turbo";

/** Official default token window (demo / typical LocalAI). */
export const Z_IMAGE_DEFAULT_MAX_SEQUENCE_TOKENS = 512;
/** Official local pipeline option. */
export const Z_IMAGE_LOCAL_MAX_SEQUENCE_TOKENS = 1024;
/**
 * Conservative Latin chars for the 512-token window (~4 chars/token, 10% margin).
 * Not an Architecture ceiling.
 */
export const Z_IMAGE_CONSERVATIVE_PROMPT_CHARS = 1800;

export const Z_IMAGE_TURBO_CAPABILITY: RendererCapability = {
  id: "Z-Image-Turbo",
  family: "z-image",
  promptBodyMaxChars: Z_IMAGE_CONSERVATIVE_PROMPT_CHARS,
  visualMaxChars: 400,
  actionMaxChars: 480,
  envMaxChars: 160,
  compositionMaxChars: 120,
  emphasisMaxChars: 120,
  roleMaxChars: 48,
  appearanceMaxChars: 400,
  bioMaxChars: 240,
  width: 512,
  height: 512,
  negativePromptEffective: false,
};

/** sd-3.5-medium blank-avoidance budgets (rollback host). */
export const SD35_CAPABILITY: RendererCapability = {
  id: "sd-3.5-medium-ggml",
  family: "sd35",
  promptBodyMaxChars: 520,
  visualMaxChars: 80,
  actionMaxChars: 96,
  envMaxChars: 80,
  compositionMaxChars: 72,
  emphasisMaxChars: 72,
  roleMaxChars: 28,
  appearanceMaxChars: 220,
  bioMaxChars: 160,
  width: 512,
  height: 512,
  negativePromptEffective: true,
};

export const CLOUD_CAPABILITY: RendererCapability = {
  id: "cloud",
  family: "cloud",
  promptBodyMaxChars: 4000,
  visualMaxChars: 400,
  actionMaxChars: 800,
  envMaxChars: 240,
  compositionMaxChars: 160,
  emphasisMaxChars: 160,
  roleMaxChars: 48,
  appearanceMaxChars: 400,
  bioMaxChars: 240,
  width: 1024,
  height: 1024,
  negativePromptEffective: true,
};

export const LOCAL_GENERIC_CAPABILITY: RendererCapability = {
  id: "local-generic",
  family: "local-generic",
  promptBodyMaxChars: 740,
  visualMaxChars: 220,
  actionMaxChars: 280,
  envMaxChars: 80,
  compositionMaxChars: 72,
  emphasisMaxChars: 72,
  roleMaxChars: 28,
  appearanceMaxChars: 220,
  bioMaxChars: 160,
  width: 512,
  height: 512,
  negativePromptEffective: true,
};

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

export function lookupRendererCapabilityByModel(
  modelId: string
): RendererCapability {
  const id = normalizeModelId(modelId);
  if (!id) return Z_IMAGE_TURBO_CAPABILITY;
  if (id.includes("z-image") || id.includes("zimage")) {
    return { ...Z_IMAGE_TURBO_CAPABILITY, id: modelId.trim() || Z_IMAGE_TURBO_CAPABILITY.id };
  }
  if (id.includes("sd-3.5") || id.includes("sd3.5") || id.includes("sd35")) {
    return { ...SD35_CAPABILITY, id: modelId.trim() || SD35_CAPABILITY.id };
  }
  if (
    id.includes("flux") ||
    id.includes("kontext") ||
    id.includes("imagen") ||
    id.includes("gpt-image")
  ) {
    return { ...CLOUD_CAPABILITY, id: modelId.trim() || CLOUD_CAPABILITY.id };
  }
  return { ...LOCAL_GENERIC_CAPABILITY, id: modelId.trim() || LOCAL_GENERIC_CAPABILITY.id };
}

export function resolveRendererCapability(input?: {
  providerId?: string;
  modelId?: string;
}): RendererCapability {
  const provider = (input?.providerId ?? "").trim().toLowerCase();
  const modelId = (input?.modelId ?? "").trim();
  if (provider && provider !== "local" && provider !== "localai") {
    if (!modelId) return CLOUD_CAPABILITY;
    const looked = lookupRendererCapabilityByModel(modelId);
    if (looked.family === "local-generic") {
      return { ...CLOUD_CAPABILITY, id: modelId };
    }
    return looked;
  }
  // image-stack-defaults still lists sdxl-turbo as an env placeholder;
  // Creator Local Default (RSD-002) is Z-Image-Turbo.
  if (!modelId || normalizeModelId(modelId) === "sdxl-turbo") {
    return Z_IMAGE_TURBO_CAPABILITY;
  }
  return lookupRendererCapabilityByModel(modelId);
}

export function resolveRendererCapabilityFromEnv(
  env: NodeJS.ProcessEnv = process.env
): RendererCapability {
  return resolveRendererCapability({
    providerId: env.IMAGE_CREATOR_ACCEPT_PROVIDER,
    modelId: env.IMAGE_CREATOR_ACCEPT_MODEL,
  });
}
