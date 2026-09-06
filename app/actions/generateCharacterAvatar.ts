"use server"

/**
 * migration-compat only (SPIKE-IMG-003 / CPP-C).
 * Prefer enqueueCharacterPortraitJobs → Local Worker → Human Accept.
 * Do not expand product features on this sync path.
 */

import { z } from "zod"

import { imageGenerate } from "@/lib/ai/capability"
import { loadCreatorImageDeploymentConfig } from "@/lib/ai/image/deploymentConfig"
import { resolveRendererCapability } from "@/lib/ai/image/rendererCapability"
import { uploadImageBufferToCloudinary } from "@/lib/cloudinary/serverUpload"
import { formatRequestError } from "@/lib/format-request-error"
import {
  buildAvatarPrompt,
  buildAvatarNegativePrompt,
} from "@/lib/prompts/avatar"

export type GenerateCharacterAvatarState =
  | { ok: true; url: string }
  | { ok: false; message: string }

const formSchema = z.object({
  name: z.string().trim().min(1, "name required"),
  description: z.string(),
  characterTsid: z
    .string()
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : undefined)),
  referencePortraitUrl: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      if (!t) return undefined
      if (t.startsWith("http://") || t.startsWith("https://")) return t
      return undefined
    }),
})

export async function generateCharacterAvatar(
  _prevState: GenerateCharacterAvatarState | null,
  formData: FormData
): Promise<GenerateCharacterAvatarState> {
  const started = Date.now()
  const raw = formSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    characterTsid: formData.get("characterTsid") ?? undefined,
    referencePortraitUrl: formData.get("referencePortraitUrl") ?? undefined,
  })

  if (!raw.success) {
    return { ok: false, message: "请填写角色名称。" }
  }

  const { name, description, characterTsid } = raw.data
  const deployment = loadCreatorImageDeploymentConfig()
  const capability = resolveRendererCapability({
    providerId: deployment.acceptProviderId,
    modelId: deployment.acceptModelId,
  })
  const prompt = buildAvatarPrompt(name, description, undefined, capability)

  try {
    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: "portrait",
      prompt,
      negativePrompt: buildAvatarNegativePrompt(description),
      size: { width: capability.width, height: capability.height },
    })
    let url: string
    try {
      url = await uploadImageBufferToCloudinary(
        candidate.bytes,
        candidate.mimeType
      )
    } catch (uploadErr) {
      const uploadMsg = formatRequestError(uploadErr)
      console.warn("[generateCharacterAvatar] cloudinary upload failed", {
        characterTsid: characterTsid ?? null,
        usedFallback: candidate.usedFallback,
        uploadMsg,
      })
      return {
        ok: false,
        message: `图片已生成，但上传 Cloudinary 失败：${uploadMsg}`,
      }
    }
    const durationMs = Date.now() - started
    console.info("[generateCharacterAvatar]", {
      characterTsid: characterTsid ?? null,
      durationMs,
      cloudinaryOk: true,
      usedFallback: candidate.usedFallback,
    })
    return { ok: true, url }
  } catch (e) {
    const message = formatRequestError(e)
    console.warn("[generateCharacterAvatar]", {
      characterTsid: characterTsid ?? null,
      ok: false,
      message,
      raw: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, message }
  }
}
