"use server"

import { z } from "zod"

import { executeSceneFrameImageGenerate } from "@/lib/generate-jobs/executeImageGenerate"

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
 * A4: Scene Frame draft via Capability Runtime `image.generate`.
 * Returns a hosted URL for ephemeral Media Admission Candidate only.
 * MUST NOT write Assets / story_images_v2.
 *
 * Migration compatibility only (SPIKE-IMG-003): prefer enqueueFrameDraftJobs +
 * Local Worker. Do not add new product features on this synchronous path.
 */
export async function generateFrameDraft(input: {
  caption: string
  routeTitle?: string
}): Promise<GenerateFrameDraftResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "缺少帧说明（Asset Caption）。" }
  }

  const result = await executeSceneFrameImageGenerate({
    caption: parsed.data.caption,
    routeTitle: parsed.data.routeTitle,
  })

  if (!result.ok) {
    console.warn("[generateFrameDraft]", {
      ok: false,
      message: result.message,
      durationMs: result.durationMs,
    })
    return { ok: false, message: result.message }
  }

  console.info("[generateFrameDraft]", {
    durationMs: result.durationMs,
    usedFallback: result.usedFallback,
    cloudinaryOk: true,
  })
  return { ok: true, url: result.url }
}
