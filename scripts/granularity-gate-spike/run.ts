/**
 * SPIKE-GRANULARITY-GATE-001 runner
 *
 *   npx tsx scripts/granularity-gate-spike/run.ts
 *
 * Does not call Discovery, Reader, or Rollout. Writes evidence JSON only.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FIXTURES } from "./fixtures";
import { invariantSet, runGranularityGate } from "./gate";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

async function main(): Promise<void> {
  const rows = FIXTURES.map((fx) => {
    const result = runGranularityGate(fx.input);
    const errors = invariantSet(result);
    const expected = new Set(fx.expectedErrorInvariants);
    const missing = [...expected].filter((i) => !errors.has(i));
    const extra = [...errors].filter((i) => !expected.has(i));
    const ok =
      result.status === fx.expectedStatus &&
      missing.length === 0 &&
      extra.length === 0;
    return {
      id: fx.id,
      label: fx.label,
      provenance: fx.provenance ?? null,
      expectedStatus: fx.expectedStatus,
      expectedErrorInvariants: fx.expectedErrorInvariants,
      actualStatus: result.status,
      actualErrorInvariants: [...errors],
      ok,
      result,
    };
  });

  const allOk = rows.every((r) => r.ok);
  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = path.join(RESULTS_DIR, "gate-evidence.json");
  await writeFile(
    outPath,
    `${JSON.stringify({ spike: "SPIKE-GRANULARITY-GATE-001", allOk, rows }, null, 2)}\n`
  );

  for (const r of rows) {
    const mark = r.ok ? "OK" : "MISMATCH";
    console.info(
      `[${r.id}] ${mark} expected=${r.expectedStatus} ${r.expectedErrorInvariants.join(",") || "∅"} actual=${r.actualStatus} ${r.actualErrorInvariants.join(",") || "∅"} — ${r.label}`
    );
  }
  console.info(`evidence: ${outPath}`);
  if (!allOk) {
    process.exitCode = 1;
  }
}

void main();
