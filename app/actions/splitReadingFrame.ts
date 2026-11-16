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
import { applySceneFrameStructure } from "@/lib/scene-context/apply-frame-structure"
import { isPositionalBijection } from "@/lib/scene-context/frame-identity"
import { syncFrameContextAppearanceFromExpression } from "@/lib/scene-context/frame-context-edit"
import { parseSceneContextsV1 } from "@/lib/scene-context/parse"
import {
  applyCharacterLifeStageLooks,
  buildFrameExpressionProposePrompt,
  findLifeStageContradictions,
  parseFrameExpressionProposal,
} from "@/lib/prompts/frame-expression-propose"
import {
  provenanceWithNewSplitSlots,
  reindexContextsAfterSplit,
  spliceFramesAtIndex,
  type ProductionBeatDraft,
} from "@/lib/production/split-reading-frame"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import type { RendererExpression } from "@/lib/discovery/visual-contract"
import { workTitleAndConventionFromRow } from "@/lib/prompts/work-visual-convention"

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
  const currentProvenance = parseFrameProvenance(row.frame_provenance_v1)
  const currentFrames = parseStoryImagesV2(row.story_images_v2)
  if (!isPositionalBijection(currentFrames.length, currentProvenance)) {
    return { ok: false, message: "画面身份不成立，已拒绝保存。" }
  }
  let provenance = provenanceWithNewSplitSlots(
    currentProvenance,
    frameIndex,
    inserted
  )
  let contexts = reindexContextsAfterSplit(
    parseSceneContextsV1(row.scene_contexts_v1),
    frameIndex,
    inserted
  )

  let persisted
  try {
    persisted = await applySceneFrameStructure(supabase, {
      workId,
      sceneTsid,
      expected: row.frame_provenance_v1 ?? [],
      storyImages: nextFrames,
      sceneContexts: contexts,
      provenance,
    })
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
  provenance = persisted.frameProvenance

  const { data: work } = await supabase
    .from("works")
    .select("title, visual_convention")
    .eq("id", workId)
    .maybeSingle()
  const parsedWork = workTitleAndConventionFromRow(work)
  const workTitle = parsedWork.title
  const visualConvention = parsedWork.visualConvention
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
        visualConvention,
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
      const expression = applyCharacterLifeStageLooks(
        proposal.value,
        characterCues
      )
      const lifeStageErrors = findLifeStageContradictions(
        expression,
        characterCues
      )
      if (lifeStageErrors.length > 0) {
        expressionWarnings.push(
          `画面 ${at + 1}：${lifeStageErrors.join("; ")}`
        )
        continue
      }
      newExpressions.push({ frameIndex: at, expression })
    } catch (e) {
      expressionWarnings.push(
        `画面 ${at + 1}：${formatRequestError(e)}`
      )
    }
  }

  if (newExpressions.length > 0) {
    for (const item of newExpressions) {
      provenance = provenance.map((entry) =>
        entry.frameIndex === item.frameIndex
          ? { ...entry, rendererExpression: item.expression }
          : entry
      )
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
    try {
      const expressed = await applySceneFrameStructure(supabase, {
        workId,
        sceneTsid,
        expected: persisted.frameProvenance,
        storyImages: nextFrames,
        sceneContexts: contexts,
        provenance,
      })
      provenance = expressed.frameProvenance
    } catch (e) {
      expressionWarnings.push(e instanceof Error ? e.message : String(e))
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
