"use server"

import { z } from "zod"

import { callDiscoveryTextLlm } from "@/lib/discovery/discovery-text-llm"
import { formatRequestError } from "@/lib/format-request-error"
import {
  buildVisualIdentityProposePrompt,
  parseVisualIdentityProposal,
} from "@/lib/prompts/visual-identity-propose"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export type ProposeCharacterVisualIdentityResult =
  | { ok: true; visualIdentity: string }
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
      return t ? t.slice(0, 500) : undefined
    }),
})

/**
 * Propose a Creator visual_identity draft for portrait retry.
 * Does NOT write characters / enqueue jobs — operator must confirm in UI.
 */
export async function proposeCharacterVisualIdentity(input: {
  workId: string
  workTitle?: string
  name: string
  house?: string
  description?: string
  currentVisualIdentity?: string
  operatorNote?: string
}): Promise<ProposeCharacterVisualIdentityResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "提案参数无效（需要角色姓名）。" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: "未登录，无法提案视觉身份。" }
  }

  // Optional work title from DB when client omitted it.
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

  const prompt = buildVisualIdentityProposePrompt({
    workTitle,
    name: parsed.data.name,
    house: parsed.data.house,
    description: parsed.data.description,
    currentVisualIdentity: parsed.data.currentVisualIdentity,
    operatorNote: parsed.data.operatorNote,
  })

  try {
    const raw = await callDiscoveryTextLlm(prompt)
    const visualIdentity = parseVisualIdentityProposal(raw)
    if (!visualIdentity) {
      return { ok: false, message: "模型未返回可用的视觉身份文案，请重试。" }
    }
    console.info("[proposeCharacterVisualIdentity]", {
      workId: parsed.data.workId,
      name: parsed.data.name,
      len: visualIdentity.length,
    })
    return { ok: true, visualIdentity }
  } catch (e) {
    const message = formatRequestError(e)
    console.warn("[proposeCharacterVisualIdentity]", { ok: false, message })
    return { ok: false, message: `视觉身份提案失败：${message}` }
  }
}
