"use server"

import { z } from "zod"

import { callDiscoveryTextLlm } from "@/lib/discovery/discovery-text-llm"
import { formatRequestError } from "@/lib/format-request-error"
import {
  cancelGenerateJob,
  listGenerateJobsForWork,
} from "@/lib/generate-jobs"
import {
  parseFrameProvenance,
  parseStoryImagesV2,
} from "@/lib/rollout/scenes-server"
import { syncFrameContextAppearanceFromExpression } from "@/lib/scene-context/frame-context-edit"
import { parseSceneContextsV1 } from "@/lib/scene-context/parse"
import {
  buildFrameExpressionProposePrompt,
  parseFrameExpressionProposal,
} from "@/lib/prompts/frame-expression-propose"
import {
  reindexContextsAfterSplit,
  reindexProvenanceAfterSplit,
  spliceFramesAtIndex,
  type ProductionBeatDraft,
} from "@/lib/production/split-reading-frame"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import type { RendererExpression } from "@/lib/discovery/visual-contract"

export type SplitReadingFrameResult =
  | {
      ok: true
      inserted: number
      expressionWarnings: string[]
    }
  | { ok: false; message: string }

const beatSchema = z.object({
  summary: z.string().trim().min(1),
})

const inputSchema = z.object({
  workId: z.string().uuid(),
  sceneTsid: z.string().trim().min(1),
  frameIndex: z.number().int().min(0),
  beats: z.array(beatSchema).min(2),
})

/**
 * Replace one multi-event Reading Frame with N single-beat frames.
 * Authors Expression per beat (same path as 画面帧 AI 提案). Cancels stale
 * generate jobs for this route at the split index and after.
 */
export async function splitReadingFrame(input: {
  workId: string
  sceneTsid: string
  frameIndex: number
  beats: ProductionBeatDraft[]
}): Promise<SplitReadingFrameResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "拆分参数无效（至少两条非空说明）。" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "未登录，无法拆分画面。" }
  }

  const { workId, sceneTsid, frameIndex, beats } = parsed.data

  const { data, error } = await supabase
    .from("scenes")
    .select(
      "title, chapter_number, chapter_title, story_images_v2, frame_provenance_v1, scene_contexts_v1"
    )
    .eq("work_id", workId)
    .eq("tsid", sceneTsid)
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: `故事不存在：${sceneTsid}` }
  }

  const row = data as {
    title?: unknown
    chapter_number?: unknown
    chapter_title?: unknown
    story_images_v2?: unknown
    frame_provenance_v1?: unknown
    scene_contexts_v1?: unknown
  }

  let nextFrames
  try {
    nextFrames = spliceFramesAtIndex(
      parseStoryImagesV2(row.story_images_v2),
      frameIndex,
      beats
    )
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }

  const inserted = beats.length
  let provenance = reindexProvenanceAfterSplit(
    parseFrameProvenance(row.frame_provenance_v1),
    frameIndex,
    inserted
  )
  let contexts = reindexContextsAfterSplit(
    parseSceneContextsV1(row.scene_contexts_v1),
    frameIndex,
    inserted
  )

  const { error: persistError } = await supabase
    .from("scenes")
    .update({
      story_images_v2: nextFrames,
      frame_provenance_v1: provenance,
      scene_contexts_v1: contexts,
    })
    .eq("work_id", workId)
    .eq("tsid", sceneTsid)

  if (persistError) {
    return { ok: false, message: persistError.message }
  }

  const { data: work } = await supabase
    .from("works")
    .select("title")
    .eq("id", workId)
    .maybeSingle()
  const workTitle =
    work && typeof (work as { title?: string }).title === "string"
      ? (work as { title: string }).title
      : undefined
  const routeTitle = typeof row.title === "string" ? row.title : undefined
  const chapterNumber =
    typeof row.chapter_number === "number" && Number.isFinite(row.chapter_number)
      ? row.chapter_number
      : 1
  const chapterTitle =
    typeof row.chapter_title === "string" ? row.chapter_title : null

  const { data: characterRows } = await supabase
    .from("characters")
    .select("tsid, name, visual_identity")
    .eq("work_id", workId)

  const characterCues = (characterRows ?? [])
    .map((raw) => {
      const rec = raw as { name?: unknown; visual_identity?: unknown }
      const name = typeof rec.name === "string" ? rec.name.trim() : ""
      if (!name) return null
      const visualIdentity =
        typeof rec.visual_identity === "string"
          ? rec.visual_identity.trim()
          : ""
      return {
        name,
        ...(visualIdentity ? { visualIdentity } : {}),
      }
    })
    .filter((c): c is { name: string; visualIdentity?: string } => c != null)

  const archiveCharacters = (characterRows ?? []).flatMap((raw) => {
    const rec = raw as { tsid?: unknown; name?: unknown }
    const charTsid = typeof rec.tsid === "string" ? rec.tsid.trim() : ""
    const name = typeof rec.name === "string" ? rec.name.trim() : ""
    return charTsid && name ? [{ tsid: charTsid, name }] : []
  })

  const expressionWarnings: string[] = []
  const newExpressions: Array<{
    frameIndex: number
    expression: RendererExpression
  }> = []

  for (let i = 0; i < inserted; i++) {
    const at = frameIndex + i
    const caption = nextFrames[at]?.caption ?? ""
    try {
      const prompt = buildFrameExpressionProposePrompt({
        workTitle,
        routeTitle,
        caption,
        characterCues,
      })
      const raw = await callDiscoveryTextLlm(prompt, { geminiJsonObject: true })
      const proposal = parseFrameExpressionProposal(raw)
      if (!proposal.ok) {
        expressionWarnings.push(`画面 ${at + 1}：${proposal.errors.join("; ")}`)
        continue
      }
      newExpressions.push({ frameIndex: at, expression: proposal.value })
    } catch (e) {
      expressionWarnings.push(
        `画面 ${at + 1}：${formatRequestError(e)}`
      )
    }
  }

  if (newExpressions.length > 0) {
    for (const item of newExpressions) {
      provenance = [
        ...provenance.filter((p) => p.frameIndex !== item.frameIndex),
        {
          sourceReviewId: `split_${frameIndex}_${item.frameIndex}`,
          frameIndex: item.frameIndex,
          rendererExpression: item.expression,
        },
      ]
      const frame = nextFrames[item.frameIndex]
      if (frame) {
        contexts = syncFrameContextAppearanceFromExpression({
          workId,
          readingRouteTsid: sceneTsid,
          frameIndex: item.frameIndex,
          frame,
          contexts,
          routeTitle: routeTitle ?? "",
          chapter_number: chapterNumber,
          chapter_title: chapterTitle,
          expression: item.expression,
          archiveCharacters,
        })
      }
    }
    const { error: exprError } = await supabase
      .from("scenes")
      .update({
        frame_provenance_v1: provenance,
        scene_contexts_v1: contexts,
      })
      .eq("work_id", workId)
      .eq("tsid", sceneTsid)
    if (exprError) {
      expressionWarnings.push(exprError.message)
    }
  }

  try {
    const jobs = await listGenerateJobsForWork(workId, {
      limit: 80,
      client: supabase,
    })
    for (const job of jobs) {
      if (job.subject_type !== "scene" || job.subject_id !== sceneTsid) continue
      const idx = job.input_json.frame_index
      if (typeof idx !== "number" || idx < frameIndex) continue
      await cancelGenerateJob(job.id, "split_reading_frame", supabase)
    }
  } catch (e) {
    expressionWarnings.push(
      `取消旧生成任务失败：${e instanceof Error ? e.message : String(e)}`
    )
  }

  return { ok: true, inserted, expressionWarnings }
}
