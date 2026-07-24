"use server"

import { z } from "zod"

import { generateImageCandidate } from "@/lib/ai/image"
import { uploadImageBufferToCloudinary } from "@/lib/cloudinary/serverUpload"
import { formatRequestError } from "@/lib/format-request-error"
import { buildAvatarPrompt } from "@/lib/prompts/avatar"

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

  const { name, description, characterTsid, referencePortraitUrl } = raw.data
  const prompt = buildAvatarPrompt(name, description)

  try {
    const portrait = await generateImageCandidate({
      assetSlot: "portrait",
      prompt,
      referenceImages: referencePortraitUrl
        ? [{ url: referencePortraitUrl }]
        : undefined,
      size: { width: 1024, height: 1024 },
    })
    let url: string
    try {
      url = await uploadImageBufferToCloudinary(
        portrait.bytes,
        portrait.mimeType
      )
    } catch (uploadErr) {
      const uploadMsg = formatRequestError(uploadErr)
      console.warn("[generateCharacterAvatar] cloudinary upload failed", {
        characterTsid: characterTsid ?? null,
        providerId: portrait.meta.providerId,
        modelId: portrait.meta.modelId,
        usedFallback: portrait.usedFallback,
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
      providerId: portrait.meta.providerId,
      modelId: portrait.meta.modelId,
      usedFallback: portrait.usedFallback,
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
