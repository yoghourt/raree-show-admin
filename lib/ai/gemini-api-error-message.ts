import { formatRequestError } from "@/lib/format-request-error"

type GeminiErrorEnvelope = {
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

function tryParseGeminiErrorJson(err: unknown): GeminiErrorEnvelope | null {
  if (!(err instanceof Error)) {
    return null
  }
  const msg = err.message.trim()
  if (!msg.startsWith("{")) {
    return null
  }
  try {
    return JSON.parse(msg) as GeminiErrorEnvelope
  } catch {
    return null
  }
}

/**
 * Turns @google/genai JSON error bodies into short admin-facing text; falls back to network formatter.
 */
export function geminiFailureMessage(err: unknown): string {
  const envelope = tryParseGeminiErrorJson(err)
  const api = envelope?.error
  if (!api?.message) {
    return formatRequestError(err)
  }

  const code = api.code
  const status = api.status
  const firstLine = api.message.split("\n")[0]?.trim() ?? api.message

  if (code === 429 || status === "RESOURCE_EXHAUSTED") {
    return [
      "Gemini 返回 429（配额/用量已用尽）：当前 API Key 下该图片模型可能没有可用免费额度，或已达速率/日限额。",
      "请在 Google AI Studio 检查计费、配额与模型可用性：https://ai.google.dev/gemini-api/docs/rate-limits",
      `（接口摘要：${firstLine}）`,
    ].join(" ")
  }

  if (code === 403) {
    return `Gemini 返回 403（拒绝访问）：${firstLine}`
  }

  if (code === 401) {
    return `Gemini 返回 401（密钥无效或未授权）：${firstLine}`
  }

  if (code === 400) {
    return `Gemini 返回 400（请求无效）：${firstLine}`
  }

  const suffix =
    api.message.length > 900 ? `${api.message.slice(0, 900)}…` : api.message
  return `Gemini 错误${code != null ? ` (${code})` : ""}：${suffix}`
}
