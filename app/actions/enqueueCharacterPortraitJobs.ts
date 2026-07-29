"use server"

import { z } from "zod"

import {
  enqueueGenerateJob,
  listGenerateJobsForWork,
  type CharacterPortraitJobInput,
  type GenerateJobRow,
} from "@/lib/generate-jobs"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export type EnqueueCharacterPortraitJobsResult =
  | { ok: true; jobs: GenerateJobRow[]; skipped: string[] }
  | { ok: false; message: string }

const characterSchema = z.object({
  characterTsid: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
  referenceUrl: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      if (!t) return undefined
      if (t.startsWith("http://") || t.startsWith("https://")) return t
      return undefined
    }),
})

const inputSchema = z.object({
  workId: z.string().uuid(),
  characters: z.array(characterSchema).min(1),
})

function hasInFlightPortraitJob(
  jobs: GenerateJobRow[],
  characterTsid: string
): boolean {
  return jobs.some(
    (job) =>
      job.subject_type === "character" &&
      job.subject_id === characterTsid &&
      (job.status === "queued" || job.status === "running")
  )
}

/**
 * CPP-C / SPIKE-IMG-003: enqueue character portrait intents as Execution jobs.
 * Does NOT call imageGenerate, create Candidates, or write portrait_url.
 */
export async function enqueueCharacterPortraitJobs(input: {
  workId: string
  characters: Array<{
    characterTsid: string
    name: string
    description?: string
    referenceUrl?: string
  }>
}): Promise<EnqueueCharacterPortraitJobsResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "排队参数无效（需要 workId 与至少一个已保存角色）。",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "未登录，无法排队生成。" }
  }

  let existing: GenerateJobRow[] = []
  try {
    existing = await listGenerateJobsForWork(parsed.data.workId, {
      limit: 100,
      client: supabase,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `读取现有任务失败：${message}` }
  }

  const jobs: GenerateJobRow[] = []
  const skipped: string[] = []

  try {
    for (const character of parsed.data.characters) {
      if (hasInFlightPortraitJob(existing, character.characterTsid)) {
        skipped.push(character.characterTsid)
        continue
      }

      const inputJson: CharacterPortraitJobInput = {
        asset_slot: "portrait",
        name: character.name,
        ...(character.description
          ? { description: character.description }
          : {}),
        ...(character.referenceUrl
          ? { reference_url: character.referenceUrl }
          : {}),
      }

      const job = await enqueueGenerateJob(
        {
          workId: parsed.data.workId,
          capabilityId: "image.generate",
          subjectType: "character",
          subjectId: character.characterTsid,
          inputJson,
          createdBy: user.id,
        },
        supabase
      )
      jobs.push(job)
      existing = [job, ...existing]
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn("[enqueueCharacterPortraitJobs]", { ok: false, message })
    return {
      ok: false,
      message:
        jobs.length > 0
          ? `已入队 ${jobs.length} 条后失败：${message}`
          : message,
    }
  }

  if (jobs.length === 0 && skipped.length > 0) {
    return {
      ok: false,
      message: "所选角色均已有 queued/running 肖像任务，未重复入队。",
    }
  }

  console.info("[enqueueCharacterPortraitJobs]", {
    workId: parsed.data.workId,
    enqueued: jobs.length,
    skipped: skipped.length,
  })
  return { ok: true, jobs, skipped }
}
