/**
 * SPIKE-RIE-002 runner
 *
 *   npx tsx scripts/rie-002-spike/run.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANDIDATE_A_KEEP,
  CANDIDATE_B_LOSS,
  CANDIDATE_C_COMPRESSION,
  CANDIDATE_D_TRAP,
  CANDIDATE_MIX_EARLY,
  CANDIDATE_MIX_TRAP,
} from "./fixtures";
import { blockingUnits, validateCandidateInformation, validateRouteInformation } from "./validator";

const SPIKE_DIR = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(SPIKE_DIR, "results");

async function main(): Promise<void> {
  const a = validateCandidateInformation(CANDIDATE_A_KEEP);
  const b = validateCandidateInformation(CANDIDATE_B_LOSS);
  const c = validateCandidateInformation(CANDIDATE_C_COMPRESSION);
  const d = validateCandidateInformation(CANDIDATE_D_TRAP);
  const mixEarly = validateCandidateInformation(CANDIDATE_MIX_EARLY);
  const mixTrap = validateCandidateInformation(CANDIDATE_MIX_TRAP);
  const route = validateRouteInformation([CANDIDATE_MIX_EARLY, CANDIDATE_MIX_TRAP]);

  const payload = {
    spike: "SPIKE-RIE-002",
    A_KEEP: a.status,
    B_LOSS: b.status,
    C_COMPRESSION: c.status,
    D_TRAP: d.status,
    MIX_EARLY: mixEarly.status,
    MIX_TRAP: mixTrap.status,
    ROUTE_MIX: route.status,
    B_LOSS_blocking: blockingUnits(b).map((u) => u.unitId),
    D_TRAP_blocking: blockingUnits(d).map((u) => u.unitId),
  };

  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(
    path.join(RESULTS_DIR, "rie-002-evidence.json"),
    `${JSON.stringify(payload, null, 2)}\n`
  );
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
