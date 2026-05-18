#!/usr/bin/env node
/**
 * Fail-fast byte-for-byte integrity check: governance source === consumer adapter.
 */
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adapterMappings } from "./adapter-mappings.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const governanceRoot = path.join(repoRoot, "governance");

/**
 * @param {string} source
 * @param {string} adapter
 * @param {string} condition
 */
function failDrift(source, adapter, condition) {
  console.error("check:governance failed: governance adapter drift");
  console.error(`  source:   governance/${source}`);
  console.error(`  adapter:  ${adapter}`);
  console.error(`  condition: ${condition}`);
  process.exit(1);
}

for (const { source, dest } of adapterMappings) {
  const sourcePath = path.join(governanceRoot, source);
  const destPath = path.join(repoRoot, dest);

  try {
    await access(sourcePath, constants.F_OK);
  } catch {
    failDrift(source, dest, "authority file missing");
  }

  try {
    await access(destPath, constants.F_OK);
  } catch {
    failDrift(source, dest, "adapter file missing");
  }

  const [authorityBytes, adapterBytes] = await Promise.all([
    readFile(sourcePath),
    readFile(destPath),
  ]);

  if (Buffer.compare(authorityBytes, adapterBytes) !== 0) {
    failDrift(
      source,
      dest,
      "content mismatch (expected byte-for-byte equality)",
    );
  }

  console.log(`integrity ok: governance/${source} === ${dest}`);
}

console.log("check:governance: adapter integrity verified.");
