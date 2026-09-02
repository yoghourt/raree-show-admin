"use server"

import { z } from "zod"

import { callDiscoveryTextLlm } from "@/lib/discovery/discovery-text-llm"
import { formatRequestError } from "@/lib/format-request-error"
import type { RendererExpression } from "@/lib/discovery/visual-contract"
import {
  applyCharacterLifeStageLooks,
  buildFrameExpressionProposePrompt,
  findLifeStageContradictions,
  parseFrameExpressionProposal,
} from "@/lib/prompts/frame-expression-propose"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { workTitleAndConventionFromRow } from "@/lib/prompts/work-visual-convention"

export type ProposeFrameExpressionResult =
  | { ok: true; rendererExpression: RendererExpression }
  | { ok: false; message: string }

const inputSchema = z.object({
  workId: z.string().uuid(),
  caption: z.string().trim().min(1),
  currentExpression: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
  operatorNote: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t.slice(0, 500) : undefined
    }),
  routeTitle: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
  characterCues: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        visualIdentity: z.string().optional(),
      })
    )
    .optional(),
})

/**
 * Propose Canonical Visual Expression from caption.
 * Does NOT write provenance / enqueue — operator confirms in UI.
 */
export async function proposeFrameExpression(input: {
  workId: string
  caption: string
  currentExpression?: string
  operatorNote?: string
  routeTitle?: string
  characterCues?: Array<{ name: string; visualIdentity?: string }>
}): Promise<ProposeFrameExpressionResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "提案参数无效（需要画面说明）。" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "未登录，无法提案 Expression。" }
  }

  let workTitle: string | undefined
  let visualConvention = ""
  const { data: work } = await supabase
    .from("works")
    .select("title, visual_convention")
    .eq("id", parsed.data.workId)
    .maybeSingle()
  const parsedWork = workTitleAndConventionFromRow(work)
  workTitle = parsedWork.title
  visualConvention = parsedWork.visualConvention

  const { data: characterRows } = await supabase
    .from("characters")
    .select("name, visual_identity")
    .eq("work_id", parsed.data.workId)

  const fromArchive = (characterRows ?? [])
    .map((row) => {
      const rec = row as { name?: unknown; visual_identity?: unknown }
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

  const characterCues = new Map<
    string,
    { name: string; visualIdentity?: string }
  >()
  for (const cue of fromArchive) {
    characterCues.set(cue.name.toLowerCase(), cue)
  }
  for (const cue of parsed.data.characterCues ?? []) {
    const key = cue.name.toLowerCase()
    const prev = characterCues.get(key)
    characterCues.set(key, {
      name: cue.name,
      visualIdentity: cue.visualIdentity?.trim() || prev?.visualIdentity,
    })
  }
  const mergedCues = [...characterCues.values()]

  const prompt = buildFrameExpressionProposePrompt({
    workTitle,
    visualConvention,
    routeTitle: parsed.data.routeTitle,
    caption: parsed.data.caption,
    currentExpression: parsed.data.currentExpression,
    operatorNote: parsed.data.operatorNote,
    characterCues: mergedCues,
  })

  try {
    const raw = await callDiscoveryTextLlm(prompt, { geminiJsonObject: true })
      const proposal = parseFrameExpressionProposal(raw)
    if (!proposal.ok) {
      return {
        ok: false,
        message: `Expression 无效：${proposal.errors.join("; ")}`,
      }
    }
    const rendererExpression = applyCharacterLifeStageLooks(
      proposal.value,
      mergedCues
    )
    const lifeStageErrors = findLifeStageContradictions(
      rendererExpression,
      mergedCues
    )
    if (lifeStageErrors.length > 0) {
      return {
        ok: false,
        message: `Expression 年龄/人生阶段与角色档案冲突：${lifeStageErrors.join("; ")}`,
      }
    }
    console.info("[proposeFrameExpression]", {
      workId: parsed.data.workId,
      captionLen: parsed.data.caption.length,
    })
    return { ok: true, rendererExpression }
  } catch (e) {
    const message = formatRequestError(e)
    console.warn("[proposeFrameExpression]", { ok: false, message })
    return { ok: false, message: `Expression 提案失败：${message}` }
  }
}
