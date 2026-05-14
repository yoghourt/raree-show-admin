import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici"

let bootstrapDone = false

/**
 * Node 内置 fetch（undici）默认不会读取 HTTPS_PROXY。
 * 在调用 @google/genai 之前安装 EnvHttpProxyAgent，使标准代理环境变量生效：
 * HTTPS_PROXY / https_proxy、HTTP_PROXY / http_proxy、NO_PROXY / no_proxy。
 *
 * 若只想为 Gemini 指定代理（不影响其它出站），可设 GEMINI_HTTPS_PROXY（及可选 GEMINI_HTTP_PROXY、GEMINI_NO_PROXY）。
 */
export function ensureUndiciProxyDispatcherForGemini(): void {
  if (bootstrapDone) {
    return
  }
  bootstrapDone = true

  if (typeof window !== "undefined") {
    return
  }

  const geminiHttps = process.env.GEMINI_HTTPS_PROXY?.trim()
  const geminiHttp = process.env.GEMINI_HTTP_PROXY?.trim()
  const geminiNoProxy =
    process.env.GEMINI_NO_PROXY?.trim() || process.env.NO_PROXY?.trim()

  const hasStandardProxy =
    Boolean(process.env.HTTPS_PROXY?.trim()) ||
    Boolean(process.env.https_proxy?.trim()) ||
    Boolean(process.env.HTTP_PROXY?.trim()) ||
    Boolean(process.env.http_proxy?.trim())

  if (geminiHttps || geminiHttp) {
    setGlobalDispatcher(
      new EnvHttpProxyAgent({
        httpsProxy: geminiHttps || undefined,
        httpProxy: geminiHttp || undefined,
        noProxy: geminiNoProxy || undefined,
      })
    )
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[gemini] undici globalDispatcher: EnvHttpProxyAgent (GEMINI_HTTPS_PROXY / GEMINI_HTTP_PROXY)"
      )
    }
    return
  }

  if (hasStandardProxy) {
    setGlobalDispatcher(new EnvHttpProxyAgent())
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[gemini] undici globalDispatcher: EnvHttpProxyAgent (HTTPS_PROXY / HTTP_PROXY)"
      )
    }
  }
}
