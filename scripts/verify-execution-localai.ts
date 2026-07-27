/**
 * Execution Platform Integration — LocalAI smoke verify.
 *
 * Dry-run (no network):
 *   npx tsx scripts/verify-execution-localai.ts
 *
 * Live (LocalAI must serve image model at BASE):
 *   VERIFY_LOCALAI_LIVE=1 \
 *   IMAGE_CREATOR_ACCEPT_PROVIDER=localai \
 *   IMAGE_CREATOR_LOCALAI_BASE=http://127.0.0.1:8080 \
 *   IMAGE_CREATOR_ACCEPT_MODEL=dreamshaper \
 *   npx tsx scripts/verify-execution-localai.ts
 *
 * Validates Execution + Capability path. Does not write Assets / touch Admin UI.
 */

import { imageGenerate } from "../lib/ai/capability"
import { createImageGenerationProvider } from "../lib/ai/image/factory"
import type { ImageAdapterEnv } from "../lib/ai/image/types"

/** Tiny PNG from skipNetwork is 70 bytes; live images must clear this floor. */
const LIVE_MIN_BYTES = 10_000

type ModelsList = {
  data?: Array<{ id?: string }>
}

function fail(message: string): never {
  console.error("[verify-execution-localai] FAIL", message)
  console.error(`
LocalAI live prerequisites:
  1. Start LocalAI on the BASE URL (default http://127.0.0.1:8080)
  2. Install an image model (e.g. dreamshaper) and set IMAGE_CREATOR_ACCEPT_MODEL
  3. curl -sS http://127.0.0.1:8080/v1/models
  Docs: https://localai.io/features/image-generation/
`)
  process.exit(1)
}

async function probeLocalAi(
  baseUrl: string,
  apiKey?: string
): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, "")}/v1/models`
  const headers: Record<string, string> = { accept: "application/json" }
  if (apiKey) headers.authorization = `Bearer ${apiKey}`

  let res: Response
  try {
    res = await fetch(url, { headers })
  } catch (err) {
    fail(
      `LocalAI unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    fail(`LocalAI probe HTTP ${res.status} at ${url}: ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as ModelsList
  const ids = (json.data ?? [])
    .map((m) => m.id?.trim())
    .filter((id): id is string => Boolean(id))

  console.info("[verify-execution-localai] probe.ok", {
    baseUrl,
    modelCount: ids.length,
  })
  return ids
}

function resolveModelId(explicit: string | undefined, available: string[]): string {
  if (explicit) {
    if (available.length > 0 && !available.includes(explicit)) {
      console.warn(
        `[verify-execution-localai] model "${explicit}" not listed in /v1/models; continuing anyway (ids: ${available.slice(0, 12).join(", ")}${available.length > 12 ? ", …" : ""})`
      )
    }
    return explicit
  }

  const preferred = available.find((id) =>
    /dreamshaper|sdxl-turbo|stablediffusion|sd-?1\.?5|turbo|lcm/i.test(id)
  )
  if (preferred) return preferred

  fail(
    "IMAGE_CREATOR_ACCEPT_MODEL not set and no obvious image model in /v1/models. Set IMAGE_CREATOR_ACCEPT_MODEL explicitly (e.g. dreamshaper)."
  )
}

async function main() {
  const live =
    process.env.VERIFY_LOCALAI_LIVE === "1" ||
    process.env.VERIFY_LOCALAI_LIVE === "true"

  const baseUrl = (
    process.env.IMAGE_CREATOR_LOCALAI_BASE?.trim() ||
    process.env.IMAGE_CREATOR_LOCAL_BASE?.trim() ||
    "http://127.0.0.1:8080"
  ).replace(/\/$/, "")
  const apiKey = process.env.IMAGE_CREATOR_LOCALAI_KEY?.trim()
  const explicitModel = process.env.IMAGE_CREATOR_ACCEPT_MODEL?.trim()

  let modelId = explicitModel || "stablediffusion"

  if (live) {
    const available = await probeLocalAi(baseUrl, apiKey)
    modelId = resolveModelId(explicitModel, available)
  }

  const config: ImageAdapterEnv = {
    acceptModelId: modelId,
    localBaseUrl: baseUrl,
    localAiApiKey: apiKey,
    skipNetwork: !live,
  }

  const provider = createImageGenerationProvider("localai", config, "accept")
  const direct = await provider.generate({
    prompt: "smoke test portrait, illustration style",
    assetSlot: "portrait",
    size: { width: 512, height: 512 },
  })

  if (!direct.bytes?.length) {
    fail("localai provider returned empty bytes")
  }
  if (direct.meta.providerId !== "localai") {
    fail(`expected meta.providerId=localai got ${direct.meta.providerId}`)
  }
  if (live && direct.bytes.length < LIVE_MIN_BYTES) {
    fail(
      `live image too small (${direct.bytes.length} bytes < ${LIVE_MIN_BYTES}); likely not a real generation`
    )
  }

  console.info("[verify-execution-localai] provider.ok", {
    live,
    bytes: direct.bytes.length,
    mimeType: direct.mimeType,
    modelId: direct.meta.modelId,
  })

  if (live) {
    process.env.IMAGE_CREATOR_ACCEPT_PROVIDER = "localai"
    process.env.IMAGE_CREATOR_LOCALAI_BASE = baseUrl
    process.env.IMAGE_CREATOR_ACCEPT_MODEL = modelId
    // Avoid accidental cloud spend during verify
    process.env.IMAGE_CREATOR_ACCEPT_FALLBACK = "localai"
    if (apiKey) process.env.IMAGE_CREATOR_LOCALAI_KEY = apiKey

    const candidate = await imageGenerate({
      surface: "creator",
      assetSlot: "portrait",
      prompt: "smoke test via capability image.generate",
      size: { width: 512, height: 512 },
    })

    if (candidate.bytes.length < LIVE_MIN_BYTES) {
      fail(
        `capability image too small (${candidate.bytes.length} bytes < ${LIVE_MIN_BYTES})`
      )
    }
    if (candidate.usedFallback) {
      fail("expected usedFallback=false (fallback isolated to localai)")
    }

    console.info("[verify-execution-localai] capability.ok", {
      bytes: candidate.bytes.length,
      mimeType: candidate.mimeType,
      usedFallback: candidate.usedFallback,
    })
  } else {
    console.info(
      "[verify-execution-localai] dry-run only; set VERIFY_LOCALAI_LIVE=1 for live LocalAI"
    )
  }

  console.info("[verify-execution-localai] PASS")
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error("[verify-execution-localai] FAIL", err)
  if (/grpc service not ready|failed to load model/i.test(msg)) {
    console.error(`
LocalAI model backend not ready (common on first image request):
  - Wait for the image backend to finish loading in LocalAI UI/logs
  - Confirm dreamshaper is an image model (not LLM-only)
  - Retry the same LIVE command after the backend is warm
`)
  } else {
    console.error(`
LocalAI live prerequisites:
  1. Start LocalAI (default http://127.0.0.1:8080)
  2. IMAGE_CREATOR_ACCEPT_MODEL=dreamshaper (or your model name)
  3. curl -sS http://127.0.0.1:8080/v1/models
`)
  }
  process.exit(1)
})
