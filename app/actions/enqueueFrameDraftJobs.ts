"use server"

import { z } from "zod"

import {
  enqueueGenerateJob,
  type GenerateJobRow,
  type SceneFrameJobInput,
} from "@/lib/generate-jobs"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export type EnqueueFrameDraftJobsResult =
  | { ok: true; jobs: GenerateJobRow[] }
  | { ok: false; message: string }

const frameSchema = z.object({
  sceneTsid: z.string().trim().min(1),
  frameIndex: z.number().int().min(0),
  caption: z.string().trim().min(1),
  routeTitle: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
  operatorRevision: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
})

const inputSchema = z.object({
  workId: z.string().uuid(),
  frames: z.array(frameSchema).min(1),
})

/**
 * SPIKE-IMG-003: enqueue image.generate intents as Execution jobs.
 * Does NOT call imageGenerate, create Candidates, or write Assets.
 */
export async function enqueueFrameDraftJobs(input: {
  workId: string
  frames: Array<{
    sceneTsid: string
    frameIndex: number
    caption: string
    routeTitle?: string
    operatorRevision?: string
  }>
}): Promise<EnqueueFrameDraftJobsResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "排队参数无效（需要 workId 与至少一帧 caption）。" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "未登录，无法排队生成。" }
  }

  const jobs: GenerateJobRow[] = []
  try {
    for (const frame of parsed.data.frames) {
      const inputJson: SceneFrameJobInput = {
        asset_slot: "scene_frame",
        frame_index: frame.frameIndex,
        caption: frame.caption,
        ...(frame.routeTitle ? { route_title: frame.routeTitle } : {}),
        ...(frame.operatorRevision
          ? { operator_revision: frame.operatorRevision }
          : {}),
      }
      const job = await enqueueGenerateJob(
        {
          workId: parsed.data.workId,
          capabilityId: "image.generate",
          subjectType: "scene",
          subjectId: frame.sceneTsid,
          inputJson,
          createdBy: user.id,
        },
        supabase
      )
      jobs.push(job)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn("[enqueueFrameDraftJobs]", { ok: false, message })
    return {
      ok: false,
      message:
        jobs.length > 0
          ? `已入队 ${jobs.length} 条后失败：${message}`
          : message,
    }
  }

  console.info("[enqueueFrameDraftJobs]", {
    workId: parsed.data.workId,
    enqueued: jobs.length,
  })
  return { ok: true, jobs }
}
