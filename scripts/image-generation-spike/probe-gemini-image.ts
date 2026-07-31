/**
 * Probe Gemini image models / try Imagen once.
 *   npx tsx scripts/image-generation-spike/probe-gemini-image.ts
 */
import { loadEnvLocal } from "../load-env-local"

async function main(): Promise<void> {
  loadEnvLocal()
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new Error("GEMINI_API_KEY missing")

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
  )
  const d = (await res.json()) as { models?: Array<{ name?: string }> }
  const ms = d.models ?? []
  console.info("list.http", res.status, "total", ms.length)
  for (const m of ms) {
    const n = m.name ?? ""
    if (/image|imagen|banana/i.test(n)) console.info(n)
  }

  const candidates = [
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-preview-image-generation",
    "imagen-4.0-fast-generate-001",
    "imagen-3.0-generate-002",
  ]
  for (const model of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
    const body =
      model.startsWith("imagen-")
        ? null
        : {
            contents: [{ role: "user", parts: [{ text: "a red apple on a table" }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }
    if (!body) {
      console.info("skip generateContent for", model, "(imagen uses generateImages)")
      continue
    }
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    console.info("probe", model, r.status, text.slice(0, 180).replace(/\s+/g, " "))
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
