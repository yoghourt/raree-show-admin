#!/usr/bin/env node
/**
 * Deterministic failure when governance is missing or incomplete.
 */
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const governanceRoot = path.join(repoRoot, "governance");

const entrypoints = [
  "FOUNDATION.md",
  "RETRIEVAL.md",
  "NAVIGATION.md",
  "STREAMING.md",
  "ADR_RULES.md",
];

let failed = false;

try {
  await access(governanceRoot, constants.F_OK);
} catch {
  console.error(
    "governance mount missing: expected /governance (run: npm run bootstrap)",
  );
  process.exit(1);
}

for (const file of entrypoints) {
  const target = path.join(governanceRoot, file);
  try {
    await readFile(target, "utf8");
    console.log(`readable: governance/${file}`);
  } catch {
    console.error(`unreadable: governance/${file}`);
    failed = true;
  }
}

if (failed) {
  console.error(
    "check:governance failed: initialize with `npm run bootstrap`",
  );
  process.exit(1);
}

console.log("check:governance: governance entrypoints accessible.");

await import("./verify-adapter-integrity.mjs");
