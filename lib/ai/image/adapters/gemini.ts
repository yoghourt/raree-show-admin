import { GoogleGenAI } from "@google/genai"
import { setDefaultResultOrder } from "node:dns"

import { ensureUndiciProxyDispatcherForGemini } from "@/lib/ai/undici-proxy-bootstrap"

import type { ImagePortraitProvider, PortraitRequest, PortraitResult } from "../types"

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
}

function isImagenModel(model: string): boolean {
  return /^imagen-/i.test(model)
}

async function loadReferenceBytes(
  url: string
): Promise<{ mimeType: string; base64: string }> {
  if (url.startsWith("data:")) {
    const m = /^data:([^;]+);base64,(.+)$/i.exec(url)
    if (!m) throw new Error("invalid data: URL for referenceImages")
    return { mimeType: m[1], base64: m[2] }
  }
  const res = await fetch(url, {
    headers: { Accept: "image/*" },
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    throw new Error(`gemini reference fetch HTTP ${res.status}`)
  }
  const mimeType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg"
  const ab = await res.arrayBuffer()
  return {
    mimeType,
    base64: Buffer.from(ab).toString("base64"),
  }
}

/**
 * Spike accept adapter — Gemini native image models (e.g. gemini-2.5-flash-image).
 *
 * Reference path: multimodal `generateContent` with reference inlineData + prompt
 * (Gemini Developer API; does not use Vertex-only editImage SubjectReference).
 */
export function createGeminiPortraitProvider(options: {
  apiKey?: string
  modelId?: string
  skipNetwork?: boolean
  costUsdEstPerImage?: number
}): ImagePortraitProvider {
  const modelId = options.modelId?.trim() || "gemini-2.5-flash-image"
  const skipNetwork = options.skipNetwork === true
  const costUsdEstPerImage = options.costUsdEstPerImage ?? 0.04

  return {
    name: "gemini",
    capabilities: { referenceImage: true },
    async generatePortrait(req: PortraitRequest): Promise<PortraitResult> {
      const seed = req.seed

      if (skipNetwork) {
        return {
          bytes: tinyPng(),
          mimeType: "image/png",
          meta: {
            providerId: "gemini",
            modelId: `${modelId}-dry-run`,
            seed,
            costUsdEst: 0,
          },
        }
      }

      const apiKey = options.apiKey?.trim()
      if (!apiKey) {
        throw new Error(
          "gemini adapter requires IMAGE_SPIKE_GEMINI_KEY or GEMINI_API_KEY"
        )
      }

      if (isImagenModel(modelId)) {
        throw new Error(
          `gemini spike EC-3 requires a native image model (e.g. gemini-2.5-flash-image), not ${modelId}`
        )
      }

      ensureUndiciProxyDispatcherForGemini()

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { timeout: 180_000 },
      })

      const refUrl = req.referenceImages?.[0]?.url
      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = []

      if (refUrl) {
        const ref = await loadReferenceBytes(refUrl)
        parts.push({
          inlineData: { mimeType: ref.mimeType, data: ref.base64 },
        })
        parts.push({
          text: `${req.prompt}\n\nKeep the same character identity as the reference portrait above. Output a single bust portrait image only.`,
        })
      } else {
        parts.push({ text: req.prompt })
      }

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: "user", parts }],
      })

      const outParts = response.candidates?.[0]?.content?.parts
      if (!outParts?.length) {
        throw new Error("gemini generateContent returned no candidate parts")
      }

      for (const part of outParts) {
        const inline = part.inlineData
        if (inline?.data) {
          const mimeType = inline.mimeType?.trim() || "image/png"
          const raw = inline.data
          const bytes =
            typeof raw === "string"
              ? Buffer.from(raw, "base64")
              : Buffer.from(raw as Uint8Array)
          return {
            bytes,
            mimeType,
            meta: {
              providerId: "gemini",
              modelId,
              seed,
              costUsdEst: costUsdEstPerImage,
            },
          }
        }
      }

      throw new Error("gemini response contained no image inlineData")
    },
  }
}
