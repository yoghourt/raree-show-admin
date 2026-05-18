#!/usr/bin/env node
/**
 * Copy governance templates into consumer adapter destinations (byte-for-byte).
 */
import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adapterMappings } from "./adapter-mappings.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const governanceRoot = path.join(repoRoot, "governance");

try {
  await access(governanceRoot, constants.F_OK);
} catch {
  console.error(
    "sync:governance failed: /governance missing (run: npm run bootstrap)",
  );
  process.exit(1);
}

let failed = false;

for (const { source, dest } of adapterMappings) {
  const sourcePath = path.join(governanceRoot, source);
  const destPath = path.join(repoRoot, dest);

  try {
    await access(sourcePath, constants.F_OK);
  } catch {
    console.error(`sync:governance failed: missing authority file governance/${source}`);
    failed = true;
    continue;
  }

  await mkdir(path.dirname(destPath), { recursive: true });
  await copyFile(sourcePath, destPath);
  console.log(`synced: governance/${source} -> ${dest}`);
}

if (failed) {
  process.exit(1);
}

console.log("sync:governance: adapter destinations updated.");
