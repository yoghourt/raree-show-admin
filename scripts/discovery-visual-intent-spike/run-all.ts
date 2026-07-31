/**
 * Run Baseline A then Experiment B (shared Discovery bundle cached on disk).
 *
 *   npx tsx scripts/discovery-visual-intent-spike/run-all.ts
 */

import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const dir = path.dirname(fileURLToPath(import.meta.url))

function run(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", path.join(dir, script)], {
      stdio: "inherit",
      cwd: path.resolve(dir, "../.."),
      env: process.env,
    })
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${script} exited ${code}`))
    })
  })
}

async function main(): Promise<void> {
  await run("run-baseline.ts")
  await run("run-visual-intent.ts")
  console.info(
    "[discovery-vi-spike] done → scripts/discovery-visual-intent-spike/results/"
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
