import { GoogleGenAI, PersonGeneration } from "@google/genai"
import { setDefaultResultOrder } from "node:dns"

import { ensureUndiciProxyDispatcherForGemini } from "@/lib/ai/undici-proxy-bootstrap"

/**
 * 图像模型 ID（环境变量 GEMINI_IMAGE_MODEL，默认 gemini-2.5-flash-image）。
 *
 * - **Nano Banana**（`gemini-2.5-flash-image` 等）：走 `generateContent`；在 **Gemini API 免费层**
 *   上通常 **无可用配额**（易 429 / limit 0）。
 * - **Imagen**（以 `imagen-` 开头，如 `imagen-4.0-fast-generate-001`）：走 `generateImages`；
 *   仍为 **按量计费**，免费层不保证可用；开通计费后可在 AI Studio / 文档中选可用模型代码。
 *
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 * @see https://ai.google.dev/gemini-api/docs/imagen
 */
function resolveAvatarImageModel(): string {
  return (
    process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image"
  )
}

function isImagenModel(model: string): boolean {
  return /^imagen-/i.test(model)
}

/** Prefer IPv4 first to reduce undici "fetch failed" on some networks. */
try {
  setDefaultResultOrder("ipv4first")
} catch {
  /* non-Node or unsupported */
}

function resolveGeminiApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "未配置 API 密钥：请设置 GEMINI_API_KEY（或官方 SDK 使用的 GOOGLE_API_KEY）"
    )
  }
  return key
}

/**
 * 调用 Gemini **原生图模**（generateContent）或 **Imagen**（generateImages），返回图片字节。
 * 使用 GEMINI_API_KEY 或 GOOGLE_API_KEY（仅服务端）。
 */
export async function generateAvatarImageBytes(
  prompt: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = resolveGeminiApiKey()

  ensureUndiciProxyDispatcherForGemini()

  const model = resolveAvatarImageModel()

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 180_000,
    },
  })

  if (isImagenModel(model)) {
    const response = await ai.models.generateImages({
      model,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
        personGeneration: PersonGeneration.ALLOW_ADULT,
      },
    })

    const first = response.generatedImages?.[0]
    const img = first?.image
    const bytes = img?.imageBytes
    if (!bytes) {
      const reason = first?.raiFilteredReason
      throw new Error(
        reason
          ? `Imagen 未返回图片（可能被安全策略过滤）：${reason}`
          : "Imagen 未返回图片数据"
      )
    }
    const mimeType = img.mimeType?.trim() || "image/png"
    return {
      buffer: Buffer.from(bytes, "base64"),
      mimeType,
    }
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  })

  const parts = response.candidates?.[0]?.content?.parts
  if (!parts?.length) {
    throw new Error("Gemini returned no candidate parts")
  }

  for (const part of parts) {
    const inline = part.inlineData
    if (inline?.data) {
      const mimeType = inline.mimeType?.trim() || "image/png"
      const raw = inline.data
      const buffer =
        typeof raw === "string"
          ? Buffer.from(raw, "base64")
          : Buffer.from(raw as Uint8Array)
      return { buffer, mimeType }
    }
  }

  throw new Error("Gemini response contained no image inlineData")
}
