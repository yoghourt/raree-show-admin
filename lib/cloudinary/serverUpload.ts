/**
 * Server-side unsigned upload (same preset as browser `lib/cloudinary.ts`).
 * Avoids cloudinary Node SDK, which requires api_key even for unsigned presets.
 *
 * Uses undici Agent timeouts (default connect is 10s — too short from some
 * networks) and retries transient TCP failures. HTTPS_PROXY is applied via
 * EnvHttpProxyAgent; Node's built-in fetch does not read that env by itself.
 */

import {
  Agent,
  EnvHttpProxyAgent,
  fetch as undiciFetch,
  type Dispatcher,
} from "undici"

const CLOUDINARY_UPLOAD_URL =
  "https://api.cloudinary.com/v1_1/dnuxz94n5/image/upload"
const CONNECT_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 60_000
const MAX_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasStandardProxy(): boolean {
  return Boolean(
    process.env.HTTPS_PROXY?.trim() ||
      process.env.https_proxy?.trim() ||
      process.env.HTTP_PROXY?.trim() ||
      process.env.http_proxy?.trim()
  )
}

function uploadDispatcher(): Dispatcher {
  const timeouts = {
    connectTimeout: CONNECT_TIMEOUT_MS,
    headersTimeout: REQUEST_TIMEOUT_MS,
    bodyTimeout: REQUEST_TIMEOUT_MS,
  }
  if (hasStandardProxy()) {
    return new EnvHttpProxyAgent({
      ...timeouts,
      httpsProxy:
        process.env.HTTPS_PROXY?.trim() ||
        process.env.https_proxy?.trim() ||
        undefined,
      httpProxy:
        process.env.HTTP_PROXY?.trim() ||
        process.env.http_proxy?.trim() ||
        undefined,
      noProxy:
        process.env.NO_PROXY?.trim() ||
        process.env.no_proxy?.trim() ||
        undefined,
    })
  }
  return new Agent(timeouts)
}

export function isRetryableCloudinaryNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const cause = err instanceof Error ? err.cause : null
  const causeMsg = cause instanceof Error ? cause.message : ""
  const code =
    cause && typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code?: string }).code ?? "")
      : ""
  const haystack = `${message} ${causeMsg} ${code}`.toLowerCase()
  return (
    haystack.includes("und_err_connect_timeout") ||
    haystack.includes("connect timeout") ||
    haystack.includes("und_err_socket") ||
    haystack.includes("other side closed") ||
    haystack.includes("econnreset") ||
    haystack.includes("etimedout") ||
    haystack.includes("enotfound") ||
    message === "fetch failed"
  )
}

async function postOnce(
  formData: FormData,
  dispatcher: Dispatcher
): Promise<string> {
  const res = await undiciFetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData,
    dispatcher,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const data = (await res.json()) as {
    secure_url?: string
    error?: { message?: string }
  }

  if (!res.ok) {
    throw new Error(
      data.error?.message ?? `Cloudinary upload failed (HTTP ${res.status})`
    )
  }

  if (!data.secure_url) {
    throw new Error("Cloudinary response missing secure_url")
  }

  return data.secure_url
}

export async function uploadImageBufferToCloudinary(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg"

  const dispatcher = uploadDispatcher()
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const formData = new FormData()
    formData.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      `portrait.${ext}`
    )
    formData.append("upload_preset", "raree-show-admin")

    try {
      return await postOnce(formData, dispatcher)
    } catch (err) {
      const canRetry =
        attempt < MAX_ATTEMPTS && isRetryableCloudinaryNetworkError(err)
      if (!canRetry) {
        if (isRetryableCloudinaryNetworkError(err)) {
          const wrapped = new Error("Cloudinary upload failed")
          if (err instanceof Error) wrapped.cause = err
          throw wrapped
        }
        throw err
      }
      const waitMs = 800 * attempt
      console.warn("[cloudinary] upload retry", {
        attempt,
        waitMs,
        message: err instanceof Error ? err.message : String(err),
      })
      await sleep(waitMs)
    }
  }
  throw new Error("Cloudinary upload failed")
}
