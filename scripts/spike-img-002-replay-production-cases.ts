/**
 * SPIKE-IMG-002 — replay SPIKE-IMG-001 production cases on local only.
 *
 * Does NOT call cloud. Uses the same character descriptions, variant prompts,
 * and seeds as spike-img-001-portrait-consistency.ts. Side-by-side HTML points
 * at existing spike-output/spike-img-001 images.
 *
 * Prerequisites:
 *   - Local server: POST http://127.0.0.1:8191/v1/portraits
 *   - Existing production artifacts under spike-output/spike-img-001/C{1,2,3}/
 *
 * Usage (from repo root):
 *   IMAGE_SPIKE_ACCEPT_PROVIDER=local \
 *   IMAGE_SPIKE_LOCAL_BASE=http://127.0.0.1:8191 \
 *   IMAGE_SPIKE_ACCEPT_MODEL=sdxl-turbo \
 *   IMAGE_SPIKE_SKIP_NETWORK=0 \
 *     npx tsx scripts/spike-img-002-replay-production-cases.ts
 *
 * Optional:
 *   IMAGE_SPIKE_REPLAY_SIZE=512   # match production variant size (default 512)
 *   IMAGE_SPIKE_REPLAY_ONLY=C1    # only one character
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  createImagePortraitProvider,
  loadSpikeImageConfig,
} from "../lib/ai/image"

type SampleCharacter = {
  id: string
  name: string
  description: string
}

/** Must match scripts/spike-img-001-portrait-consistency.ts */
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

const VARIANT_PROMPTS = [
  "same character identity, slight smile, facing camera, bust portrait",
  "same character identity, three-quarter view, soft side light, bust portrait",
  "same character identity, serious expression, plain studio background, bust portrait",
  "same character identity, looking slightly left, cool daylight, bust portrait",
  "same character identity, looking slightly right, warm light, bust portrait",
  "same character identity, neutral expression, soft vignette, bust portrait",
]

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function findProdFile(
  dir: string,
  basenames: string[]
): Promise<string | null> {
  for (const name of basenames) {
    const p = path.join(dir, name)
    if (await fileExists(p)) return p
  }
  return null
}

function mimeFromExt(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

function buildVariantPrompt(c: SampleCharacter, vp: string): string {
  return `${c.description}. ${vp}. Match the reference character identity closely. Digital illustration, no text, no watermark.`
}

function buildCanonicalPrompt(c: SampleCharacter): string {
  return `${c.description}. Single official character portrait bust, neutral studio background, clear readable face, digital illustration, high quality, no text, no watermark.`
}

async function main() {
  const config = loadSpikeImageConfig({
    ...process.env,
    IMAGE_SPIKE_ACCEPT_PROVIDER:
      process.env.IMAGE_SPIKE_ACCEPT_PROVIDER || "local",
  })

  if (config.acceptProviderId.trim().toLowerCase() !== "local") {
    throw new Error(
      `This replay script expects IMAGE_SPIKE_ACCEPT_PROVIDER=local (got "${config.acceptProviderId}")`
    )
  }
  if (config.skipNetwork) {
    throw new Error("Set IMAGE_SPIKE_SKIP_NETWORK=0 and start the local server")
  }
  if (!config.localBaseUrl) {
    throw new Error("Set IMAGE_SPIKE_LOCAL_BASE=http://127.0.0.1:8191")
  }

  const size = Number(process.env.IMAGE_SPIKE_REPLAY_SIZE || "512")
  const only = process.env.IMAGE_SPIKE_REPLAY_ONLY?.trim().toUpperCase()
  const samples = only
    ? SAMPLES.filter((s) => s.id === only)
    : SAMPLES
  if (samples.length === 0) {
    throw new Error(`IMAGE_SPIKE_REPLAY_ONLY=${only} matched no character`)
  }

  const prodRoot = path.join(process.cwd(), "spike-output", "spike-img-001")
  const outRoot = path.join(
    process.cwd(),
    "spike-output",
    "spike-img-002",
    "vs-production"
  )
  await mkdir(outRoot, { recursive: true })

  const provider = createImagePortraitProvider("local", config, "accept")
  const pairs: Array<{
    id: string
    variant: string
    prompt: string
    seed: number
    productionRel: string
    localRel: string
    latencyMs: number
    referencePassed: boolean
    note: string
  }> = []

  for (const sample of samples) {
    const prodDir = path.join(prodRoot, sample.id)
    const localDir = path.join(outRoot, sample.id)
    await mkdir(localDir, { recursive: true })

    const prodCanonical = await findProdFile(prodDir, [
      "canonical.jpg",
      "canonical.png",
      "canonical.webp",
    ])
    if (!prodCanonical) {
      throw new Error(`Missing production canonical for ${sample.id} under ${prodDir}`)
    }

    // Pass production canonical as reference (local server may ignore it today).
    const canBytes = await readFile(prodCanonical)
    const canMime = mimeFromExt(prodCanonical)
    const refUrl = `data:${canMime};base64,${canBytes.toString("base64")}`

    // Optional: local canonical with same draft prompt + seed 42 (no cloud).
    const localCanPath = path.join(localDir, "canonical.png")
    if (!(await fileExists(localCanPath))) {
      const t0 = Date.now()
      const can = await provider.generatePortrait({
        prompt: buildCanonicalPrompt(sample),
        seed: 42,
        size: { width: size, height: size },
      })
      await writeFile(localCanPath, can.bytes)
      console.log(
        `[local] ${sample.id} canonical.png ${Date.now() - t0}ms (seed=42, no ref)`
      )
    } else {
      console.log(`[resume] ${sample.id} canonical.png`)
    }

    for (let i = 0; i < VARIANT_PROMPTS.length; i++) {
      const vp = VARIANT_PROMPTS[i]!
      const prompt = buildVariantPrompt(sample, vp)
      const seed = 100 + i
      const varId = `var-${String(i + 1).padStart(2, "0")}`

      const prodVar = await findProdFile(prodDir, [
        `${varId}.jpg`,
        `${varId}.png`,
        `${varId}.webp`,
      ])
      if (!prodVar) {
        throw new Error(`Missing production ${sample.id}/${varId}.*`)
      }

      const localVarPath = path.join(localDir, `${varId}.png`)
      let latencyMs = 0
      if (await fileExists(localVarPath)) {
        console.log(`[resume] ${sample.id} ${varId}.png`)
      } else {
        const t0 = Date.now()
        const result = await provider.generatePortrait({
          prompt,
          seed,
          size: { width: size, height: size },
          referenceImages: [{ url: refUrl }],
        })
        latencyMs = Date.now() - t0
        await writeFile(localVarPath, result.bytes)
        console.log(
          `[local] ${sample.id} ${varId}.png ${latencyMs}ms (seed=${seed}, ref=prod canonical)`
        )
      }

      pairs.push({
        id: sample.id,
        variant: varId,
        prompt,
        seed,
        productionRel: path.relative(outRoot, prodVar),
        localRel: path.relative(outRoot, localVarPath),
        latencyMs,
        referencePassed: true,
        note:
          "referenceImages sent to local adapter; scripts/local_portrait_server.py currently ignores reference_url",
      })
    }
  }

  const manifest = {
    spike: "SPIKE-IMG-002",
    mode: "replay-production-cases-local-only",
    generatedAt: new Date().toISOString(),
    productionRoot: path.relative(process.cwd(), prodRoot),
    localRoot: path.relative(process.cwd(), outRoot),
    size,
    modelId: config.acceptModelId,
    provider: provider.name,
    caseSource: "scripts/spike-img-001-portrait-consistency.ts (prompts+seeds)",
    pairs,
    howToCompare:
      "Open compare.html in a browser. Left = Production (SPIKE-IMG-001 SiliconFlow Kontext). Right = Local replay. Prefer pairwise pick; do not re-score Production.",
  }

  await writeFile(
    path.join(outRoot, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  )

  const rows = pairs
    .map((p) => {
      const title = `${p.id} / ${p.variant}`
      return `<section class="pair">
  <h2>${title}</h2>
  <p class="prompt">${escapeHtml(p.prompt)}</p>
  <div class="grid">
    <figure>
      <figcaption>Production (IMG-001)</figcaption>
      <img src="${escapeAttr(p.productionRel)}" alt="production ${title}" />
    </figure>
    <figure>
      <figcaption>Local replay</figcaption>
      <img src="${escapeAttr(p.localRel)}" alt="local ${title}" />
    </figure>
  </div>
</section>`
    })
    .join("\n")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SPIKE-IMG-002 vs Production</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #111; color: #eee; }
    h1 { font-size: 1.25rem; }
    .pair { margin-bottom: 48px; border-top: 1px solid #333; padding-top: 24px; }
    .prompt { font-size: 0.85rem; color: #aaa; max-width: 1100px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    figure { margin: 0; }
    figcaption { margin-bottom: 8px; font-weight: 600; }
    img { width: 100%; height: auto; background: #222; border-radius: 4px; }
    .note { color: #f6c; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>SPIKE-IMG-002 — Local replay of Production cases</h1>
  <p class="note">Left: existing cloud accept (Kontext + reference). Right: local (same prompts/seeds; reference may be ignored by local server).</p>
  <p>Model: ${escapeHtml(config.acceptModelId)} · size ${size} · ${pairs.length} pairs</p>
  ${rows}
</body>
</html>
`

  const htmlPath = path.join(outRoot, "compare.html")
  await writeFile(htmlPath, html)

  console.log(`\nWrote ${path.join(outRoot, "manifest.json")}`)
  console.log(`Open: ${htmlPath}`)
  console.log(`Pairs: ${pairs.length}`)
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replaceAll("'", "&#39;")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
