/**
 * SPIKE-DISCOVERY-SCENE-001 runner
 *
 *   npx tsx scripts/discovery-scene-spike/run.ts
 *
 * Read-only. Does not call Propose, Accept, or persist.
 */

import { architectureSplit, probeLedger } from "./ledger";
import { CASES, LEDGER } from "./cases";

async function main(): Promise<void> {
  const probes = probeLedger();
  const failed = probes.filter((p) => !p.ok);
  const split = architectureSplit();

  console.log("SPIKE-DISCOVERY-SCENE-001");
  console.log(`cases=${CASES.length} ledgerRows=${LEDGER.length}`);
  for (const c of CASES) {
    console.log(
      `  ${c.id} frames=${c.slice.frames.length} caption=${JSON.stringify(
        c.slice.frames[0]?.caption ?? "(none)"
      )}`
    );
  }

  console.log("\nArchitecture split (rows with lossPoint ≠ none):");
  for (const [k, ids] of Object.entries(split)) {
    console.log(`  ${k}: ${ids.join(", ") || "(none)"}`);
  }

  if (failed.length) {
    console.error("\nPROBE MISMATCH");
    for (const f of failed) {
      console.error(`  ${f.id}: ${f.failures.join("; ")}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("\nAll ledger probes match frozen Runtime slices.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
