/**
 * Surfaces low-level network causes (e.g. undici "fetch failed") for admin UI.
 */
export function formatRequestError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err)
  }
  const base = err.message
  const cause = err.cause
  let causeMsg = ""
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code
    causeMsg = code ? `${cause.message}, ${code}` : cause.message
  }
  const detail = causeMsg ? ` (${causeMsg})` : ""
  const full = `${base}${detail}`
  const haystack = `${base} ${causeMsg}`.toLowerCase()

  const isConnectTimeout =
    haystack.includes("und_err_connect_timeout") ||
    haystack.includes("connect timeout")

  if (isConnectTimeout) {
    return `${full} — 与 Google API 的 TCP 连接在超时时间内未建立（日志里多为约 10s）。已能解析到 Google IPv4 地址却仍超时，通常表示当前网络无法直连 Google（如地区策略、防火墙），不是密钥或业务代码配置错误。请使用可访问 Google 的网络或 VPN；若使用 HTTP 代理，请在运行 Next 的环境变量中设置 HTTPS_PROXY（及按需 NO_PROXY），并重启 dev；本项目会在调用 Gemini 前为 undici 安装 EnvHttpProxyAgent 以识别上述变量。`
  }

  if (base === "fetch failed") {
    return `${full} — 无法完成到 Google API 的网络请求。请检查网络、代理或 VPN；若仅有 DNS/IPv6 异常，可尝试使用 NODE_OPTIONS=--dns-result-order=ipv4first 启动 dev。`
  }

  return full
}
