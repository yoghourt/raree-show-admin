"use server"

import { z } from "zod"

import { generateImageCandidate } from "@/lib/ai/image"
import { uploadImageBufferToCloudinary } from "@/lib/cloudinary/serverUpload"
import { formatRequestError } from "@/lib/format-request-error"
import { buildFrameDraftPrompt } from "@/lib/prompts/frame-draft"

export type GenerateFrameDraftResult =
  | { ok: true; url: string }
  | { ok: false; message: string }

const inputSchema = z.object({
  caption: z.string().trim().min(1, "caption required"),
  routeTitle: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
})

/**
 * A4: Scene Frame draft via Image Generation Port + Deployment Adapter.
 * Returns a hosted URL for ephemeral Media Admission Candidate only.
 * MUST NOT write Assets / story_images_v2.
 *
 * Uses Port capability `generateImageCandidate` with assetSlot=scene_frame
 * (no Scene-Frame-specific Provider entry point).
 */
export async function generateFrameDraft(input: {
  caption: string
  routeTitle?: string
}): Promise<GenerateFrameDraftResult> {
  const started = Date.now()
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "缺少帧说明（Asset Caption）。" }
  }

  const { caption, routeTitle } = parsed.data
  const prompt = buildFrameDraftPrompt({ caption, routeTitle })

  try {
    const image = await generateImageCandidate({
      assetSlot: "scene_frame",
      prompt,
      size: { width: 1280, height: 720 },
    })
    let url: string
    try {
      url = await uploadImageBufferToCloudinary(image.bytes, image.mimeType)
    } catch (uploadErr) {
      const uploadMsg = formatRequestError(uploadErr)
      console.warn("[generateFrameDraft] cloudinary upload failed", {
        uploadMsg,
        providerId: image.meta.providerId,
        modelId: image.meta.modelId,
        usedFallback: image.usedFallback,
      })
      return {
        ok: false,
        message: `画面已生成，但托管失败：${uploadMsg}`,
      }
    }
    console.info("[generateFrameDraft]", {
      durationMs: Date.now() - started,
      providerId: image.meta.providerId,
      modelId: image.meta.modelId,
      usedFallback: image.usedFallback,
      cloudinaryOk: true,
    })
    return { ok: true, url }
  } catch (e) {
    const message = formatRequestError(e)
    console.warn("[generateFrameDraft]", {
      ok: false,
      message,
      raw: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, message }
  }
}
