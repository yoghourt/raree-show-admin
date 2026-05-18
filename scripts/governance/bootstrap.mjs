#!/usr/bin/env node
/**
 * Init governance submodule and sync to origin/main (floating latest).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const submodule = spawnSync(
  "git",
  ["submodule", "update", "--init", "--remote", "governance"],
  { cwd: repoRoot, stdio: "inherit" },
);

if (submodule.status !== 0) {
  process.exit(submodule.status ?? 1);
}

const sync = spawnSync("node", ["scripts/governance/sync-governance.mjs"], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (sync.status !== 0) {
  process.exit(sync.status ?? 1);
}

const check = spawnSync("node", ["scripts/governance/check-governance.mjs"], {
  cwd: repoRoot,
  stdio: "inherit",
});

process.exit(check.status ?? 1);
