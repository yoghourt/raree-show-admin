"use server"

import { z } from "zod"

import { generateAvatarImageBytes } from "@/lib/ai/gemini"
import { geminiFailureMessage } from "@/lib/ai/gemini-api-error-message"
import { uploadImageBufferToCloudinary } from "@/lib/cloudinary/serverUpload"
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
  })

  if (!raw.success) {
    return { ok: false, message: "请填写角色名称。" }
  }

  const { name, description, characterTsid } = raw.data
  const prompt = buildAvatarPrompt(name, description)

  try {
    const { buffer, mimeType } = await generateAvatarImageBytes(prompt)
    const url = await uploadImageBufferToCloudinary(buffer, mimeType)
    const durationMs = Date.now() - started
    console.info("[generateCharacterAvatar]", {
      characterTsid: characterTsid ?? null,
      durationMs,
      cloudinaryOk: true,
    })
    return { ok: true, url }
  } catch (e) {
    const message = geminiFailureMessage(e)
    console.warn("[generateCharacterAvatar]", {
      characterTsid: characterTsid ?? null,
      ok: false,
      message,
      raw: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, message }
  }
}
