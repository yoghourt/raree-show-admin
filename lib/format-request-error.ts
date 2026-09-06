/**
 * Surfaces low-level network causes (e.g. undici "fetch failed") for admin UI.
 * Name the actual peer when the error includes a host; do not blame Google by default.
 */

function errorHaystack(err: unknown): { full: string; haystack: string } {
  if (!(err instanceof Error)) {
    const full = String(err);
    return { full, haystack: full.toLowerCase() };
  }
  const base = err.message;
  const cause = err.cause;
  let causeMsg = "";
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    causeMsg = code ? `${cause.message}, ${code}` : cause.message;
  }
  const detail = causeMsg ? ` (${causeMsg})` : "";
  const full = `${base}${detail}`;
  return { full, haystack: `${base} ${causeMsg}`.toLowerCase() };
}

function isConnectTimeout(haystack: string): boolean {
  return (
    haystack.includes("und_err_connect_timeout") ||
    haystack.includes("connect timeout")
  );
}

function isBareFetchFailed(err: unknown, haystack: string): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message === "fetch failed" ||
    haystack.includes("und_err_socket") ||
    haystack.includes("other side closed")
  );
}

function looksLikeCloudinary(haystack: string): boolean {
  return (
    haystack.includes("cloudinary") || haystack.includes("托管失败")
  );
}

function looksLikeGoogleApi(haystack: string): boolean {
  return (
    haystack.includes("googleapis.com") ||
    haystack.includes("generativelanguage") ||
    haystack.includes("google api") ||
    /\bgemini\b/.test(haystack)
  );
}

const PROXY_HINT =
  "若使用 HTTP 代理，请在运行进程的环境变量中设置 HTTPS_PROXY（及按需 NO_PROXY）并重启；Node fetch 需通过 EnvHttpProxyAgent 才会读取这些变量。";

function cloudinaryConnectAdvice(full: string): string {
  return `${full} — 无法在超时时间内连上 Cloudinary（api.cloudinary.com）。图片可能已在本地生成，失败发生在托管上传。请检查本机到 Cloudinary 的网络/防火墙，或配置 HTTPS_PROXY 后重试。${PROXY_HINT} 不必降低 IMAGE_CREATOR_LOCALAI_MAX_EDGE。`;
}

function googleConnectAdvice(full: string): string {
  return `${full} — 与 Google API 的 TCP 连接在超时时间内未建立（日志里多为约 10s）。已能解析到 Google IPv4 地址却仍超时，通常表示当前网络无法直连 Google（如地区策略、防火墙），不是密钥或业务代码配置错误。请使用可访问 Google 的网络或 VPN。${PROXY_HINT}`;
}

function genericConnectAdvice(full: string): string {
  return `${full} — TCP 连接超时。请检查本机网络、防火墙或 HTTPS_PROXY。${PROXY_HINT}`;
}

function cloudinaryFetchAdvice(full: string): string {
  return `${full} — 无法完成到 Cloudinary 的上传请求。请检查网络、代理或 VPN。${PROXY_HINT}`;
}

function googleFetchAdvice(full: string): string {
  return `${full} — 无法完成到 Google API 的网络请求。请检查网络、代理或 VPN；若仅有 DNS/IPv6 异常，可尝试使用 NODE_OPTIONS=--dns-result-order=ipv4first 启动。`;
}

function genericFetchAdvice(full: string): string {
  return `${full} — 无法完成出站网络请求。请检查网络、代理或 VPN。`;
}

export function formatRequestError(err: unknown): string {
  const { full, haystack } = errorHaystack(err);

  if (isConnectTimeout(haystack)) {
    if (looksLikeCloudinary(haystack)) return cloudinaryConnectAdvice(full);
    if (looksLikeGoogleApi(haystack)) return googleConnectAdvice(full);
    return genericConnectAdvice(full);
  }

  if (isBareFetchFailed(err, haystack)) {
    if (looksLikeCloudinary(haystack)) return cloudinaryFetchAdvice(full);
    if (looksLikeGoogleApi(haystack)) return googleFetchAdvice(full);
    return genericFetchAdvice(full);
  }

  return full;
}
