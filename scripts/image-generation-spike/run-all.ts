/**
 * Run all three paths sequentially (reference → local-direct → gemini-director).
 *
 *   npx tsx scripts/image-generation-spike/run-all.ts
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
  await run("run-reference.ts")
  await run("run-local-direct.ts")
  await run("run-gemini-director.ts")
  console.info("[image-gen-spike] all paths finished → scripts/image-generation-spike/results/")
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
