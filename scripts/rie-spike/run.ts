/**
 * SPIKE-RIE-001 runner
 *
 *   npx tsx scripts/rie-spike/run.ts
 *
 * Does not call Discovery, Reader, or Rollout. Writes evidence JSON only.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateRie } from "./evaluate";
import { RIE_FIXTURES } from "./fixtures";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

async function main(): Promise<void> {
  const rows = RIE_FIXTURES.map(evaluateRie);
  const allOk = rows.every((r) => r.ok);
  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = path.join(RESULTS_DIR, "rie-evidence.json");
  await writeFile(
    outPath,
    `${JSON.stringify({ spike: "SPIKE-RIE-001", allOk, rows }, null, 2)}\n`
  );
  for (const r of rows) {
    const mark = r.ok ? "OK" : "MISMATCH";
    console.log(
      `${mark} ${r.id} gate=${r.gateStatus} (exp ${r.expectedGate}) info=${r.information} (exp ${r.expectedInformation}) lost/partial=${r.requiredProblems.join(",") || "none"}`
    );
  }
  if (!allOk) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
