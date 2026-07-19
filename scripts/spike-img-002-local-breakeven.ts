/**
 * SPIKE-IMG-002 — break-even desk model + optional local bench.
 *
 * Usage:
 *   IMAGE_SPIKE_ACCEPT_PROVIDER=local IMAGE_SPIKE_SKIP_NETWORK=1 \
 *     npx tsx scripts/spike-img-002-local-breakeven.ts
 *
 *   IMAGE_SPIKE_LOCAL_BASE=http://127.0.0.1:8191 IMAGE_SPIKE_SKIP_NETWORK=0 \
 *     npx tsx scripts/spike-img-002-local-breakeven.ts --bench
 *
 * Production paths MUST NOT import this script.
 */

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  createImagePortraitProvider,
  loadSpikeImageConfig,
} from "../lib/ai/image"

type Scenario = {
  id: "A" | "B" | "C"
  label: string
  engPersonDays: number
  maintPersonDaysPerYear: number
  years: number
  hardwareUsdPerYear: number
}

const ENG_RATE_USD = 600
const CLOUD_USD_PER_IMAGE = 0.03
const IMAGES_PER_WORK = 80

const SCENARIOS: Scenario[] = [
  {
    id: "A",
    label: "Research Spike only",
    engPersonDays: 4,
    maintPersonDaysPerYear: 0,
    years: 2,
    hardwareUsdPerYear: 267,
  },
  {
    id: "B",
    label: "Optional Deployment adapter + light ops",
    engPersonDays: 10,
    maintPersonDaysPerYear: 3,
    years: 2,
    hardwareUsdPerYear: 267,
  },
  {
    id: "C",
    label: "Local as primary accept path",
    engPersonDays: 20,
    maintPersonDaysPerYear: 6,
    years: 2,
    hardwareUsdPerYear: 267,
  },
]

function fixedCostUsd(s: Scenario): number {
  const eng = s.engPersonDays * ENG_RATE_USD
  const maint = s.maintPersonDaysPerYear * s.years * ENG_RATE_USD
  const hw = s.hardwareUsdPerYear * s.years
  return eng + maint + hw
}

function breakEven(s: Scenario) {
  const F = fixedCostUsd(s)
  const images = F / CLOUD_USD_PER_IMAGE
  const works = images / IMAGES_PER_WORK
  return {
    scenario: s.id,
    label: s.label,
    fixedCostUsd: Math.round(F),
    breakEvenImages: Math.round(images),
    breakEvenWorks: Math.round(works),
    cloudUsdPerImage: CLOUD_USD_PER_IMAGE,
    imagesPerWork: IMAGES_PER_WORK,
  }
}

async function maybeBench(): Promise<Record<string, unknown> | null> {
  const wantBench = process.argv.includes("--bench")
  if (!wantBench) return null

  const config = loadSpikeImageConfig({
    ...process.env,
    IMAGE_SPIKE_ACCEPT_PROVIDER: process.env.IMAGE_SPIKE_ACCEPT_PROVIDER || "local",
  })
  const provider = createImagePortraitProvider(
    config.acceptProviderId,
    config,
    "accept"
  )

  const outDir = path.join(process.cwd(), "spike-output", "spike-img-002", "images")
  await mkdir(outDir, { recursive: true })

  const prompt =
    process.env.IMAGE_SPIKE_BENCH_PROMPT?.trim() ||
    "Portrait of a weary middle-aged man in a worn yellow coat, 19th-century Paris, oil painting realism, face centered"

  const n = Number(process.env.IMAGE_SPIKE_BENCH_N || "3")
  const latenciesMs: number[] = []
  const files: string[] = []

  for (let i = 0; i < n; i++) {
    const t0 = Date.now()
    const result = await provider.generatePortrait({
      prompt,
      seed: 1000 + i,
      size: { width: 768, height: 768 },
    })
    const ms = Date.now() - t0
    latenciesMs.push(ms)
    const file = path.join(outDir, `bench-${String(i + 1).padStart(2, "0")}.bin`)
    await writeFile(file, result.bytes)
    files.push(file)
    console.log(
      `bench ${i + 1}/${n}: ${ms}ms provider=${result.meta.providerId} model=${result.meta.modelId}`
    )
  }

  const sorted = [...latenciesMs].sort((a, b) => a - b)
  const p50 = sorted[Math.floor((sorted.length - 1) * 0.5)]!
  const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)]!

  return {
    provider: provider.name,
    modelId: config.acceptModelId,
    n,
    latenciesMs,
    p50Ms: p50,
    p95Ms: p95,
    files,
    note: "Fill quality rubric scores manually in Findings; script does not invent them.",
  }
}

async function main() {
  const rows = SCENARIOS.map(breakEven)
  const bench = await maybeBench()

  const report = {
    spike: "SPIKE-IMG-002",
    generatedAt: new Date().toISOString(),
    question:
      "Under what conditions should Raree Show switch from cloud generation to local generation?",
    assumptions: {
      engRateUsdPerDay: ENG_RATE_USD,
      cloudUsdPerImage: CLOUD_USD_PER_IMAGE,
      imagesPerWork: IMAGES_PER_WORK,
      localMarginalUsdPerImage: 0,
      windowYears: 2,
    },
    breakEven: rows,
    switchConditions: {
      preferLocalOptionalWhen: [
        "Cumulative accept images ≳ Scenario B breakEvenImages, OR cloud unit price rises enough that recomputed N* ≤ planned volume",
        "Measured quality not materially below cloud accept on showcase pack",
        "Warm P50 acceptable for authoring UX on target hardware",
        "Maintenance ≤ ~0.5 person-day/month",
        "Deployment config switch only; default flip needs Architecture Review",
      ],
      productionDefault: "cloud",
      localProductionDefaultAuthorized: false,
    },
    bench,
    dryRunProbe: null as null | Record<string, unknown>,
  }

  // Always exercise Port wiring with skipNetwork unless bench already did network.
  if (!bench) {
    const config = loadSpikeImageConfig({
      ...process.env,
      IMAGE_SPIKE_ACCEPT_PROVIDER: "local",
      IMAGE_SPIKE_SKIP_NETWORK: process.env.IMAGE_SPIKE_SKIP_NETWORK || "1",
    })
    const provider = createImagePortraitProvider("local", config, "accept")
    const t0 = Date.now()
    const result = await provider.generatePortrait({
      prompt: "dry-run portrait",
      seed: 42,
    })
    report.dryRunProbe = {
      provider: provider.name,
      capabilities: provider.capabilities,
      bytes: result.bytes.length,
      meta: result.meta,
      latencyMs: Date.now() - t0,
    }
  }

  const outDir = path.join(process.cwd(), "spike-output", "spike-img-002")
  await mkdir(outDir, { recursive: true })
  const outFile = path.join(outDir, "report.json")
  await writeFile(outFile, JSON.stringify(report, null, 2))

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outFile}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
