"use server"

import { z } from "zod"

import { callDiscoveryTextLlm } from "@/lib/discovery/discovery-text-llm"
import { formatRequestError } from "@/lib/format-request-error"
import {
  buildPortraitPrepProposePrompt,
  parsePortraitPrepProposal,
} from "@/lib/prompts/character-portrait-prep"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export type ProposeCharacterPortraitPrepResult =
  | { ok: true; description: string; visualIdentity: string }
  | { ok: false; message: string }

const inputSchema = z.object({
  workId: z.string().uuid(),
  workTitle: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
  name: z.string().trim().min(1),
  house: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
  description: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t : undefined
    }),
  currentVisualIdentity: z
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
      return t ? t : undefined
    }),
})

/**
 * Propose Reader-safe description + Creator visual identity.
 * Does NOT write characters / enqueue jobs — operator must confirm in UI
 * (batch path may persist after this returns).
 */
export async function proposeCharacterPortraitPrep(input: {
  workId: string
  workTitle?: string
  name: string
  house?: string
  description?: string
  currentVisualIdentity?: string
  operatorNote?: string
}): Promise<ProposeCharacterPortraitPrepResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "提案参数无效（需要角色姓名）。" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "未登录，无法纠偏简介。" }
  }

  let workTitle = parsed.data.workTitle
  if (!workTitle) {
    const { data: work } = await supabase
      .from("works")
      .select("title")
      .eq("id", parsed.data.workId)
      .maybeSingle()
    if (work && typeof (work as { title?: string }).title === "string") {
      workTitle = (work as { title: string }).title
    }
  }

  const prompt = buildPortraitPrepProposePrompt({
    workTitle,
    name: parsed.data.name,
    house: parsed.data.house,
    description: parsed.data.description,
    currentVisualIdentity: parsed.data.currentVisualIdentity,
    operatorNote: parsed.data.operatorNote,
  })

  try {
    const raw = await callDiscoveryTextLlm(prompt, { geminiJsonObject: true })
    const proposal = parsePortraitPrepProposal(raw)
    if (!proposal) {
      return { ok: false, message: "模型未返回可用的简介与视觉身份，请重试。" }
    }
    console.info("[proposeCharacterPortraitPrep]", {
      workId: parsed.data.workId,
      name: parsed.data.name,
      descriptionLen: proposal.description.length,
      identityLen: proposal.visualIdentity.length,
    })
    return {
      ok: true,
      description: proposal.description,
      visualIdentity: proposal.visualIdentity,
    }
  } catch (e) {
    const message = formatRequestError(e)
    console.warn("[proposeCharacterPortraitPrep]", { ok: false, message })
    return { ok: false, message: `简介纠偏失败：${message}` }
  }
}
