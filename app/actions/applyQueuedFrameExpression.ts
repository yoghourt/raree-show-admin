"use server"

import { z } from "zod"

import {
  executableRendererExpression,
  parseRendererExpression,
} from "@/lib/discovery/visual-contract"
import { patchQueuedSceneFrameRendererExpression } from "@/lib/generate-jobs"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export type ApplyQueuedFrameExpressionResult =
  | { ok: true }
  | { ok: false; message: string }

const inputSchema = z.object({
  workId: z.string().uuid(),
  jobId: z.string().uuid(),
  expression: z.unknown(),
})

/**
 * Replace renderer_expression on a still-queued scene_frame job snapshot.
 * Worker reads this snapshot at claim time — provenance-only edits would be ignored.
 */
export async function applyQueuedFrameExpression(input: {
  workId: string
  jobId: string
  expression: unknown
}): Promise<ApplyQueuedFrameExpressionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "参数无效。" }
  }

  const exprParsed = parseRendererExpression(parsed.data.expression)
  if (!exprParsed.ok) {
    return { ok: false, message: `Expression 无效：${exprParsed.errors.join("; ")}` }
  }
  const executable = executableRendererExpression(exprParsed.value)
  if (!executable) {
    return { ok: false, message: "Expression 是 stub，无法作为生成输入。" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "未登录，无法改排队 Expression。" }
  }

  const { data: row, error: fetchError } = await supabase
    .from("generate_jobs")
    .select("id, work_id, status, subject_type")
    .eq("id", parsed.data.jobId)
    .maybeSingle()

  if (fetchError) {
    return { ok: false, message: fetchError.message }
  }
  if (!row || row.work_id !== parsed.data.workId) {
    return { ok: false, message: "任务不存在或不属于当前作品。" }
  }
  if (row.subject_type !== "scene") {
    return { ok: false, message: "只能改画面帧任务的 Expression。" }
  }
  if (String(row.status) !== "queued") {
    return {
      ok: false,
      message: `任务已是 ${String(row.status)}，无法改排队快照。`,
    }
  }

  try {
    await patchQueuedSceneFrameRendererExpression(
      parsed.data.jobId,
      executable,
      supabase
    )
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}
