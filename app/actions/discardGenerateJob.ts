"use server"

import { z } from "zod"

import { cancelGenerateJob } from "@/lib/generate-jobs"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export type DiscardGenerateJobResult =
  | { ok: true }
  | { ok: false; message: string }

const inputSchema = z.object({
  workId: z.string().uuid(),
  jobId: z.string().uuid(),
  reason: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t.slice(0, 2000) : "operator_discarded"
    }),
})

/**
 * Operator discard of a terminal portrait/frame job (succeeded|failed → cancelled).
 * Does not write Assets. Cancelled jobs are hidden from default Admin lists.
 */
export async function discardGenerateJob(input: {
  workId: string
  jobId: string
  reason?: string
}): Promise<DiscardGenerateJobResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "丢弃参数无效。" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "未登录，无法丢弃任务。" }
  }

  const { data: row, error: fetchError } = await supabase
    .from("generate_jobs")
    .select("id, work_id, status")
    .eq("id", parsed.data.jobId)
    .maybeSingle()

  if (fetchError) {
    return { ok: false, message: fetchError.message }
  }
  if (!row || row.work_id !== parsed.data.workId) {
    return { ok: false, message: "任务不存在或不属于当前作品。" }
  }
  if (row.status !== "succeeded" && row.status !== "failed") {
    return {
      ok: false,
      message: `仅可丢弃 succeeded/failed 任务（当前 ${row.status}）。`,
    }
  }

  try {
    await cancelGenerateJob(parsed.data.jobId, parsed.data.reason, supabase)
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}
