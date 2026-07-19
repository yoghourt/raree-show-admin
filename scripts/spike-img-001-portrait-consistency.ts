/**
 * SPIKE-IMG-001 — isolated portrait consistency runner.
 *
 * Allowlist only. Does not touch production avatar / Rollout / Copilot.
 *
 * Usage (EC-3 reference path — SiliconFlow Kontext):
 *   IMAGE_SPIKE_DRAFT_PROVIDER=pollinations \
 *   IMAGE_SPIKE_ACCEPT_PROVIDER=siliconflow \
 *   IMAGE_SPIKE_ACCEPT_MODEL=black-forest-labs/FLUX.1-Kontext-dev \
 *   IMAGE_SPIKE_SILICONFLOW_KEY=... \
 *     npx tsx scripts/spike-img-001-portrait-consistency.ts
 *
 * Dry-run only:
 *   IMAGE_SPIKE_SKIP_NETWORK=1 npx tsx scripts/spike-img-001-portrait-consistency.ts
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises"
import path from "node:path"

import {
  loadSpikeImageConfig,
  resolveSpikeChannelProvider,
} from "../lib/ai/image"

type SampleCharacter = {
  id: string
  name: string
  description: string
}

const SAMPLES: SampleCharacter[] = [
  {
    id: "C1",
    name: "Veteran knight",
    description:
      "Weathered male knight, grey-streaked beard, dented steel armor, stern eyes, medieval fantasy portrait",
  },
  {
    id: "C2",
    name: "Young mage",
    description:
      "Young woman mage, long dark hair, indigo robes, curious expression, medieval fantasy portrait",
  },
  {
    id: "C3",
    name: "Elder scholar",
    description:
      "Elderly scholar, white hair, deep wrinkles, brown robes, calm expression, medieval fantasy portrait",
  },
]

/** EC-3 minimum: ≥6 variants per sample character */
const VARIANTS_PER_CHARACTER = 6

const VARIANT_PROMPTS = [
  "same character identity, slight smile, facing camera, bust portrait",
  "same character identity, three-quarter view, soft side light, bust portrait",
  "same character identity, serious expression, plain studio background, bust portrait",
  "same character identity, looking slightly left, cool daylight, bust portrait",
  "same character identity, looking slightly right, warm light, bust portrait",
  "same character identity, neutral expression, soft vignette, bust portrait",
]

function buildCanonicalPrompt(c: SampleCharacter): string {
  return `${c.description}. Single official character portrait bust, neutral studio background, clear readable face, digital illustration, high quality, no text, no watermark.`
}

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png"
  if (mime.includes("webp")) return "webp"
  return "jpg"
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function mimeFromExt(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

async function findCanonical(
  dir: string
): Promise<{ path: string; bytes: Buffer; mimeType: string } | null> {
  for (const name of ["canonical.jpg", "canonical.png", "canonical.webp"]) {
    const p = path.join(dir, name)
    if (await fileExists(p)) {
      const bytes = await readFile(p)
      return { path: p, bytes, mimeType: mimeFromExt(p) }
    }
  }
  return null
}

async function main() {
  const config = loadSpikeImageConfig()
  const outRoot = path.join(process.cwd(), "spike-output", "spike-img-001")
  await mkdir(outRoot, { recursive: true })

  if (!config.skipNetwork) {
    const acceptId = config.acceptProviderId.trim().toLowerCase()
    if (acceptId === "fal") {
      if (!config.falKey) {
        throw new Error(
          "EC-3 fal accept requires IMAGE_SPIKE_FAL_KEY or FAL_KEY"
        )
      }
    } else if (acceptId === "pollinations") {
      if (!config.pollinationsKey) {
        throw new Error(
          "EC-3 pollinations accept requires IMAGE_SPIKE_POLLINATIONS_KEY (enter.pollinations.ai)"
        )
      }
    } else if (acceptId === "gemini") {
      if (!config.geminiKey) {
        throw new Error(
          "EC-3 gemini accept requires IMAGE_SPIKE_GEMINI_KEY or GEMINI_API_KEY"
        )
      }
    } else if (acceptId === "siliconflow") {
      if (!config.siliconflowKey) {
        throw new Error(
          "EC-3 siliconflow accept requires IMAGE_SPIKE_SILICONFLOW_KEY or SILICONFLOW_API_KEY"
        )
      }
    } else {
      throw new Error(
        `EC-3 requires IMAGE_SPIKE_ACCEPT_PROVIDER=fal|pollinations|gemini|siliconflow (got "${config.acceptProviderId}")`
      )
    }
  }

  const draft = resolveSpikeChannelProvider("draft", config)
  const accept = resolveSpikeChannelProvider("accept", config)

  if (!config.skipNetwork && !accept.capabilities.referenceImage) {
    throw new Error(
      `EC-3 requires accept.capabilities.referenceImage=true (got ${accept.name})`
    )
  }

  const report: Record<string, unknown> = {
    spikeId: "SPIKE-IMG-001",
    startedAt: new Date().toISOString(),
    config: {
      draftProviderId: config.draftProviderId,
      acceptProviderId: config.acceptProviderId,
      acceptModelId: config.acceptModelId,
      skipNetwork: config.skipNetwork,
      hasFalKey: Boolean(config.falKey),
      hasPollinationsKey: Boolean(config.pollinationsKey),
      hasGeminiKey: Boolean(config.geminiKey),
      hasSiliconflowKey: Boolean(config.siliconflowKey),
    },
    draftProviderName: draft.name,
    acceptProviderName: accept.name,
    variantsPerCharacter: VARIANTS_PER_CHARACTER,
    characters: [] as unknown[],
    totals: {
      draftCalls: 0,
      acceptCalls: 0,
      costUsdEst: 0,
    },
  }

  let draftCalls = 0
  let acceptCalls = 0
  let costUsdEst = 0

  for (const sample of SAMPLES) {
    const dir = path.join(outRoot, sample.id)
    await mkdir(dir, { recursive: true })

    const existingCanonical = await findCanonical(dir)
    let canonicalBytes: Buffer
    let canonicalMime: string
    let canExt: string
    let canonicalMeta: Record<string, unknown>

    if (existingCanonical) {
      console.log(`[resume] ${sample.id} reuse ${path.basename(existingCanonical.path)}`)
      canonicalBytes = existingCanonical.bytes
      canonicalMime = existingCanonical.mimeType
      canExt = extForMime(canonicalMime)
      canonicalMeta = {
        providerId: "resume",
        modelId: "local-file",
        costUsdEst: 0,
      }
    } else {
      const canonicalPrompt = buildCanonicalPrompt(sample)
      const canonical = await draft.generatePortrait({
        prompt: canonicalPrompt,
        seed: 42,
        size: { width: 768, height: 768 },
      })
      draftCalls += 1
      costUsdEst += canonical.meta.costUsdEst ?? 0
      canonicalBytes = canonical.bytes
      canonicalMime = canonical.mimeType
      canExt = extForMime(canonical.mimeType)
      canonicalMeta = canonical.meta as unknown as Record<string, unknown>
      await writeFile(path.join(dir, `canonical.${canExt}`), canonical.bytes)
    }

    const refUrl = `data:${canonicalMime};base64,${canonicalBytes.toString("base64")}`
    const useReference =
      !config.skipNetwork && accept.capabilities.referenceImage === true
    const variants: unknown[] = []

    for (let i = 0; i < VARIANTS_PER_CHARACTER; i++) {
      const vp = VARIANT_PROMPTS[i]
      const prompt = `${sample.description}. ${vp}. Match the reference character identity closely. Digital illustration, no text, no watermark.`

      let resultBytes: Buffer
      let resultMime: string
      let resultMeta: Record<string, unknown>
      let vName: string | null = null
      for (const ext of ["jpg", "png", "webp"]) {
        const candidate = `var-${String(i + 1).padStart(2, "0")}.${ext}`
        const p = path.join(dir, candidate)
        if (await fileExists(p)) {
          vName = candidate
          resultBytes = await readFile(p)
          resultMime = mimeFromExt(p)
          resultMeta = {
            providerId: "resume",
            modelId: "local-file",
            costUsdEst: 0,
          }
          console.log(`[resume] ${sample.id} reuse ${candidate}`)
          break
        }
      }

      if (!vName) {
        const result = await accept.generatePortrait({
          prompt,
          seed: 100 + i,
          size: { width: 512, height: 512 },
          referenceImages: useReference ? [{ url: refUrl }] : undefined,
        })
        acceptCalls += 1
        costUsdEst += result.meta.costUsdEst ?? 0
        resultBytes = result.bytes
        resultMime = result.mimeType
        resultMeta = result.meta as unknown as Record<string, unknown>
        const vExt = extForMime(result.mimeType)
        vName = `var-${String(i + 1).padStart(2, "0")}.${vExt}`
        await writeFile(path.join(dir, vName), result.bytes)
      }

      variants.push({
        file: vName,
        prompt,
        meta: resultMeta!,
        usedReferenceImage: useReference,
        identityScore: null as number | null,
        promptAdherence: null as number | null,
        visualQuality: null as number | null,
      })
    }

    ;(report.characters as unknown[]).push({
      id: sample.id,
      name: sample.name,
      canonicalFile: `canonical.${canExt}`,
      canonicalMeta,
      referenceUrlAvailable: "(data: local canonical)",
      referenceApplied: useReference,
      referenceTransport: "data-url-from-canonical-bytes",
      variants,
    })
  }

  report.totals = { draftCalls, acceptCalls, costUsdEst }
  report.finishedAt = new Date().toISOString()
  report.acceptCapabilities = accept.capabilities
  report.ecNotes = {
    EC3: "Human scores filled post-run in scores.json / Findings; runner leaves nulls",
    variantsPerCharacter: VARIANTS_PER_CHARACTER,
    referencePath:
      accept.name === "siliconflow"
        ? "accept=siliconflow → /v1/images/generations with image/input_image reference"
        : accept.name === "gemini"
          ? "accept=gemini → generateContent multimodal (reference inlineData + prompt)"
          : accept.name === "pollinations-enter"
            ? "accept=pollinations-enter → kontext + image=canonical.publicUrl"
            : "accept=fal → flux/dev/image-to-image with referenceImages[0]=canonical.publicUrl",
  }

  const reportPath = path.join(outRoot, "report.json")
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8")
  console.log(JSON.stringify({ ok: true, reportPath, totals: report.totals }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
